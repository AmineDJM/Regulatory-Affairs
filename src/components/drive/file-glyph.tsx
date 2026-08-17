import * as React from "react";
import { Folder, FileType, Sheet, Presentation, FileText, FileArchive, FileImage, FileVideo, FileAudio, FileCode2, Mail, PencilRuler, File } from "lucide-react";
import { fileGlyph, type FileFamily } from "@/lib/drive/file-glyph";
import { cn } from "@/lib/utils";

/**
 * L'APPARENCE D'UN TYPE DE FICHIER — forme, couleur, extension.
 *
 * Chaque famille reçoit SA forme ET SA couleur, celles que tout le monde a déjà en tête : Word
 * bleu, Excel vert, PowerPoint orange, PDF rouge, archive ambre, image violette. La couleur seule
 * ne suffirait pas — elle ne dit rien à qui la distingue mal, et disparaît à l'impression ; la
 * forme seule ne suffit pas non plus — c'est précisément ce qui se ressemblait. Les deux
 * ensemble se reconnaissent sans lire.
 *
 * Les classes de style vivent ICI et pas dans le module pur : l'outil de style n'inspecte que
 * `src/components` et `src/app`. Une couleur écrite dans `src/lib` serait supprimée à la
 * compilation, et l'icône sortirait grise sans que rien ne le signale.
 */
const LOOK: Record<FileFamily, { Glyph: React.ComponentType<{ className?: string }>; fg: string; bg: string }> = {
  folder: { Glyph: Folder, fg: "text-amber-500", bg: "bg-amber-500/15" },
  word: { Glyph: FileType, fg: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  excel: { Glyph: Sheet, fg: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  slides: { Glyph: Presentation, fg: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/15" },
  pdf: { Glyph: FileText, fg: "text-red-600 dark:text-red-400", bg: "bg-red-500/15" },
  archive: { Glyph: FileArchive, fg: "text-amber-600 dark:text-amber-400", bg: "bg-amber-600/15" },
  image: { Glyph: FileImage, fg: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/15" },
  video: { Glyph: FileVideo, fg: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/15" },
  audio: { Glyph: FileAudio, fg: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-500/15" },
  text: { Glyph: FileText, fg: "text-slate-600 dark:text-slate-300", bg: "bg-slate-500/15" },
  code: { Glyph: FileCode2, fg: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/15" },
  mail: { Glyph: Mail, fg: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/15" },
  cad: { Glyph: PencilRuler, fg: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/15" },
  unknown: { Glyph: File, fg: "text-muted-foreground", bg: "bg-muted" },
};

export interface FileGlyphProps {
  name: string;
  isFile: boolean;
  /** `sm` = pastille de ligne de liste · `lg` = tuile de la vue en grandes icônes. */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * La pastille d'un fichier ou d'un dossier.
 *
 * En taille `lg`, l'extension s'écrit sous l'icône : c'est la vue où l'on cherche du regard, et
 * où « DOCX » distingue immédiatement deux archives ou deux images qu'un pictogramme rapproche.
 * En taille `sm`, la ligne porte déjà la colonne « Type » — répéter l'extension l'encombrerait.
 */
export function FileGlyph({ name, isFile, size = "sm", className }: FileGlyphProps) {
  const { family, badge } = fileGlyph(name, isFile);
  const { Glyph, fg, bg } = LOOK[family];

  if (size === "lg") {
    return (
      <span className={cn("inline-flex flex-col items-center gap-1", className)}>
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", bg)}>
          <Glyph className={cn("h-7 w-7", fg)} />
        </span>
        {badge && <span className={cn("text-[0.5625rem] font-semibold uppercase tracking-wide", fg)}>{badge}</span>}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", bg, className)}>
      <Glyph className={cn("h-4 w-4", fg)} />
    </span>
  );
}
