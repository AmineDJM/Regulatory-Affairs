"use client";

import type { DirectSpec } from "@/components/layout/background-upload";
import type { LimitesEnvoi } from "@/components/layout/use-limites-envoi";
import type { PlanClient } from "@/lib/storage/envoi-direct-client";
import { refusTeleversement } from "@/lib/files/politique-televersement";
import { refusSansStockageObjet } from "@/lib/storage/phrases-stockage";

/** Où va le fichier dans le Drive — les mêmes champs que le chemin habituel. */
export interface CibleDrive {
  nodeId?: string | null;
  parentId?: string | null;
  spaceId?: string | null;
  category?: string | null;
  viewers?: string[];
  editors?: string[];
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Le serveur a répondu ${res.status}.`);
  return body;
}

/**
 * Ce que le Drive ajoute à un envoi : le REFUS dit avant d'envoyer (type, taille, et la phrase
 * qui nomme les variables à poser quand un très gros fichier n'a nulle part où aller), et l'envoi
 * DIRECT au bucket au-delà du seuil. Sans limites (serveur muet), on n'empêche rien : le serveur
 * reste la garde.
 */
export function envoiDrive(cible: CibleDrive, limites: LimitesEnvoi | null): { refus?: (f: File) => string | null; direct?: (f: File) => DirectSpec | null } {
  if (!limites) return {};
  return {
    refus: (f) => refusTeleversement(f.name, f.size, limites.maxDriveUploadMb)
      ?? (!limites.stockageObjet && f.size > limites.maxSansStockageObjetMo * 1024 * 1024
        ? refusSansStockageObjet(f.size, limites.maxSansStockageObjetMo) : null),
    direct: (f) => {
      if (!limites.stockageObjet || f.size < limites.seuilDirectOctets) return null;
      return {
        ouvrir: async () => {
          try {
            const r = await json<{ sessionId: string; plan: PlanClient }>(await fetch("/api/drive/upload/direct", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, ...cible }),
            }));
            return { sessionId: r.sessionId, plan: r.plan };
          } catch (e) { return { error: e instanceof Error ? e.message : "Ouverture impossible." }; }
        },
        replanifier: async (id) => (await json<{ plan: PlanClient }>(await fetch(`/api/drive/upload/direct/${id}`, { cache: "no-store" }))).plan,
        finaliser: async (id) => {
          const res = await fetch(`/api/drive/upload/direct/${id}`, { method: "POST" });
          const b = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; reprendre?: boolean };
          return res.ok && b.ok ? { ok: true as const } : { ok: false as const, error: b.error ?? `Finalisation refusée (${res.status}).`, reprendre: b.reprendre };
        },
        abandonner: async (id) => { await fetch(`/api/drive/upload/direct/${id}`, { method: "DELETE" }).catch(() => undefined); },
      };
    },
  };
}
