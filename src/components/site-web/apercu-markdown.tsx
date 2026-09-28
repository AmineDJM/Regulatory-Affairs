import * as React from "react";
import { apercu, type BlocApercu, type Segment } from "@/lib/site-web/markdown";

/**
 * L'APERÇU D'UN ARTICLE — rendu à partir de BLOCS TYPÉS (`markdown.ts`), jamais d'HTML injecté.
 * Un corps d'article est saisi par une personne mais il sera lu par le public : un `<script>` ou
 * un lien `javascript:` collé par mégarde reste ici du TEXTE, visible, donc corrigeable, et inerte.
 *
 * C'est un aperçu de STRUCTURE (titres, listes, liens, emphase), pas la page du site : la
 * typographie finale est celle du site, et on ne prétend pas la reproduire.
 */
function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.t === "gras") return <strong key={i}>{s.v}</strong>;
        if (s.t === "italique") return <em key={i}>{s.v}</em>;
        if (s.t === "code") return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{s.v}</code>;
        if (s.t === "lien") {
          const externe = /^https?:/i.test(s.href);
          return (
            <a key={i} href={s.href} className="text-primary underline" {...(externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {s.v}
            </a>
          );
        }
        return <React.Fragment key={i}>{s.v}</React.Fragment>;
      })}
    </>
  );
}

function Bloc({ b }: { b: BlocApercu }) {
  if (b.t === "titre") {
    const classe = b.niveau <= 2 ? "mt-5 text-lg font-semibold" : "mt-4 text-base font-semibold";
    return b.niveau <= 2
      ? <h2 className={classe}><Segments segments={b.segments} /></h2>
      : <h3 className={classe}><Segments segments={b.segments} /></h3>;
  }
  if (b.t === "paragraphe") return <p className="mt-3 leading-relaxed"><Segments segments={b.segments} /></p>;
  if (b.t === "citation") {
    return <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground"><Segments segments={b.segments} /></blockquote>;
  }
  if (b.t === "code") return <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs"><code>{b.texte}</code></pre>;
  if (b.t === "separateur") return <hr className="my-5 border-border" />;
  const Liste = b.ordonnee ? "ol" : "ul";
  return (
    <Liste className={b.ordonnee ? "mt-3 list-decimal space-y-1 pl-6" : "mt-3 list-disc space-y-1 pl-6"}>
      {b.elements.map((e, i) => <li key={i}><Segments segments={e} /></li>)}
    </Liste>
  );
}

export function ApercuMarkdown({ titre, corps }: { titre: string; corps: string }) {
  const blocs = React.useMemo(() => apercu(corps), [corps]);
  return (
    <article className="min-w-0 break-words text-sm text-foreground">
      <h1 className="text-xl font-semibold tracking-tight">{titre || "Sans titre"}</h1>
      {blocs.length === 0
        ? <p className="mt-3 text-muted-foreground">Le corps de l&apos;article est vide.</p>
        : blocs.map((b, i) => <Bloc key={i} b={b} />)}
    </article>
  );
}
