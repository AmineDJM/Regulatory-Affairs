"use client";

import * as React from "react";
import { Eye, EyeOff, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * L'APERÇU D'UNE PIÈCE ÉMISE PAR LA PLATEFORME, SUR SA FICHE (§118.209).
 *
 * « Si le BC est généré hors Ad & Pro, par exemple dans Legal, quand on en crée un, il doit S'AFFICHER, pas
 * juste se sauvegarder dans Legal et qu'on aille le rechercher » (Direction, 05/10). Le composeur renvoyait
 * trois liens dans un panneau qui se refermait ; la pièce, elle, n'apparaissait nulle part. Désormais
 * l'émission mène à sa fiche, et ce bloc y montre le PDF — ouvert à l'arrivée (`?emis=1`), repliable ensuite.
 *
 * Le PDF se lit sous la porte de la PIÈCE (`/api/legal/<id>/fichier`) : un fichier du Drive personnel de
 * l'émetteur répondait 403 à tous les autres lecteurs de la pièce (§118.152). Le cadre n'est monté que
 * quand le bloc est ouvert — une fiche qu'on ouvre pour autre chose ne paie pas le chargement d'un PDF.
 */
export function ApercuPieceEmise({ titre, pdf, word, excel, ouvertParDefaut }: {
  titre: string;
  /** L'adresse du PDF — `null` : la fabrique n'en a pas produit (le Word fait foi). */
  pdf: string | null;
  word: string | null;
  excel: string | null;
  ouvertParDefaut: boolean;
}) {
  const [ouvert, setOuvert] = React.useState(ouvertParDefaut && pdf !== null);
  return (
    <Card data-apercu-piece-emise>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Aperçu de la pièce</span>
          <span className="flex flex-wrap items-center gap-2 text-sm font-normal">
            {pdf && (
              <Button type="button" variant="outline" size="sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
                {ouvert ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {ouvert ? "Masquer l'aperçu" : "Afficher l'aperçu"}
              </Button>
            )}
            {pdf && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`${pdf}&dl=1`}><Download className="h-3.5 w-3.5" /> PDF</a>}
            {word && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={word}><Download className="h-3.5 w-3.5" /> Word</a>}
            {excel && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={excel}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</a>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pdf ? (
          ouvert ? (
            <iframe src={pdf} title={`Aperçu — ${titre}`} className="h-[75vh] w-full rounded-lg border border-border bg-white" />
          ) : (
            <p className="text-xs text-muted-foreground">Le PDF de la pièce s&apos;affiche ici, sans quitter la fiche.</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">Aucun PDF n&apos;a pu être produit pour cette pièce : le Word fait foi.</p>
        )}
      </CardContent>
    </Card>
  );
}
