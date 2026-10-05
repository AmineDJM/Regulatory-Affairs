import { Lock, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { organisationsActiveesPour } from "@/lib/regulatory/intelligence/access";

/**
 * CARTE-GARDE de portée du Regulatory Intelligence OS — remplace les `notFound()` muets.
 *
 * `resolveRegCompanyIdFor` rend `null` dans des situations très différentes, et l'écran doit
 * dire LAQUELLE, sinon l'utilisateur voit une page morte sans savoir quoi faire :
 *   • le module est activé pour PLUSIEURS entités qui lui sont ouvertes et la vue est « Toutes
 *     les entités » → il suffit d'en choisir une dans la barre supérieure (on les nomme) ;
 *   • aucune entité activée (ou pas celle sélectionnée) → c'est un réglage Super Admin ;
 *   • le module est activé AILLEURS dans le groupe, pas dans les entités de la personne →
 *     le geste n'est pas de « sélectionner » une entité que son sélecteur ne propose pas, mais
 *     de demander l'accès à cette entité (§118.128 : un remède qui nomme un geste impossible
 *     fait chercher une panne qui n'existe pas). Cette troisième situation est née avec la
 *     validation de la portée (§118.177) : avant, le cookie n'était jamais vérifié.
 *
 * Un 404 ici n'est jamais le bon message : la page existe, c'est la portée qui manque.
 */
export async function RegScopeCard({ userId }: { userId: string }) {
  const { ouvertes, ailleurs } = await organisationsActiveesPour(userId);
  const companies = ouvertes.length
    ? await prisma.company.findMany({ where: { id: { in: ouvertes }, isActive: true }, select: { name: true }, orderBy: { name: "asc" } })
    : [];
  const names = companies.map((c) => c.name);

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4 text-amber-600" />
        {names.length > 1 ? "Choisissez une entité pour continuer" : "Module non activé pour cette entité"}
      </p>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
        {names.length > 1 ? (
          <>
            <p>
              Le module est activé pour <strong>{names.length} entités</strong> ({names.join(", ")}). Cet écran travaille
              sur <strong>une entité à la fois</strong> : sélectionnez-la dans la barre supérieure
              <Building2 className="mx-1 inline h-3.5 w-3.5 align-[-2px]" />
              (le sélecteur d&apos;entité), puis revenez ici.
            </p>
          </>
        ) : names.length === 1 ? (
          <p>
            Le module est activé pour <strong>{names[0]}</strong> uniquement. Sélectionnez cette entité dans la barre
            supérieure, puis revenez sur cette page.
          </p>
        ) : ailleurs > 0 ? (
          <p>
            Le module est activé pour une autre entité du groupe, pas pour celles qui vous sont ouvertes. L&apos;accès à
            une autre entité se donne sur votre fiche salarié, par les ressources humaines : Ressources humaines → votre
            fiche → « Accès aux entités ».
          </p>
        ) : (
          <p>
            Aucune entité n&apos;a le module activé. Le Regulatory Intelligence OS se débloque <strong>par
            organisation</strong>, par le Super Admin : Administration → Réglages → « Regulatory Intelligence OS ».
          </p>
        )}
      </div>
    </div>
  );
}
