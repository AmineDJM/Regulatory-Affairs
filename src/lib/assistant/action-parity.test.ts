import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTION_CLASSIFICATION, ERP_ACTIONS, matchNativeAction, nativeActionHint, actionsForUser, parityStats,
} from "./action-registry";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess } from "@/lib/rbac";

/**
 * PARITÉ UI ↔ CHIEF COMME INVARIANT DE BUILD (« no more capability whack-a-mole »).
 *
 * Le scan relit `src/lib/actions/` À CHAQUE exécution : un développeur qui ajoute un bouton
 * métier (— donc une server action —) sans la classer dans le registre voit ce test échouer
 * avec le nom exact de l'action. Un trou peut être ASSUMÉ (statut GAP, note), jamais SILENCIEUX.
 * Le même test verrouille l'hygiène du registre (ids uniques, alias résolus, portes sûres) et
 * imprime la métrique UI_ACTION_PARITY.
 */

const ACTIONS_DIR = join(process.cwd(), "src", "lib", "actions");

function liveActionKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of readdirSync(ACTIONS_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file === "types.ts") continue;
    const base = file.replace(/\.ts$/, "");
    const src = readFileSync(join(ACTIONS_DIR, file), "utf8");
    for (const m of src.matchAll(/^export async function ([A-Za-z0-9_]+)/gm)) {
      keys.add(`${base}:${m[1]}`);
    }
  }
  return keys;
}

function userWith(role: CurrentUser["role"], perms: Record<string, string[]> = {}): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [m, { module: m, actions: new Set(actions), scope: "ALL" as const }]),
  );
  return {
    id: "u1", name: "T", email: "t@x.dz", role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

describe("ZERO-GAP — chaque action serveur de l'ERP est classée, aucun trou silencieux", () => {
  const live = liveActionKeys();

  it("toute action serveur EXISTANTE est classée (NATIVE / COVERED / GAP / EXCLUDED)", () => {
    const missing = [...live].filter((k) => !ACTION_CLASSIFICATION[k]);
    expect(
      missing,
      `ERP ACTION WITHOUT ASSISTANT PARITY CLASSIFICATION:\n${missing.join("\n")}\n→ classer dans src/lib/assistant/action-registry.ts (NATIVE/COVERED/GAP/EXCLUDED avec via/note)`,
    ).toEqual([]);
  });

  it("aucune classification FANTÔME (action disparue du code mais encore classée)", () => {
    const stale = Object.keys(ACTION_CLASSIFICATION).filter((k) => !live.has(k));
    expect(stale, `Classifications périmées à retirer du registre :\n${stale.join("\n")}`).toEqual([]);
  });

  it("le nombre de TROUS assumés ne grandit pas en silence (cliquet)", () => {
    const stats = parityStats();
    // Cliquet : combler un trou ABAISSE ce plafond ; en ouvrir un nouveau exige de le relever
    // ICI, consciemment, dans la même revue de code que la nouvelle action.
    expect(stats.gap).toBeLessThanOrEqual(535);
    expect(stats.native + stats.covered).toBeGreaterThanOrEqual(60);

    console.info(`[UI_ACTION_PARITY] natives=${stats.native} couvertes=${stats.covered} trous=${stats.gap} exclues=${stats.excluded} — parité=${stats.parityPct}% (sur ${stats.total} actions classées)`);
  });

  it("hygiène du registre : ids uniques, chaque NATIVE/COVERED référence un `via` non vide", () => {
    const ids = ERP_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, c] of Object.entries(ACTION_CLASSIFICATION)) {
      if (c.status === "NATIVE" || c.status === "COVERED") {
        expect(c.via, `${key} : via manquant`).toBeTruthy();
      } else {
        expect(c.note, `${key} : note manquante`).toBeTruthy();
      }
    }
  });
});

describe("ZERO-GAP — résolution d'intention vers l'action NATIVE (priorité au natif)", () => {
  it("GOLDEN (échec réel) : « actualisation du solde du compte bancaire » → l'action Finances native, PAS une demande générique", () => {
    for (const phrasing of [
      "Est-ce que tu peux demander une actualisation du solde du compte bancaire ?",
      "Demande l'actualisation des soldes.",
      "Il faut rafraîchir les soldes bancaires",
      "demande une mise à jour du solde de trésorerie",
    ]) {
      const m = matchNativeAction(phrasing);
      expect(m.map((a) => a.id), phrasing).toContain("FINANCE_REQUEST_BALANCE_REFRESH");
    }
    const hint = nativeActionHint("Demande l'actualisation des soldes");
    expect(hint).toContain("request_treasury_update");
    expect(hint).toMatch(/jamais une demande administrative générique/);
  });

  it("« Demande à Raihana de vérifier les dossiers Nintedanib » → AUCUNE action native ne matche (repli tâche, par la règle métier)", () => {
    const m = matchNativeAction("Demande à Raihana de vérifier les dossiers Nintedanib");
    expect(m.find((a) => a.id === "FINANCE_REQUEST_BALANCE_REFRESH")).toBeUndefined();
    // « demande à » peut légitimement matcher la demande de tâche — mais jamais une action
    // d'un autre module par un alias trop large.
    for (const a of m) expect(["TASK_CREATE_OR_REQUEST"]).toContain(a.id);
  });

  it("« Supprime définitivement ces deux dossiers » → l'action de suppression native (jamais « je ne peux pas »)", () => {
    const m = matchNativeAction("Supprime définitivement ces deux dossiers");
    expect(m.map((a) => a.id)).toContain("RECORD_DELETE");
  });

  it("phrase sans intention d'action → aucun indice (pas de faux positif qui pousse le modèle)", () => {
    expect(matchNativeAction("Quel est l'état du dossier REG-2026-041 ?")).toEqual([]);
    expect(nativeActionHint("Bonjour, comment vas-tu ?")).toBeNull();
  });
});

describe("ZERO-GAP — découverte : « qu'est-ce que je peux faire ici ? »", () => {
  it("le Super Admin voit les actions d'administration ; le module filtre ; la porte écarte les autres", () => {
    const sa = userWith("SUPER_ADMIN");
    const all = actionsForUser(sa);
    expect(all.map((a) => a.id)).toContain("RECORD_DELETE");
    expect(all.map((a) => a.id)).toContain("FINANCE_REQUEST_BALANCE_REFRESH");
    const admin = actionsForUser(sa, "Administration");
    expect(admin.map((a) => a.id)).toContain("ACCOUNT_SET_ACTIVE");
    expect(admin.map((a) => a.id)).not.toContain("SALARY_UPDATE");
  });

  it("un délégué sans droits n'obtient QUE les actions ouvertes à tous — la liste dit la vérité", () => {
    const delegate = userWith("MEDICAL_DELEGATE");
    const ids = actionsForUser(delegate).map((a) => a.id);
    expect(ids).not.toContain("RECORD_DELETE");
    expect(ids).not.toContain("ACCOUNT_SET_ACTIVE");
    expect(ids).not.toContain("REGULATORY_UPDATE_FIELD");
    expect(ids).toContain("MESSAGE_SEND");
    expect(ids).toContain("CALENDAR_EVENT_CREATE");
  });

  it("sur le Centre de paiement : la décision de paiement est là, documentée (sémantique, risque)", () => {
    const sa = userWith("SUPER_ADMIN");
    const payments = actionsForUser(sa, "paiement");
    const decide = payments.find((a) => a.id === "PAYMENT_DECIDE");
    expect(decide).toBeDefined();
    expect(decide?.risk).toBe("SENSITIVE");
    expect(decide?.summary).toMatch(/canonique/);
  });
});
