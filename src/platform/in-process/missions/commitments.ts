import { notifyUser } from "@/lib/notify";
import { relancerPersonne } from "@/platform/in-process/missions/relance";
import { conduire, facteursRelance } from "@/lib/missions/commitments/proactivity";
import { aRelancer, noterRelance, proprietairesARelancer, relancesDeduites } from "@/lib/missions/commitments/satisfy";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RELANCES D'ENGAGEMENTS (§29-32, §85-88) — et la moitié qui manquait.
 *
 * ── CE QUI EXISTAIT, ET CE QUI N'EXISTAIT PAS ───────────────────────────────────────────
 *
 * Un engagement se CRÉE (« Redouane doit envoyer son contrat avant vendredi ») et se SATISFAIT
 * tout seul quand le fait arrive : `satisfaireEngagements` est appelée par le registre
 * d'événements, et elle marche. Ce qui manquait est la situation exactement inverse — le fait
 * n'arrive PAS. `aRelancer`, `doitRelancer`, `noterRelance` et `facteursRelance` savaient tous
 * quoi faire, et personne ne les appelait : la promesse non tenue restait ouverte en silence.
 *
 * ── POURQUOI CE N'EST PAS « ENVOYER UN RAPPEL TOUS LES JOURS » ──────────────────────────
 *
 * Parce qu'une notification quotidienne sur la même promesse est le moyen le plus sûr de faire
 * ignorer TOUTES les notifications. Deux garde-fous, écrits ailleurs et seulement composés ici :
 *
 *   `doitRelancer`   — l'espacement CROÎT (1, 3, 5… jusqu'à 14 jours). Quelqu'un qui n'a pas
 *                      répondu à trois rappels ne répondra pas au quatrième le lendemain.
 *   `conduire`       — l'arbitrage impact / urgence / confiance / coût d'attention. `SE_TAIRE`
 *                      est une issue à part entière, et c'est celle qui rend les autres
 *                      crédibles : un système qui parle toujours ne dit jamais rien.
 *
 * ── QUI EST RELANCÉ, ET QUI NE L'EST PAS ───────────────────────────────────────────────
 *
 * La PERSONNE QUI A PROMIS, d'abord — par un message interne signé Adam (`relancerPersonne`,
 * la même échelle que les attentes de mission : personne, personne, hiérarchie). Prévenir le
 * dirigeant « Redouane n'a toujours pas envoyé son contrat. Voulez-vous relancer ? » lui
 * transférait la micro-décision la plus évidente ; un chef de cabinet relance lui-même et ne
 * vient vous voir que quand cela n'a rien donné. Le dirigeant est donc prévenu dans DEUX cas
 * seulement : l'échelle est épuisée, ou la promesse ne désigne aucun compte interne.
 *
 * Ce qu'on n'écrit JAMAIS depuis un battement : un message à l'EXTÉRIEUR (partenaire,
 * autorité). Une relance externe engage l'entreprise ; elle passe par un plan et un accord.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface BalayageRelances {
  personnes: number;
  candidats: number;
  /** Ce qu'on a effectivement signalé. */
  signales: number;
  /** Ce qu'on a délibérément tu — l'enjeu ne justifiait pas l'interruption. */
  tus: number;
}

/** Combien de jours de retard, à partir de la référence que `doitRelancer` a déjà retenue. */
function retard(dueAt: Date | null, promisedAt: Date | null, maintenant: Date): number {
  const ref = dueAt ?? promisedAt;
  if (!ref) return 0;
  return Math.max(0, (maintenant.getTime() - ref.getTime()) / (24 * 3600 * 1000));
}

/**
 * FAIT LE TOUR DES PROMESSES EN RETARD.
 *
 * Ne lève jamais : une relance impossible ne doit pas emporter le battement, qui fait aussi
 * tourner les missions, l'ingestion et l'analyse réglementaire.
 */
