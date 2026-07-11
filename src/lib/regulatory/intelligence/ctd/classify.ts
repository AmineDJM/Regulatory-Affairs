import { CTD_SECTIONS, detectModule, type CtdModule, type CtdSection } from "./taxonomy";

/**
 * CLASSIFICATION CTD **déterministe** (pas d'IA) — Phase 3. Priorité aux preuves fortes :
 *   1. code CTD explicite dans le chemin/nom (ex. « m3/3.2.P.8-stab.pdf ») ;
 *   2. sinon mots-clés (nom + texte extrait) ;
 *   3. sinon module seul détecté (« module 3 ») ;
 *   4. sinon non classé.
 * Retourne toujours l'évidence (ce qui a déclenché) + une **proposition** de nom de fichier
 * (jamais imposée : le renommage définitif reste validé par un humain).
 */

export interface Classification {
  module: CtdModule | null;
  section: string | null; // code CTD
  title: string | null;
  confidence: number; // 0..1
  method: "code-path" | "keyword" | "module-only" | "none";
  evidence: string;
  suggestedFilename: string | null;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Garde les points (codes CTD) mais ramène les autres séparateurs à des espaces.
const codeHay = (s: string) => s.toLowerCase().replace(/[_\-/\\]+/g, " ").replace(/\s+/g, " ");
const norm = (s: string) => s.toLowerCase().replace(/[_\-/\\.]+/g, " ").replace(/\s+/g, " ");
const dots = (code: string) => (code.match(/\./g) ?? []).length;

function sanitizeBase(name: string): string {
  const noExt = name.replace(/\.[a-z0-9]{1,6}$/i, "");
  return noExt.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "document";
}

function suggestName(section: CtdSection | null, module: CtdModule | null, filename: string, ext: string): string | null {
  const base = sanitizeBase(filename);
  const suffix = ext ? `.${ext.toLowerCase()}` : "";
  if (section) return `${section.code} ${section.title} — ${base}${suffix}`.slice(0, 180);
  if (module) return `${module} — ${base}${suffix}`.slice(0, 180);
  return null;
}

export interface ClassifyInput {
  path: string;
  filename: string;
  ext: string;
  textSample?: string | null;
}

export function classifyDocument(input: ClassifyInput): Classification {
  const pathFile = `${input.path} ${input.filename}`;
  const hayCode = codeHay(pathFile);
  const haySquash = squash(pathFile);
  const nameNorm = norm(pathFile);
  const contentNorm = norm((input.textSample ?? "").slice(0, 8000));

  // 1) Code CTD explicite.
  let best: { section: CtdSection; alias: string } | null = null;
  for (const section of CTD_SECTIONS) {
    for (const alias of section.aliases) {
      const a = alias.toLowerCase();
      const hit = hayCode.includes(a) || (squash(a).length >= 3 && haySquash.includes(squash(a)));
      if (!hit) continue;
      if (!best || dots(section.code) > dots(best.section.code) || section.code.length > best.section.code.length) {
        best = { section, alias };
      }
    }
  }
  if (best) {
    return {
      module: best.section.module, section: best.section.code, title: best.section.title,
      confidence: 0.94, method: "code-path", evidence: `Code CTD « ${best.alias} » détecté dans le chemin/nom.`,
      suggestedFilename: suggestName(best.section, best.section.module, input.filename, input.ext),
    };
  }

  // 2) Mots-clés (nom + contenu ; le nom pèse davantage).
  let kwBest: { section: CtdSection; hits: string[]; score: number } | null = null;
  for (const section of CTD_SECTIONS) {
    const hits: string[] = [];
    let score = 0;
    for (const kw of section.keywords) {
      const k = norm(kw);
      if (nameNorm.includes(k)) { hits.push(kw); score += 3; }
      else if (contentNorm.includes(k)) { hits.push(kw); score += 1; }
    }
    if (score > 0 && (!kwBest || score > kwBest.score)) kwBest = { section, hits, score };
  }
  if (kwBest) {
    const confidence = Math.min(0.8, 0.5 + 0.07 * kwBest.score);
    return {
      module: kwBest.section.module, section: kwBest.section.code, title: kwBest.section.title,
      confidence: Number(confidence.toFixed(2)), method: "keyword",
      evidence: `Mots-clés : ${kwBest.hits.slice(0, 4).join(", ")}.`,
      suggestedFilename: suggestName(kwBest.section, kwBest.section.module, input.filename, input.ext),
    };
  }

  // 3) Module seul.
  const mod = detectModule(nameNorm);
  if (mod) {
    return {
      module: mod, section: null, title: null, confidence: 0.4, method: "module-only",
      evidence: `Module « ${mod} » détecté, section indéterminée.`,
      suggestedFilename: suggestName(null, mod, input.filename, input.ext),
    };
  }

  // 4) Non classé.
  return { module: null, section: null, title: null, confidence: 0, method: "none", evidence: "Aucun indice CTD fiable — classement manuel requis.", suggestedFilename: null };
}
