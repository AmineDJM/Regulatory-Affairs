import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  ECRAN_REGLAGES_ADAM, leverSuspensionMissions, lireInterrupteurMissions, phraseSuspension, suspendreMissions,
} from "@/lib/interrupteurs/missions";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INTERRUPTEUR GLOBAL DES MISSIONS — le lecteur et les deux écrivains (§118.132).
 *
 * ── POURQUOI TOUT SE PASSE DANS UNE TRANSACTION ANNULÉE ─────────────────────────────────
 *
 * L'interrupteur est GLOBAL et la suite tourne en parallèle sur une seule base : le poser pour
 * de vrai, même une demi-seconde, ferait tomber les tests de missions des autres processus
 * pendant la fenêtre (§118.115). Sous READ COMMITTED, une écriture non validée est invisible
 * des autres connexions : on pose, on lit, on lève DANS une transaction, puis on la rejette. Le
 * vrai code est exercé — les mêmes requêtes, la même ligne `global` — et personne d'autre ne le
 * voit. La preuve que rien n'a fui est la relecture, hors transaction, APRÈS le rejet.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

class Rejet extends Error {}

suite("l'interrupteur global des missions — posé, lu, levé, et rien ne fuit", () => {
  it("pose → lu VRAI avec date et auteur ; seconde pose sans effet ; levée → lu FAUX ; rejet → état d'origine", async () => {
    const avant = await lireInterrupteurMissions();
    const ACTEUR = `banc-interrupteur-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      // La transaction part de l'état réel : on ne suppose pas que l'interrupteur est levé.
      const r0 = avant.suspendues ? await leverSuspensionMissions(tx) : null;
      if (r0) expect(r0.change).toBe(true);

      const r1 = await suspendreMissions(ACTEUR, tx);
      expect(r1.change).toBe(true);
      const lu = await lireInterrupteurMissions(tx);
      expect(lu.suspendues).toBe(true);
      expect(lu.parId).toBe(ACTEUR);
      expect(lu.depuis).toBeInstanceOf(Date);

      // UNE SECONDE POSE NE RÉÉCRIT NI LA DATE NI L'AUTEUR : « depuis quand » reste la première fois.
      const r2 = await suspendreMissions("quelqu-un-d-autre", tx);
      expect(r2.change).toBe(false);
      const relu = await lireInterrupteurMissions(tx);
      expect(relu.parId).toBe(ACTEUR);
      expect(relu.depuis?.getTime()).toBe(lu.depuis?.getTime());

      const r3 = await leverSuspensionMissions(tx);
      expect(r3.change).toBe(true);
      const leve = await lireInterrupteurMissions(tx);
      expect(leve).toEqual({ suspendues: false, depuis: null, parId: null });
      // Lever deux fois n'écrit rien non plus.
      expect((await leverSuspensionMissions(tx)).change).toBe(false);

      throw new Rejet("banc : on rejette tout");
    }).catch((e: unknown) => { if (!(e instanceof Rejet)) throw e; });

    // RIEN N'A FUI : la ligne réelle est celle d'avant, au champ près.
    const apres = await lireInterrupteurMissions();
    expect(apres.suspendues).toBe(avant.suspendues);
    expect(apres.parId).toBe(avant.parId);
    expect(apres.depuis?.getTime() ?? null).toBe(avant.depuis?.getTime() ?? null);
  }, 30_000);

  it("la phrase d'un refus dit le fait, depuis quand, et l'écran EXACT qui lève la suspension", () => {
    const depuis = new Date("2026-09-12T09:30:00Z");
    const p = phraseSuspension({ suspendues: true, depuis, parId: "x" });
    expect(p).toMatch(/suspendues par la direction depuis le \d/);
    expect(p).toContain(ECRAN_REGLAGES_ADAM);
    expect(p).toMatch(/repartira où elle en était/);
    // Sans date connue, la phrase ne l'invente pas — « depuis les Réglages » n'est pas une date,
    // d'où le chiffre exigé après « depuis le » (le premier juge accrochait cette autre phrase).
    expect(phraseSuspension({ suspendues: true, depuis: null, parId: null })).not.toMatch(/depuis le \d/);
  });
});