export async function relancerEngagements(
  maintenant = new Date(),
  opts: { personnes?: number; parPersonne?: number } = {},
): Promise<BalayageRelances> {
  const out: BalayageRelances = { personnes: 0, candidats: 0, signales: 0, tus: 0 };

  let ids: string[] = [];
  try {
    ids = await proprietairesARelancer(maintenant, opts.personnes ?? 25);
  } catch (e) {
    console.error("[engagements] file de relance illisible", e);
    return out;
  }

  for (const ownerId of ids) {
    out.personnes += 1;
    try {
      const candidats = (await aRelancer(ownerId, maintenant)).slice(0, opts.parPersonne ?? 10);
      for (const { engagement } of candidats) {
        out.candidats += 1;

        const jours = retard(engagement.dueAt, engagement.promisedAt, maintenant);
        const dejaRelance = relancesDeduites(engagement.dueAt ?? engagement.promisedAt, engagement.lastNudgeAt);
        const decision = conduire(facteursRelance({
          joursDeRetard: jours,
          relancesDeja: dejaRelance,
          // ── LA CONFIANCE VIENT DE L'IDENTITÉ, ET DE RIEN D'AUTRE ─────────────────────
          //
          // Un engagement rattaché à une identité CANONIQUE (`personId`) désigne quelqu'un
          // sans ambiguïté : c'est un TROUVÉ au sens de §9, et l'on peut le nommer. Un
          // engagement qui ne porte qu'un nom libre — « Redouane » — est un DÉDUIT : il y a
          // peut-être deux Redouane, et le nom a peut-être été extrait d'une phrase.
          //
          // `conduire` fait taire toute confiance inférieure à 0,5, et c'est exactement la
          // règle qu'on veut ici : annoncer au PDG « Redouane n'a toujours pas envoyé son
          // contrat » quand ce n'était pas ce Redouane-là est pire que ne rien dire. La
          // promesse reste visible dans son espace de travail ; elle ne déclenche simplement
          // pas de notification.
          //
          // Écrire `true` en dur ici — ce qu'a fait la première version — rendait cette
          // branche INATTEIGNABLE : l'arbitrage devenait décoratif, et seul l'espacement de
          // `doitRelancer` freinait encore. Un sabotage l'a montré, en ne cassant aucun test.
          engagementExplicite: Boolean(engagement.personId),
        }));

        if (decision.conduite === "SE_TAIRE") {
          out.tus += 1;
          continue;
        }
        // ── ADAM RELANCE D'ABORD LA PERSONNE QUI A PROMIS, pas le dirigeant ──────────────
        //
        // « Voulez-vous relancer ? » transférait au dirigeant la micro-décision la plus
        // évidente. Quand la promesse est celle d'un compte interne, l'échelle de relances
        // s'applique (personne, personne, hiérarchie) ; le dirigeant n'est prévenu qu'au-delà,
        // ou quand la promesse vient de l'extérieur.
        if (engagement.personId) {
          const r = await relancerPersonne({
            personneId: engagement.personId, barreau: dejaRelance + 1, pour: "la direction",
            objet: engagement.what, contexte: "engagement pris", jours: Math.floor(jours),
          });
          if (r) {
            await noterRelance(engagement.id, maintenant);
            out.signales += 1;
            continue;
          }
        }

        // ── LE DIRIGEANT : échelle épuisée, ou personne d'interne à relancer ─────────────
        //
        // Le message dit ce qui a été FAIT et ce qu'il reste à DÉCIDER — pas « voulez-vous
        // relancer ? » après trois relances restées sans réponse.
        const echelleEpuisee = Boolean(engagement.personId) && dejaRelance > 0;
        await notifyUser({
          userId: ownerId,
          type: "GENERIC",
          title: `Toujours en attente — ${engagement.who}`,
          body: `${engagement.what} — ${Math.floor(jours)} jour(s) de retard`
            + (dejaRelance > 0 ? `, ${dejaRelance} rappel(s) déjà passé(s)` : "")
            + (echelleEpuisee
              ? ". Mes relances sont restées sans réponse : à vous de trancher (relancer autrement, réassigner, ou clore)."
              : ". Cette personne n'a pas de compte interne : je peux préparer un e-mail de relance, à vous de décider."),
          // Le lien mène à la mission quand il y en a une ; sinon à l'espace de travail, où la
          // personne retrouve ses engagements. Un lien mort serait pire que pas de lien.
          link: engagement.missionId ? `/missions/${engagement.missionId}` : "/assistant",
          push: {
            // UN TAG PAR ENGAGEMENT : un second rappel REMPLACE le premier sur l'écran de
            // verrouillage au lieu de s'empiler. Trois notifications pour la même promesse
            // n'apportent rien de plus que la dernière.
            tag: `engagement-${engagement.id}`,
            requireInteraction: false,
          },
        });

        // ON NOTE, MÊME QUAND L'ENVOI A ÉCHOUÉ EN AVAL : sans cela, le prochain battement
        // recommencerait dans la minute, et l'espacement croissant ne servirait à rien.
        await noterRelance(engagement.id, maintenant);
        out.signales += 1;
      }
    } catch (e) {
      console.error(`[engagements] relances impossibles pour ${ownerId}`, e);
    }
  }

  return out;
}
