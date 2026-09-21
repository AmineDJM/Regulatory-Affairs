import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { peutGererLaConversation, peutRetirerUnMessage } from "./messaging-ui";

/** Retire commentaires de bloc et de ligne : un cliquet doit juger le CODE, jamais la prose
 *  qui le décrit — ce dépôt s'est déjà accroché quatre fois à sa propre documentation
 *  (§118.79d, §118.88, §118.112b, §118.137). */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (p: string) => sansCommentaires(readFileSync(p, "utf8"));

const ACTION = "src/lib/actions/messaging-actions.ts";
const ITEM = "src/app/(app)/messages/message-item.tsx";
const THREAD = "src/app/(app)/messages/message-thread.tsx";
const PAGE = "src/app/(app)/messages/page.tsx";

describe("Modération d'un message — une règle, deux lecteurs", () => {
  it("les trois faits, chacun suffisant, et aucun fait = aucun droit", () => {
    const rien = { vueGlobale: false, auteur: false, gereLaConversation: false };
    expect(peutRetirerUnMessage(rien)).toBe(false);
    // Chaque fait, SEUL, doit suffire : c'est exactement ce que `deleteMessage` accepte.
    expect(peutRetirerUnMessage({ ...rien, vueGlobale: true })).toBe(true);
    expect(peutRetirerUnMessage({ ...rien, auteur: true })).toBe(true);
    expect(peutRetirerUnMessage({ ...rien, gereLaConversation: true })).toBe(true);
  });

  it("le cas EXACT du défaut : vue globale sans appartenance ni paternité", () => {
    // C'était `false` à l'écran et `true` dans l'action : le Super Admin ne voyait jamais le
    // bouton que l'action aurait accepté (§118.50).
    expect(peutRetirerUnMessage({ vueGlobale: true, auteur: false, gereLaConversation: false })).toBe(true);
  });

  it("gérer une conversation, c'est en être OWNER ou ADMIN — et rien d'autre", () => {
    expect(peutGererLaConversation("OWNER")).toBe(true);
    expect(peutGererLaConversation("ADMIN")).toBe(true);
    expect(peutGererLaConversation("MEMBER")).toBe(false);
    // `null`/`undefined` = pas membre : la lecture doit tenir, sans rendre `undefined` (une
    // valeur molle en condition JSX afficherait « false » ou rien selon le contexte).
    expect(peutGererLaConversation(null)).toBe(false);
    expect(peutGererLaConversation(undefined)).toBe(false);
  });
});

/**
 * LE CLIQUET DE POINT D'APPEL (§118.49).
 *
 * Vérifier le CORPS de `peutRetirerUnMessage` ne prouve rien : le défaut d'origine n'était pas
 * une règle fausse, c'était une règle QUE L'ÉCRAN NE LISAIT PAS. On cherche donc l'APPEL, à
 * l'endroit exact où il doit être, des deux côtés de la frontière.
 */
describe("Cliquet — la règle est APPELÉE des deux côtés, et redérivée nulle part", () => {
  it("l'action serveur et le bouton de l'écran appellent la même fonction", () => {
    expect(lire(ACTION)).toContain("peutRetirerUnMessage({");
    expect(lire(ITEM)).toContain("peutRetirerUnMessage({");
  });

  it("aucun écran ne redérive « OWNER ou ADMIN » à la main", () => {
    for (const f of [ITEM, THREAD]) {
      const src = lire(f);
      expect(src, `${f} redérive le rôle de conversation au lieu d'appeler peutGererLaConversation`)
        .not.toMatch(/===\s*"(OWNER|ADMIN)"/);
    }
  });

  it("le fait de vue globale vient du SERVEUR, avec la même lecture que l'action", () => {
    // L'action lit `hasGlobalView(user.role)` — la CHAÎNE, donc sans casquette secondaire.
    // Si la page lisait l'objet, elle offrirait un bouton que l'action refuse.
    expect(lire(ACTION)).toContain("hasGlobalView(user.role)");
    expect(lire(PAGE)).toContain("hasGlobalView(user.role)");
    // …et il TRAVERSE jusqu'au bouton : sans ces deux passages, la page calculerait un fait
    // que personne ne consomme (§118.50 à nouveau).
    expect(lire("src/app/(app)/messages/messenger.tsx")).toContain("vueGlobale={vueGlobale}");
    expect(lire(THREAD)).toContain("vueGlobale={vueGlobale}");
  });
});
