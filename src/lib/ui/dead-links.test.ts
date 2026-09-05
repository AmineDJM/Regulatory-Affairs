import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { entityHref } from "@/lib/entity-href";

/**
 * UN LIEN VERS UNE PAGE QUI N'EXISTE PAS — le 404 « en plein milieu ».
 *
 * ── CE QUE C'EST, VU DE L'UTILISATEUR ───────────────────────────────────────────────────────
 *
 * On clique « Traiter » dans une notification, ou « Voir le dossier » dans une carte, et l'on
 * tombe sur une page blanche « 404 – This page could not be found ». Ce n'est jamais un bogue
 * de la page d'arrivée : c'est un lien écrit à la main vers une route qu'on a renommée, déplacée
 * ou jamais créée. Le typage ne le voit pas — une route est une chaîne — et le build non plus.
 *
 * ── CE QUE CE FICHIER TIENT ─────────────────────────────────────────────────────────────────
 *
 * Il relève tous les chemins internes ÉCRITS EN DUR dans le code (`href="/…"`, `redirect("/…")`,
 * `link: "/…"`, `router.push("/…")`, `href: "/…"`…) et les confronte à l'inventaire réel des
 * `page.tsx`. Un segment dynamique (`[id]`) accepte n'importe quelle valeur ; un chemin construit
 * par gabarit (`/rh/${id}`) est comparé sur sa partie fixe, la variable tenant lieu de segment.
 *
 * Les chemins vers `/api/…` sont hors de portée : ce sont des routes serveur (`route.ts`), pas
 * des pages, et un lien vers un téléchargement `/api/…` est légitime.
 */

const RACINE = path.join(process.cwd(), "src");
const APP = path.join(RACINE, "app");

function fichiers(dir: string, ext: readonly string[], acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      fichiers(p, ext, acc);
    } else if (ext.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

/**
 * L'INVENTAIRE DES ROUTES — chaque `page.tsx`, les groupes `(app)` retirés, les segments
 * dynamiques `[x]` et attrape-tout `[...x]` devenus des motifs.
 */
function routesConnues(): RegExp[] {
  return fichiers(APP, ["page.tsx"])
    .map((f) => path.dirname(path.relative(APP, f)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s)))
    .map((segs) => {
      const motif = segs.map((s) => {
        if (/^\[\.\.\..+\]$/.test(s)) return ".+";
        if (/^\[.+\]$/.test(s)) return "[^/]+";
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("/");
      return new RegExp(`^/${motif}/?$`);
    });
}

/**
 * LES CHEMINS ÉCRITS EN DUR — et seulement eux.
 *
 * On lit les attributs et propriétés qui deviennent une navigation : `href`, `link`, `redirect(`,
 * `router.push(`, `router.replace(`, `redirectBase`. Un gabarit (`/rh/${x}`) est ramené à sa
 * partie fixe + un segment libre ; une chaîne qui s'arrête sur un `${` en plein segment
 * (`/rh/${x}/paie`) est comparée segment par segment, la variable valant `[^/]+`.
 */
const CIBLES = /(?:href|link|redirectBase|to)\s*[=:]\s*(?:\{)?\s*(["'`])(\/[^"'`\s]*)\1|(?:redirect|router\.push|router\.replace|permanentRedirect)\(\s*(["'`])(\/[^"'`\s)]*)\3/g;

function cheminsCites(src: string): { chemin: string; index: number }[] {
  const out: { chemin: string; index: number }[] = [];
  for (const m of src.matchAll(CIBLES)) {
    const brut = (m[2] ?? m[4] ?? "").split(/[?#]/)[0];
    if (!brut || brut === "/") continue;
    // `redirectBase` n'est pas une destination : `RecordForm` navigue vers `${base}/${id}`
    // après création. C'est donc `<base>/<segment>` qu'il faut trouver dans l'inventaire.
    const chemin = /^redirectBase/.test(m[0]) ? `${brut.replace(/\/$/, "")}/\${id}` : brut;
    out.push({ chemin, index: m.index ?? 0 });
  }
  return out;
}

/** Un chemin cité correspond-il à une page ? Les `${…}` d'un gabarit valent un segment libre. */
function correspond(chemin: string, routes: RegExp[]): boolean {
  const normalise = chemin
    .replace(/\$\{[^}]*\}/g, "__VAR__")
    .replace(/\/+$/, "");
  // UN GABARIT N'EST VALIDE QUE SUR UN SEGMENT DYNAMIQUE. `/ad-pro/${id}` ne correspond PAS à
  // `/ad-pro/autres` : la variable tombe là où la route attend un mot fixe, et c'est un 404 à
  // chaque clic. On instancie donc la variable par une valeur neutre et l'on exige une route
  // qui l'accepte — c'est-à-dire un `[id]` à cet endroit.
  return routes.some((r) => r.test(normalise.replace(/__VAR__/g, "x") || "/"));
}

const HORS_PORTEE = /^\/(api|_next|manifest|icon|sw\.js|offline|favicon)/;

describe("aucun lien écrit en dur ne mène à une page qui n'existe pas", () => {
  it("chaque href / redirect / link / push cite une route de l'inventaire", () => {
    const routes = routesConnues();
    expect(routes.length).toBeGreaterThan(100);

    const morts: string[] = [];
    for (const fichier of fichiers(RACINE, [".ts", ".tsx"])) {
      if (fichier.endsWith(".test.ts") || fichier.endsWith(".test.tsx")) continue;
      const src = fs.readFileSync(fichier, "utf8");
      for (const { chemin, index } of cheminsCites(src)) {
        if (HORS_PORTEE.test(chemin)) continue;
        if (correspond(chemin, routes)) continue;
        const ligne = src.slice(0, index).split("\n").length;
        morts.push(`${path.relative(process.cwd(), fichier)}:${ligne} → ${chemin}`);
      }
    }

    expect(
      morts,
      `LIENS VERS UNE PAGE INEXISTANTE (404 en plein parcours) :\n${morts.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * LA TABLE DES ROUTES D'ENTITÉ — hors de portée du relevé ci-dessus, et pourtant la plus lue.
   *
   * `entityHref` rend ses chemins par `return` de gabarit : aucun `href=` ne l'entoure, le relevé
   * ne la voit pas. Or c'est elle que le centre de paiement, la fiche 360, les notifications et
   * les blocs d'Adam consultent pour ouvrir « la demande d'origine ». `/ad-pro/${id}` y a vécu
   * sans qu'aucune page n'existe : chaque clic sur un poste de dépense finissait en 404.
   */
  it("chaque route de `entityHref` correspond à une page de l'inventaire", () => {
    const routes = routesConnues();
    const src = fs.readFileSync(path.join(RACINE, "lib/entity-href.ts"), "utf8");
    const types = [...src.matchAll(/case "([A-Z_]+)":/g)].map((m) => m[1]);
    expect(types.length).toBeGreaterThan(15);
    const morts = types
      .map((t) => [t, entityHref(t, "x")] as const)
      .filter(([, href]) => href && !correspond(href.split(/[?#]/)[0], routes))
      .map(([t, href]) => `${t} → ${href}`);
    expect(morts, `ROUTES D'ENTITÉ SANS PAGE :\n${morts.join("\n")}`).toEqual([]);
  });
});
