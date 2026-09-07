import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { oublierTentativesSortantes, SortieInterdite, tentativesSortantes } from "./garde";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES VRAIES FONCTIONS DE PRODUCTION REFUSENT — pas des doublures, pas la garde toute seule.
 *
 * ── CE QUE CE FICHIER PROUVE, ET QUE `garde.test.ts` NE PROUVE PAS ──────────────────────
 *
 * `garde.test.ts` vérifie que la porte refuse quand on l'appelle, et qu'aucun module ne peut
 * atteindre un transport sans elle. C'est la moitié statique. Il reste la question que le
 * mandat pose en toutes lettres : **si quelqu'un remet l'adaptateur de PRODUCTION, est-ce que
 * l'envoi part ?**
 *
 * Ici on ne remplace RIEN. On appelle `sendMail` de `lib/mail.ts` — celle qui ouvre SMTP —
 * avec un compte dont les identifiants pointent vers un hôte inexistant. Deux issues étaient
 * possibles :
 *
 *   • la fonction tente la connexion et échoue sur le réseau → la garde n'a pas joué, et un
 *     hôte VALIDE aurait reçu le message ;
 *   • la fonction lève `SortieInterdite` AVANT d'ouvrir quoi que ce soit → la garde tient.
 *
 * Le test exige la seconde, et distingue les deux : une erreur réseau ne passe pas pour un
 * succès de sécurité. C'est précisément la confusion qui rendrait la protection illusoire.
 *
 * ── ET LA PREUVE QUE RIEN N'A ÉTÉ LU ────────────────────────────────────────────────────
 *
 * Le compte de test porte un `passwordEnc` que `decryptSecret` REFUSERAIT. Si la fonction
 * atteignait le déchiffrement, elle lèverait une autre erreur, d'un autre type. Recevoir
 * `SortieInterdite` prouve donc aussi que la garde est placée AVANT la lecture du secret — pas
 * juste avant l'envoi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un compte dont RIEN n'est utilisable : ni l'hôte, ni le secret. C'est voulu. */
const COMPTE = {
  id: "compte-de-test",
  userId: "u-test",
  email: "adam@adventum-test.invalid",
  displayName: "Adam",
  passwordEnc: "ceci-n-est-pas-un-secret-chiffre",
  imapHost: "imap.invalid.test",
  imapPort: 993,
  smtpHost: "smtp.invalid.test",
  smtpPort: 587,
} as never;

describe("LE TEST QUI COMPTE : les transports de PRODUCTION refusent avant d'ouvrir quoi que ce soit", () => {
  /**
   * Chaque test part d'un journal VIDE pour pouvoir affirmer ce que SON appel a produit ; le
   * total, lui, s'accumule ici. Sans ce cumul, la mesure finale comptait après le nettoyage et
   * lisait zéro — ce qui, dans un test dont la cible est « aucune sortie », se serait lu comme
   * un succès. Un compteur qu'on peut satisfaire en ne faisant rien ne mesure rien.
   */
  let interceptees = 0;
  beforeEach(() => oublierTentativesSortantes());
  afterEach(() => { interceptees += tentativesSortantes().length; });

  it("`sendMail` (SMTP réel) lève SortieInterdite — pas une erreur réseau", async () => {
    const { sendMail } = await import("@/lib/mail");
    let leve: unknown = null;
    await sendMail(COMPTE, {
      to: "yacine@adventum-test.invalid",
      subject: "Relance dossier Nivolex",
      text: "Bonjour Yacine, où en est le prix ?",
    }).catch((e) => { leve = e; });

    // LA DISTINCTION EST TOUTE LA VALEUR DU TEST : « ça a échoué » ne veut rien dire ici.
    expect(leve, "sendMail n'a rien levé : le message serait parti").not.toBeNull();
    expect(leve, `erreur reçue : ${String(leve)}`).toBeInstanceOf(SortieInterdite);
    const err = leve as SortieInterdite;
    expect(err.acte).toBe("COURRIEL");
    expect(err.cible).toBe("yacine@adventum-test.invalid");
    // Et le banc peut DIRE ce qui aurait été envoyé.
    expect(err.message).toContain("Relance dossier Nivolex");
  });

  it("le secret n'a jamais été déchiffré — la garde est AVANT, pas juste avant l'envoi", async () => {
    // `passwordEnc` est volontairement invalide. Si le déchiffrement avait eu lieu, l'erreur
    // serait d'un autre type, et ce test le verrait.
    const { sendMail } = await import("@/lib/mail");
    const e = await sendMail(COMPTE, { to: "x@y.invalid", subject: "S", text: "T" }).catch((x) => x);
    expect(e).toBeInstanceOf(SortieInterdite);
    expect(String(e)).not.toMatch(/decrypt|secret|cipher|auth tag/i);
  });

  it("`sendPushToUser` (web-push réel) ne pousse rien, et l'enregistre quand même", async () => {
    const { sendPushToUser } = await import("@/lib/push");
    // Chemin « au mieux » : il ne lève pas — mais il ne doit RIEN envoyer, et laisser une trace.
    await expect(sendPushToUser("u-42", { title: "Dossier bloqué", body: "REG-2026-9011" })).resolves.toBeUndefined();
    const t = tentativesSortantes();
    expect(t.map((x) => x.acte)).toContain("NOTIFICATION_PUSH");
    expect(t.find((x) => x.acte === "NOTIFICATION_PUSH")).toMatchObject({ cible: "u-42", apercu: "Dossier bloqué" });
  });

  it("le fournisseur Microsoft Graph refuse AVANT de créer le brouillon", async () => {
    // Le brouillon est déjà une écriture chez Microsoft : refuser à l'envoi serait trop tard.
    const { MicrosoftGraphMailProvider } = await import("@/lib/mail/graph/provider");
    const p = new MicrosoftGraphMailProvider("jeton-factice", "adam@adventum-test.invalid");
    const e = await p.send({
      to: [{ name: "Deepak", address: "deepak@hetero-test.invalid" }],
      subject: "CTD — module 3",
      bodyHtml: "<p>Bonjour</p>",
    }).catch((x) => x);
    expect(e, `erreur reçue : ${String(e)}`).toBeInstanceOf(SortieInterdite);
    expect((e as SortieInterdite).cible).toBe("deepak@hetero-test.invalid");
  });

  it("mesure consignée — tentatives de sortie réellement parties pendant la suite", () => {
    /**
     * Le chiffre visé est ZÉRO, et il se lit à l'envers : chaque tentative enregistrée est une
     * sortie qui N'EST PAS partie. Le jour où ce compteur reste à zéro alors que le banc a
     * exercé des envois, c'est le DÉTECTEUR qui s'est désarmé — d'où la seconde assertion.
     */
    consignerMesure("sortie_bloquee_par_la_porte", { n: interceptees, ok: interceptees },
      "lib/sortie/transports.test.ts",
      "tentatives de sortie interceptées AVANT l'ouverture du transport, en appelant les vraies fonctions de production — aucune n'est partie");
    expect(interceptees, "aucune tentative enregistrée : la garde ou le test s'est désarmé").toBeGreaterThan(0);
  });
});
