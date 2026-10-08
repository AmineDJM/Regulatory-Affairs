import type { ReactNode } from "react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/utils";
import { directionsRegionales, etablissementsARattacher, fournisseursParProduit, fraicheurPch, importsPch, postesNosMolecules } from "@/lib/ventes-pch/requetes";
import { moisCourt } from "@/lib/ventes-pch/calculs";
import { InfoBulle } from "@/components/ui/info-bulle";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EnteteVentesPch, BandeauFraicheur } from "../entete";
import { TeleverserPch, RattacherEtablissements, RattacherPostes, FournisseursNous, DirectionsRegionalesPch } from "./gestes";

export const dynamic = "force-dynamic";

function Section({ id, titre, compte, aide, children }: { id: string; titre: string; compte?: number; aide: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titre}{compte !== undefined && compte > 0 && <Badge tone="warning">{formatNumber(compte)}</Badge>}
        <InfoBulle>{aide}</InfoBulle>
      </h2>
      {children}
    </section>
  );
}

/**
 * VENTES PCH › IMPORTER — déposer les fichiers du mois (ventes de chaque DR, réceptions de la PCH centrale), voir
 * l'aperçu, appliquer ; puis rattacher ce que la lecture n'a pas pu relier à coup sûr : clients → établissements,
 * postes PCH → nos produits, fournisseurs « à nous », directions régionales.
 */
export default async function ImporterVentesPchPage() {
  const user = await requireModule("PCH_VENTES");
  const peutTeleverser = userCan(user, "PCH_VENTES", "UPLOAD");
  const peutModifier = userCan(user, "PCH_VENTES", "UPDATE");
  const [fraicheur, imports, aRattacher, postes, fournisseurs, drs, etabs] = await Promise.all([
    fraicheurPch(), importsPch(), etablissementsARattacher(), postesNosMolecules(), fournisseursParProduit(), directionsRegionales(),
    peutModifier ? prisma.medicalInstitution.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, wilaya: true } }) : Promise.resolve([]),
  ]);
  const postesAFaire = postes.filter((p) => !p.productId && !p.manuel).length;

  return (
    <div className="space-y-6">
      <EnteteVentesPch user={user} />
      <BandeauFraicheur sources={fraicheur.sources} />

      {peutTeleverser && (
        <Section id="deposer" titre="Déposer" aide="Ventes d'une direction régionale (VENTEDRA.xls, VENTEDRO.xls…) ou réceptions de la PCH centrale (Reception2025.xlsx). La nature et la période se lisent dans le fichier. Le même fichier ne fait rien ; un fichier plus récent pour la même DR et le même mois remplace ce mois ; un fichier annuel de réceptions remplace l'année. Le fichier original est gardé.">
          <TeleverserPch />
        </Section>
      )}

      <Section id="etablissements" titre="Établissements à rattacher" compte={aRattacher.total} aide="Clients des directions régionales qu'aucun établissement de l'annuaire ne désigne à coup sûr. Un rattachement s'applique à toutes leurs lignes et se mémorise pour les fichiers suivants.">
        <RattacherEtablissements liste={aRattacher.liste} etablissements={etabs.map((e) => ({ id: e.id, nom: e.name, wilaya: e.wilaya }))} peutModifier={peutModifier} />
        {aRattacher.total > aRattacher.liste.length && <p className="text-xs text-muted-foreground">Les {aRattacher.liste.length} plus fréquents sur {formatNumber(aRattacher.total)}.</p>}
      </Section>

      <Section id="postes" titre="Postes PCH de nos molécules" compte={postesAFaire} aide="Le poste est le code produit de la PCH, le même dans toutes les DR et dans les réceptions. Reconnu : la DCI, le dosage et la forme désignent un seul de nos produits. Confirmer fige le rattachement (il ne bougera plus aux imports suivants).">
        <RattacherPostes postes={postes} peutModifier={peutModifier} />
      </Section>

      <Section id="fournisseurs" titre="Nos fournisseurs à la PCH" aide="Les réceptions FO de ces fournisseurs sont notre sell-in et notre part de marché. Proposés quand le nom reprend le laboratoire partenaire, le détenteur de la décision ou le fabricant d'un dossier ; cochez ou décochez pour corriger.">
        <FournisseursNous liste={fournisseurs} peutModifier={peutModifier} />
      </Section>

      <Section id="dr" titre="Directions régionales" aide="Les wilayas d'une DR sont déduites des établissements rattachés de ses fichiers ; le libellé et la liste se corrigent ici.">
        <DirectionsRegionalesPch drs={drs} peutModifier={peutModifier} />
      </Section>

      <Section id="historique" titre="Fichiers importés" aide="Les derniers fichiers. « Remplacé » : un fichier plus récent porte désormais tous ses mois ; il reste gardé.">
        {imports.length === 0 ? <p className="text-sm text-muted-foreground">Aucun fichier importé.</p> : (
          <div className="surface overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Fichier</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Lignes</TableHead>
                  <TableHead>Importé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((i) => (
                  <TableRow key={i.id} className={i.remplaceParId ? "opacity-60" : undefined}>
                    <TableCell className="sticky left-0 z-10 min-w-[200px] bg-card [overflow-wrap:anywhere]">
                      <a href={`/api/ventes-pch/fichier/${i.id}`} className="text-primary hover:underline">{i.nomFichier}</a>
                      {i.remplaceParId && <Badge tone="neutral" className="ml-1.5">remplacé</Badge>}
                    </TableCell>
                    <TableCell>{i.nature === "RECEPTIONS" ? "Réceptions" : i.sources.join(", ")}</TableCell>
                    <TableCell>
                      {i.annuel ? `année ${i.periodeAnnee ?? i.mois[0]?.slice(0, 4) ?? ""}` : i.mois.map(moisCourt).join(", ")}
                      {i.periodeChoisie && <Badge tone="info" className="ml-1.5">choisie</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(i.lignes)}</TableCell>
                    <TableCell className="text-muted-foreground">{i.createdAt.toLocaleDateString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
