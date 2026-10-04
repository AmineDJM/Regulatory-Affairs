import { expect, type Locator } from "@playwright/test";

/**
 * CLIQUER UN BOUTON DÉCISIF — deux clics sur le MÊME bouton (`src/components/ui/bouton-decisif.tsx`).
 *
 * Le premier clic arme le bouton : son nom devient « Confirmer : … ? », rien ne part. Le second, dans les
 * 5 s, exécute. On tient l'ÉLÉMENT, pas le localisateur : un `getByRole({ name: "Refuser" })` ne retrouverait
 * plus le bouton une fois renommé.
 */
export async function cliquerDecisif(bouton: Locator): Promise<void> {
  const el = await bouton.elementHandle();
  if (!el) throw new Error("bouton décisif introuvable");
  await el.click();
  await expect.poll(() => el.getAttribute("data-decisif"), { message: "le premier clic doit armer le bouton" }).toBe("arme");
  await el.click();
}
