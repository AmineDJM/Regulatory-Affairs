"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { DocxView, XlsxView, PptxView } from "./office-viewers";
import { BoutonTelecharger } from "@/components/telechargement/bouton-telecharger";
import { natureApercu, TAILLE_MAX_TEXTE_OCTETS, type NatureApercu } from "@/lib/formats/apercu";

/**
 * L'APERÇU UNIVERSEL — un seul composant, pour le Drive, les documents et les pièces (Direction, 06/10 :
 * « tous les formats lisibles, navigables, téléchargeables »). La NATURE du fichier vient d'une table unique
 * (`formats/apercu.ts`) ; ici, on dit seulement comment chaque nature s'affiche.
 *
 *   • les formats que le navigateur lit (image, vidéo, son, PDF) : tels quels ;
 *   • le texte (code, journaux, JSON, YAML, Markdown…) : en clair, tronqué au-delà de 1 Mo ;
 *   • le HTML : dans un cadre ISOLÉ (`sandbox=""`) — jamais exécuté dans l'application ;
 *   • Word / Excel / PowerPoint modernes : visionneuses du navigateur ;
 *   • les anciens formats et les formats « pas configurés » (.doc, .rtf, .odt, .ppt, .xls, .ods, .pages,
 *     .epub…) : rendus en PDF par l'éditeur Office (`apercuSrc`), puis affichés comme un PDF — lisibles,
 *     navigables, imprimables ;
 *   • tout le reste : jamais une page blanche — la phrase dit pourquoi et le téléchargement reste là.
 *
 * Le fichier d'origine n'est jamais modifié ; télécharger l'original est toujours possible.
 */
export function ApercuUniversel({
  src, apercuSrc, name, mime, telechargement,
}: {
  /** La route qui sert les octets du fichier. */
  src: string;
  /** La route qui sert l'aperçu PDF d'un format à convertir (Drive : `/api/drive/<id>/apercu`). */
  apercuSrc: string;
  name: string;
  mime?: string | null;
  /** L'adresse de téléchargement de l'original. */
  telechargement: string;
}) {
  const nature = natureApercu(name, mime);
  return <Rendu nature={nature} src={src} apercuSrc={apercuSrc} name={name} telechargement={telechargement} />;
}

function Rendu({ nature, src, apercuSrc, name, telechargement }: {
  nature: NatureApercu; src: string; apercuSrc: string; name: string; telechargement: string;
}) {
  switch (nature) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={name} className="mx-auto max-h-[78vh] rounded-lg object-contain" />;
    case "video":
      return <video src={src} controls className="mx-auto max-h-[78vh] w-full rounded-lg bg-black" />;
    case "audio":
      return <audio src={src} controls className="w-full" />;
    case "pdf":
      return <iframe src={src} title={name} className="h-[78vh] w-full rounded-lg border border-border bg-white" />;
    // LE SERVEUR D'ABORD (PC des utilisateurs limités) : Word, Excel et PowerPoint sont rendus en PDF par l'éditeur Office
    // et le PC n'affiche qu'un PDF. La visionneuse du navigateur n'est que le SECOURS (éditeur absent, en panne, refus).
    case "docx":
      return <VueConvertie apercuSrc={apercuSrc} name={name} telechargement={telechargement} secours={<DocxView src={src} name={name} />} />;
    case "xlsx":
      return <VueConvertie apercuSrc={apercuSrc} name={name} telechargement={telechargement} secours={<XlsxView src={src} name={name} />} />;
    case "pptx":
      return <VueConvertie apercuSrc={apercuSrc} name={name} telechargement={telechargement} secours={<PptxView src={src} name={name} />} />;
    case "texte":
      return <VueTexte src={src} name={name} telechargement={telechargement} />;
    case "html":
      return <VueHtml src={src} name={name} telechargement={telechargement} />;
    case "converti":
      return <VueConvertie apercuSrc={apercuSrc} name={name} telechargement={telechargement} />;
    default:
      return <SansApercu nom={name} telechargement={telechargement} raison="Ce type de fichier n'a pas d'aperçu (binaire, exécutable, format propriétaire)." />;
  }
}

