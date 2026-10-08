"use client";

import * as React from "react";
import { Package } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { EntreeMenu, MenuPlus } from "@/app/(app)/medical/menu-plus";
import { CatalogueArticles, type SupplyArticleRow } from "../demandes/supplies-manager";

/**
 * « ⋯ » DE L'EN-TÊTE DES MOYENS GÉNÉRAUX (Direction, 09/10) — un geste principal visible (« Ajouter une dépense »), le
 * reste derrière ce menu. Aujourd'hui : le catalogue d'articles, le même que celui du Bureau du secrétariat.
 *
 * Le panneau du catalogue vit ICI, hors du menu : un menu qui se referme au clic démonterait le panneau qu'il vient d'ouvrir.
 */
export function EnteteMenu({ articles, peutModifier }: { articles: SupplyArticleRow[]; peutModifier: boolean }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <>
      <MenuPlus label="Autres actions">
        <EntreeMenu onClick={() => setOuvert(true)}><Package className="h-4 w-4 text-muted-foreground" /> Catalogue d&apos;articles</EntreeMenu>
      </MenuPlus>
      <Sheet open={ouvert} onClose={() => setOuvert(false)} title="Catalogue d'articles" width="lg">
        <CatalogueArticles key={ouvert ? "ouvert" : "ferme"} articles={articles} peutModifier={peutModifier} />
      </Sheet>
    </>
  );
}
