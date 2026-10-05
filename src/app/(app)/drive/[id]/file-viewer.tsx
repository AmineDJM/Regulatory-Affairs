"use client";

import { ZipViewer } from "@/components/documents/zip-viewer";
import { ApercuUniversel } from "@/components/documents/apercu-universel";
import { extensionDe } from "@/lib/formats/apercu";

/**
 * La visionneuse d'un fichier du Drive. Le choix de l'aperçu ne se fait plus ici : il vient de la table
 * unique `formats/apercu.ts`, partagée avec la fenêtre des documents — un format ajouté à l'une l'est à
 * l'autre. Les anciens formats Office (.doc, .rtf, .ppt, .xls, .odt…) sont rendus en PDF par l'éditeur ;
 * un fichier sans aperçu possible dit pourquoi et propose le téléchargement (jamais une page blanche).
 */
export function FileViewer({ id, name }: { id: string; name: string; kind?: string }) {
  const src = `/api/drive/${id}/raw`;
  // Archive ZIP → visionneuse dédiée (naviguer + visualiser l'intérieur sans décompresser).
  if (extensionDe(name) === "zip") return <ZipViewer id={id} name={name} />;
  return <ApercuUniversel src={src} apercuSrc={`/api/drive/${id}/apercu`} name={name} telechargement={`${src}?dl=1`} />;
}