/** Charge un fichier en texte ; l'erreur du serveur est rapportée telle quelle. */
function useTexte(url: string) {
  const [etat, setEtat] = React.useState<{ chargement: boolean; texte: string; tronque: boolean; erreur: string | null }>({ chargement: true, texte: "", tronque: false, erreur: null });
  React.useEffect(() => {
    let vivant = true;
    setEtat({ chargement: true, texte: "", tronque: false, erreur: null });
    fetch(url, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await messageDErreur(r));
        const tampon = await r.arrayBuffer();
        const tronque = tampon.byteLength > TAILLE_MAX_TEXTE_OCTETS;
        const texte = new TextDecoder("utf-8", { fatal: false }).decode(tronque ? tampon.slice(0, TAILLE_MAX_TEXTE_OCTETS) : tampon);
        if (vivant) setEtat({ chargement: false, texte, tronque, erreur: null });
      })
      .catch((e: unknown) => { if (vivant) setEtat({ chargement: false, texte: "", tronque: false, erreur: e instanceof Error ? e.message : "Lecture impossible." }); });
    return () => { vivant = false; };
  }, [url]);
  return etat;
}

async function messageDErreur(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string };
    if (j?.error) return j.error;
  } catch { /* corps non JSON */ }
  return `Lecture impossible (HTTP ${r.status}).`;
}

function Attente() {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Préparation de l&apos;aperçu…
    </div>
  );
}

function VueTexte({ src, name, telechargement }: { src: string; name: string; telechargement: string }) {
  const { chargement, texte, tronque, erreur } = useTexte(src);
  if (chargement) return <Attente />;
  if (erreur) return <SansApercu nom={name} telechargement={telechargement} raison={erreur} />;
  return (
    <div className="space-y-2">
      <pre className="max-h-[78vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed">{texte}</pre>
      {tronque && <p className="text-xs text-muted-foreground">Aperçu limité au premier mégaoctet : téléchargez le fichier pour le lire en entier.</p>}
    </div>
  );
}

function VueHtml({ src, name, telechargement }: { src: string; name: string; telechargement: string }) {
  const { chargement, texte, tronque, erreur } = useTexte(src);
  if (chargement) return <Attente />;
  if (erreur) return <SansApercu nom={name} telechargement={telechargement} raison={erreur} />;
  return (
    <div className="space-y-2">
      {/* sandbox="" : aucun script, aucun formulaire, aucune navigation — le HTML d'un tiers ne s'exécute pas ici. */}
      <iframe sandbox="" srcDoc={texte} title={name} className="h-[78vh] w-full rounded-lg border border-border bg-white" />
      {tronque && <p className="text-xs text-muted-foreground">Aperçu limité au premier mégaoctet : téléchargez le fichier pour le lire en entier.</p>}
    </div>
  );
}

function VueConvertie({ apercuSrc, name, telechargement, secours }: { apercuSrc: string; name: string; telechargement: string; secours?: React.ReactNode }) {
  const [etat, setEtat] = React.useState<{ chargement: boolean; url: string | null; erreur: string | null }>({ chargement: true, url: null, erreur: null });
  React.useEffect(() => {
    let vivant = true;
    let objet: string | null = null;
    setEtat({ chargement: true, url: null, erreur: null });
    fetch(apercuSrc, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await messageDErreur(r));
        const blob = await r.blob();
        objet = URL.createObjectURL(blob);
        if (vivant) setEtat({ chargement: false, url: objet, erreur: null });
      })
      .catch((e: unknown) => { if (vivant) setEtat({ chargement: false, url: null, erreur: e instanceof Error ? e.message : "Aperçu impossible." }); });
    return () => { vivant = false; if (objet) URL.revokeObjectURL(objet); };
  }, [apercuSrc]);
  if (etat.chargement) return <Attente />;
  // Le serveur n'a pas pu préparer le PDF : la visionneuse du navigateur prend le relais quand elle existe.
  if ((etat.erreur || !etat.url) && secours) return <>{secours}</>;
  if (etat.erreur || !etat.url) return <SansApercu nom={name} telechargement={telechargement} raison={etat.erreur ?? "Aperçu impossible."} />;
  return <iframe src={etat.url} title={name} className="h-[78vh] w-full rounded-lg border border-border bg-white" />;
}

/** JAMAIS UNE PAGE BLANCHE : la raison est dite, et le téléchargement de l'original reste à un clic. */
export function SansApercu({ nom, telechargement, raison }: { nom: string; telechargement: string; raison: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <p className="max-w-xl text-sm text-muted-foreground">{raison}</p>
      <BoutonTelecharger href={telechargement} nom={nom} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        <Download className="h-4 w-4" /> Télécharger le fichier
      </BoutonTelecharger>
    </div>
  );
}
