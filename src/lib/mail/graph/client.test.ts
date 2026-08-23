import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { graphJson, operationOf } from "./client";
import { MicrosoftGraphMailProvider } from "./provider";
import { MailError, describeDiagnostic } from "../provider";

/**
 * L'ENVOI D'UN MESSAGE, VÉRIFIÉ SANS RÉSEAU — parce qu'un envoi qui échoue en silence est la
 * panne la plus coûteuse d'une messagerie.
 *
 * Ces tests existent à cause d'un cas réel : un message parti de l'ERP n'est jamais arrivé, et il
 * a été impossible de dire si Microsoft l'avait seulement reçu. Le code vérifiait bien le statut
 * HTTP — mais il jetait le code d'erreur de Graph et ne journalisait rien. Chaque test ci-dessous
 * ferme une des portes par lesquelles cette information disparaissait.
 *
 * `fetch` est mocké : aucun appel réseau, aucune base.
 */

const TOKEN = "jeton-secret-a-ne-jamais-journaliser";

function res(status: number, body: unknown = "", headers: Record<string, string> = {}): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    text: async () => text,
  } as unknown as Response;
}

/** Une file de réponses : la n-ième requête reçoit la n-ième réponse. La dernière est répétée. */
function queue(...responses: Response[]) {
  let i = 0;
  // Les paramètres sont déclarés pour que `mock.calls` reste typé : les tests inspectent l'URL
  // appelée et le corps envoyé, ce qui est tout l'intérêt du bouchon.
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    void url; void init;
    return responses[Math.min(i++, responses.length - 1)];
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const graphError = (code: string) => ({ error: { code, message: "objet confidentiel du message" } });

/** Un bouchon qui répond selon l'URL — pour les appels parallèles, où l'ordre n'est pas un contrat. */
function byUrl(routes: [RegExp, Response][]) {
  const fn = vi.fn(async (url: string) => {
    const hit = routes.find(([re]) => re.test(url));
    return hit ? hit[1] : res(404, graphError("ErrorFolderNotFound"));
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

let logs: unknown[][];
let infos: unknown[][];
const realFetch = global.fetch;

beforeEach(() => {
  logs = [];
  infos = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { logs.push(a); });
  vi.spyOn(console, "info").mockImplementation((...a: unknown[]) => { infos.push(a); });
});

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = realFetch;
});

const send = (p: MicrosoftGraphMailProvider) =>
  p.send({ to: [{ name: null, address: "amine.djouamai@pharmagenedz.com" }], subject: "Objet", bodyHtml: "<p>Bonjour</p>" });

describe("Un envoi accepté par Microsoft", () => {
  it("202 Accepted avec un corps VIDE est un succès, pas une réponse illisible", async () => {
    // C'est LA réponse normale de `/send`. La lire comme une erreur ferait afficher un échec sur
    // un envoi parfaitement parti — et pousserait à réenvoyer, donc à envoyer deux fois.
    queue(res(202, ""));
    await expect(graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages/abc/send" })).resolves.toEqual({});
  });

  it("l'envoi complet fait bien DEUX appels : créer le brouillon, puis l'envoyer", async () => {
    const fetchMock = queue(res(201, { id: "draft-1" }), res(202, ""));
    await expect(send(new MicrosoftGraphMailProvider(TOKEN, "amine.djouamai@adventumdz.com"))).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(first).toContain("/me/messages");
    expect(second).toContain("/me/messages/draft-1/send");
  });

  it("le corps du brouillon porte les destinataires, le HTML — et AUCUN expéditeur forcé", async () => {
    // Forcer un `from` ferait refuser l'envoi par Exchange (« send as » non accordé). L'expéditeur
    // doit rester implicite : c'est le jeton délégué qui désigne la boîte.
    const fetchMock = queue(res(201, { id: "draft-1" }), res(202, ""));
    await send(new MicrosoftGraphMailProvider(TOKEN, "amine.djouamai@adventumdz.com"));

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.toRecipients).toEqual([{ emailAddress: { address: "amine.djouamai@pharmagenedz.com" } }]);
    expect(body.body).toEqual({ contentType: "HTML", content: "<p>Bonjour</p>" });
    expect(body.subject).toBe("Objet");
    expect(body.from).toBeUndefined();
    expect(body.sender).toBeUndefined();
  });

  it("une écriture réussie laisse une trace — sinon on ne peut pas prouver qu'un mail est parti", async () => {
    queue(res(202, "", { "request-id": "corr-999" }));
    await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages/abc/send" });

    expect(infos).toHaveLength(1);
    expect(infos[0][1]).toMatchObject({ status: 202, requestId: "corr-999", operation: "POST /me/messages/abc/send" });
  });

  it("une LECTURE réussie ne journalise rien — sinon chaque rafraîchissement noie le journal", async () => {
    queue(res(200, { value: [] }));
    await graphJson({ accessToken: TOKEN, path: "/me/mailFolders" });
    expect(infos).toHaveLength(0);
  });
});

describe("Un envoi refusé par Microsoft — le code doit survivre", () => {
  const cases: { status: number; code: string; kind: string }[] = [
    { status: 401, code: "InvalidAuthenticationToken", kind: "unauthorized" },
    { status: 403, code: "MailboxNotEnabledForRESTAPI", kind: "forbidden" },
    { status: 400, code: "ErrorInvalidRecipients", kind: "unknown" },
  ];

  for (const c of cases) {
    it(`${c.status} ${c.code} : le code de Graph arrive jusqu'à l'appelant`, async () => {
      queue(res(c.status, graphError(c.code), { "request-id": "corr-42" }));
      const err = await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch((e) => e);

      expect(err).toBeInstanceOf(MailError);
      expect((err as MailError).kind).toBe(c.kind);
      // Sans ce diagnostic, « Microsoft refuse cette action » couvre indifféremment une boîte sans
      // licence Exchange, un consentement retiré et une adresse invalide : trois causes, trois
      // corrections, et aucun moyen de savoir laquelle.
      expect((err as MailError).diagnostic).toEqual({
        status: c.status, code: c.code, requestId: "corr-42", operation: "POST /me/messages",
      });
      expect(describeDiagnostic((err as MailError).diagnostic)).toBe(`(${c.code}, réf. corr-42)`);
    });
  }

  it("un échec est journalisé avec le statut, le code et la corrélation Microsoft", async () => {
    queue(res(403, graphError("ErrorAccessDenied"), { "request-id": "corr-7" }));
    await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch(() => null);

    expect(logs).toHaveLength(1);
    expect(logs[0][1]).toMatchObject({
      operation: "POST /me/messages", status: 403, code: "ErrorAccessDenied", requestId: "corr-7",
    });
  });

  it("ni le jeton ni le contenu du message n'entrent JAMAIS dans le journal", async () => {
    queue(res(403, graphError("ErrorAccessDenied")));
    await graphJson({
      accessToken: TOKEN, method: "POST", path: "/me/messages",
      body: { subject: "Prix confidentiels 2026", toRecipients: [{ emailAddress: { address: "secret@ailleurs.dz" } }] },
    }).catch(() => null);

    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(TOKEN);
    expect(dump).not.toContain("Prix confidentiels");
    expect(dump).not.toContain("secret@ailleurs.dz");
    // Le message de Graph aussi est écarté : Microsoft y recopie volontiers l'objet.
    expect(dump).not.toContain("objet confidentiel");
  });

  it("le corps de la réponse de Graph n'est pas montré à l'utilisateur", async () => {
    queue(res(403, graphError("ErrorAccessDenied")));
    const err = await graphJson({ accessToken: TOKEN, path: "/me/messages" }).catch((e) => e);
    expect((err as MailError).message).not.toContain("objet confidentiel");
  });

  it("une réponse sans corps JSON ne fait pas perdre le statut", async () => {
    queue(res(502, "<html>Bad Gateway</html>", { "retry-after": "0" }));
    const err = await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch((e) => e);
    expect((err as MailError).diagnostic).toMatchObject({ status: 502, code: "" });
  });
});

describe("Le rejeu, et ce qu'il ne doit JAMAIS faire", () => {
  it("réessaie un 429 puis réussit — Microsoft dit explicitement qu'il n'a rien traité", async () => {
    const fetchMock = queue(res(429, graphError("TooManyRequests"), { "retry-after": "0" }), res(202, ""));
    await expect(graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages/abc/send" })).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("réessaie un 5xx sur une LECTURE — c'est sans conséquence", async () => {
    const fetchMock = queue(res(503, "", { "retry-after": "0" }));
    await graphJson({ accessToken: TOKEN, path: "/me/mailFolders" }).catch(() => null);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("ne rejoue PAS un 5xx sur un envoi — le message partirait deux fois", async () => {
    // Un 5xx est ambigu : Graph a peut-être expédié le message avant de tomber. Rejouer, c'est
    // accepter d'envoyer deux fois le même courrier à un client. On rend la main.
    const fetchMock = queue(res(500, "", { "retry-after": "0" }));
    await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages/abc/send" }).catch(() => null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne rejoue PAS un 5xx sur la création d'un brouillon — on aurait deux brouillons", async () => {
    const fetchMock = queue(res(500, "", { "retry-after": "0" }));
    await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch(() => null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("une panne réseau sur un envoi n'est pas rejouée non plus, et reste diagnosticable", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("ECONNRESET"); });
    global.fetch = fetchMock as unknown as typeof fetch;

    const err = await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch((e) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((err as MailError).kind).toBe("network");
    expect((err as MailError).diagnostic).toMatchObject({ status: 0, code: "network" });
  });
});

describe("Dire OÙ l'envoi s'est arrêté", () => {
  it("brouillon créé mais envoi refusé : le message est resté dans les brouillons, et on le dit", async () => {
    // Le travail de rédaction n'est pas perdu — encore faut-il que la personne le sache, sinon
    // elle retape tout, ou pire, croit son message parti.
    // Identifiant de la forme réelle rendue par Graph — c'est lui qui sera masqué dans le journal.
    queue(res(201, { id: "AAMkAGI2TG93AAA=".repeat(9) }), res(403, graphError("ErrorAccessDenied")));
    const err = await send(new MicrosoftGraphMailProvider(TOKEN, "a@adventumdz.com")).catch((e) => e);

    expect(err).toBeInstanceOf(MailError);
    expect((err as MailError).message).toContain("brouillons");
    // L'opération nomme l'étape fautive : c'est l'ENVOI qui a échoué, pas la création du brouillon.
    expect((err as MailError).diagnostic).toMatchObject({ operation: "POST /me/messages/{id}/send" });
  });

  it("brouillon refusé d'emblée : on ne promet pas un brouillon qui n'existe pas", async () => {
    queue(res(403, graphError("MailboxNotEnabledForRESTAPI")));
    const err = await send(new MicrosoftGraphMailProvider(TOKEN, "a@adventumdz.com")).catch((e) => e);
    expect((err as MailError).message).not.toContain("brouillons");
  });
});

describe("La liste des dossiers — la requête qui répondait 400 BadRequest", () => {
  const FRENCH_MAILBOX: [RegExp, Response][] = [
    // La liste : une boîte FRANÇAISE — aucun nom affiché ne correspond aux noms Graph.
    [/mailFolders\?/, res(200, {
      value: [
        { id: "id-inbox", displayName: "Boîte de réception", unreadItemCount: 2, totalItemCount: 5 },
        { id: "id-sent", displayName: "Éléments envoyés", unreadItemCount: 0, totalItemCount: 0 },
        { id: "id-perso", displayName: "ANPP 2026", unreadItemCount: 0, totalItemCount: 0 },
      ],
    })],
    // Les noms réservés v1.0, indépendants de la langue. Les quatre autres répondront 404.
    [/mailFolders\/inbox\?/, res(200, { id: "id-inbox" })],
    [/mailFolders\/sentitems\?/, res(200, { id: "id-sent" })],
  ];

  it("le $select ne demande plus wellKnownName — propriété bêta, absente de mailFolder v1.0", async () => {
    // C'était LA cause du 400 : une propriété inconnue dans un `$select` fait rejeter toute la
    // requête, et l'écran affichait « La messagerie n'a pas pu répondre » alors que l'envoi marchait.
    const fetchMock = byUrl(FRENCH_MAILBOX);
    await new MicrosoftGraphMailProvider(TOKEN, "a@adventumdz.com").listFolders();

    const listUrl = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => /mailFolders\?/.test(u));
    expect(listUrl).toBeDefined();
    expect(decodeURIComponent(listUrl!)).not.toContain("wellKnownName");
  });

  it("les rôles viennent des noms réservés : une boîte française garde Réception et Envoyés", async () => {
    byUrl(FRENCH_MAILBOX);
    const folders = await new MicrosoftGraphMailProvider(TOKEN, "a@adventumdz.com").listFolders();

    expect(folders.find((f) => f.id === "id-inbox")?.wellKnown).toBe("inbox");
    expect(folders.find((f) => f.id === "id-sent")?.wellKnown).toBe("sent");
    expect(folders.find((f) => f.id === "id-perso")?.wellKnown).toBeNull();
  });

  it("un rôle introuvable (404) n'abat pas la liste — une boîte quasi vide s'affiche sans erreur", async () => {
    // Archive, Corbeille, Indésirables et Brouillons répondent 404 ici : la liste doit sortir
    // quand même, avec ses compteurs à zéro — pas un bandeau d'erreur.
    byUrl(FRENCH_MAILBOX);
    const folders = await new MicrosoftGraphMailProvider(TOKEN, "a@adventumdz.com").listFolders();

    expect(folders).toHaveLength(3);
    const sent = folders.find((f) => f.id === "id-sent");
    expect(sent?.unread).toBe(0);
    expect(sent?.total).toBe(0);
  });
});

describe("Le détail d'un 400 — savoir QUEL paramètre est invalide", () => {
  it("un 400 de LECTURE journalise le message de Graph, qui nomme la propriété fautive", async () => {
    // `code: BadRequest` seul ne dit pas QUOI corriger ; c'est le message qui nomme la faute.
    queue(res(400, {
      error: { code: "BadRequest", message: "Could not find a property named 'wellKnownName' on type 'Microsoft.OutlookServices.MailFolder'." },
    }));
    await graphJson({ accessToken: TOKEN, path: "/me/mailFolders", query: { $select: "wellKnownName" } }).catch(() => null);

    expect(JSON.stringify(logs)).toContain("wellKnownName");
  });

  it("un 400 d'ÉCRITURE ne journalise PAS le message — il recopie l'adresse du destinataire refusé", async () => {
    queue(res(400, { error: { code: "ErrorInvalidRecipients", message: "The address 'secret@ailleurs.dz' is invalid." } }));
    await graphJson({ accessToken: TOKEN, method: "POST", path: "/me/messages" }).catch(() => null);

    expect(JSON.stringify(logs)).not.toContain("secret@ailleurs.dz");
  });
});

describe("Le nom de l'opération dans le journal", () => {
  it("masque les identifiants Graph, qui font cent cinquante caractères", () => {
    const id = "AAMkAGI2TG93AAA=".repeat(12);
    expect(operationOf({ accessToken: "x", method: "POST", path: `/me/messages/${id}/send` }))
      .toBe("POST /me/messages/{id}/send");
  });

  it("ne contient jamais les paramètres de requête — un $search porte les mots cherchés", () => {
    const op = operationOf({ accessToken: "x", path: "/me/messages", query: { $search: '"augmentation salaire"' } });
    expect(op).toBe("GET /me/messages");
  });
});
