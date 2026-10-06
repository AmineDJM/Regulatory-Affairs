import { AlertTriangle, CheckCircle2, Globe2, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { ApercuConfiguration } from "@/lib/site-web/config";
import type { Blocage } from "@/lib/site-web/file";
import type { EtatLiaison } from "@/lib/site-web/etat";
import { recoitLesCandidatures } from "@/lib/site-web/liaison";
import { BlocCle } from "@/components/site-web/bloc-cle";
import { GesteIntegration } from "@/components/site-web/gestes-integration";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CONNEXION AU SITE (§118.159, §118.160) — ce que le Super Admin a à faire, et rien de plus : un
 * bouton, un bloc à copier, un collage dans Render. Tout le reste s'affiche au lieu de se demander.
 *
 * L'écran répond dans l'ordre aux questions qu'une personne qui n'est pas développeur se pose :
 * « Est-ce relié ? », « Qu'est-ce que je dois faire ? », « Est-ce que ça a marché ? ». Il ne montre
 * jamais une clé ACTIVE ; il montre la clé EN ATTENTE tant qu'elle ne publie encore rien.
 *
 * Cette carte ne vit QUE dans la console d'administration, que seul le Super Admin ouvre (§118.160) :
 * elle n'a donc plus de variante « vous n'avez pas le droit ». Une carte à deux publics portait deux
 * textes, et le second disait à la Direction « un Super Admin le relie depuis cette page » — une page
 * où la Direction voyait des boutons de liaison qui refusaient.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function CarteLiaison({
  config, blocage, liaison, bloc,
}: {
  config: ApercuConfiguration;
  blocage: Blocage | null;
  liaison: EtatLiaison;
  /** Le bloc à coller — composé côté serveur, et seulement pour une clé en attente. */
  bloc: string | null;
}) {
  const { sante, santeAu, attente } = liaison;
  const relie = config.configuree && !blocage;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> Connexion au site</CardTitle>
        <div className="flex flex-wrap items-start gap-2">
          {(config.configuree || attente) && !blocage && <GesteIntegration geste="verifier" />}
          {config.configuree && <GesteIntegration geste="rapprocher" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* ── Est-ce relié ? ─────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={blocage ? "danger" : relie ? "success" : attente ? "info" : "warning"} dot>
              {blocage ? "Clé refusée" : relie ? "Relié" : attente ? "En attente du site" : "Pas encore relié"}
            </Badge>
            {config.racine && <span className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]">{config.racine}</span>}
          </p>
          {config.configuree && (
            <p className="text-muted-foreground">
              {config.source === "ERP" && liaison.active
                ? <>Clé générée par l&apos;ERP{liaison.active.activeeLe ? `, reconnue par le site le ${formatDateTime(liaison.active.activeeLe)}` : ""}</>
                : <>Clé posée dans l&apos;environnement du serveur (ADVENTUM_API_KEY)</>}
              {" · "}signature des envois {config.signature ? "activée" : "non activée"}
              {" · "}empreinte <span className="font-mono text-xs [overflow-wrap:anywhere]">{config.empreinte}</span> — la clé elle-même ne s&apos;affiche jamais.
            </p>
          )}
          {liaison.illisibles.length > 0 && (
            <p className="text-destructive">
              Une clé enregistrée ne peut plus être lue (la clé de chiffrement du serveur a changé) : générez-en une nouvelle et
              collez-la sur le site.
            </p>
          )}
        </div>

        {/* ── Qu'est-ce que je dois faire ? ──────────────────────────────────────────── */}
        {attente && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4" /> Une seule chose à faire : coller ce bloc dans le site</p>
            {bloc ? (
              <>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Cliquez sur <span className="font-medium">« Copier le bloc »</span>.</li>
                  <li>
                    Ouvrez <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Render</a>,
                    puis le service du <span className="font-medium">site</span> (adventum-pharma) — pas celui de l&apos;ERP.
                  </li>
                  <li>
                    Menu <span className="font-medium">Environment</span> → <span className="font-medium">Add from .env</span> → collez →{" "}
                    <span className="font-medium">Save, rebuild, and deploy</span> (le site se reconstruit à partir de sa dernière version et
                    redémarre tout seul : quelques minutes). Pas « Save only » : rien ne changerait. Ni « Save and deploy » : il redémarrerait
                    la version déjà construite, qui peut être l&apos;ancienne.
                  </li>
                  <li>C&apos;est tout. Cette page passe à <span className="font-medium">« Relié »</span> d&apos;elle-même : l&apos;ERP vérifie chaque minute.</li>
                </ol>
                <BlocCle bloc={bloc} />
                {!bloc.includes("ERP_BASE_URL=") && (
                  <p className="text-warning">
                    L&apos;adresse de l&apos;ERP n&apos;a pas pu être lue : sans la ligne ERP_BASE_URL, le site ne pourra pas envoyer les candidatures.
                    Posez APP_URL dans l&apos;environnement de l&apos;ERP, puis générez une nouvelle clé.
                  </p>
                )}
              </>
            ) : (
              <p className="text-destructive">
                Le bloc de cette clé ne peut plus être relu (la clé de chiffrement du serveur a changé) : abandonnez-la, puis générez-en une nouvelle.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Générée le {formatDateTime(attente.creeLe)} · empreinte <span className="font-mono [overflow-wrap:anywhere]">{attente.empreinte}</span>
              {attente.derniereVerification && <> · dernière vérification {formatDateTime(attente.derniereVerification)} : {attente.dernierConstat}</>}
            </p>
            {config.configuree && (
              <p className="text-xs text-muted-foreground">
                En attendant, les publications continuent avec la clé actuelle : rien ne se coupe pendant le changement.
              </p>
            )}
            <GesteIntegration geste="abandonner" variante="ghost" confirmation="Abandonner cette clé ? Elle ne sera jamais acceptée ; la clé actuelle reste en vigueur." />
          </div>
        )}

        {!attente && !config.configuree && (
          <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
            <p className="font-medium">Le site n&apos;est pas encore relié à l&apos;ERP.</p>
            <p className="text-muted-foreground">
              Cliquez sur « Générer la clé » : l&apos;ERP fabrique la clé lui-même et vous montre un bloc à coller dans Render. Rien
              d&apos;autre. Les contenus publiés d&apos;ici là attendent en file et partiront d&apos;eux-mêmes.
            </p>
            <GesteIntegration geste="generer" variante="primary" />
          </div>
        )}

        {!attente && config.configuree && (
          <GesteIntegration
            geste="generer"
            libelle="Générer une nouvelle clé"
            variante="ghost"
            confirmation="Générer une nouvelle clé ? La clé actuelle continue de servir jusqu'à ce que le site ait la nouvelle : rien ne se coupe."
          />
        )}

        {/* ── Est-ce que ça marche ? Ce que le site dit de lui-même ───────────────────── */}
        {config.configuree && (
          <div className="space-y-1 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ce que le site dit de lui-même{santeAu ? ` — lu le ${formatDateTime(santeAu)}` : ""}
            </p>
            {!sante ? (
              <p className="text-muted-foreground">Pas encore lu : l&apos;ERP le lit une fois l&apos;heure (ou maintenant, avec « Vérifier la connexion »).</p>
            ) : sante.statut !== 200 ? (
              <p className="text-destructive">{sante.erreur ?? `Le site a répondu ${sante.statut}.`}</p>
            ) : (
              <ul className="space-y-1">
                <Constat ok={sante.authentifie === true}>
                  {sante.authentifie ? "Le site reconnaît la clé de l'ERP." : "Le site ne reconnaît pas la clé de l'ERP."}
                </Constat>
                {recoitLesCandidatures(sante) === false && (
                  <Constat ok={false}>
                    Le site tourne encore sur une ancienne version : il publie les offres, mais ne reçoit pas les candidatures. Dans Render,
                    service du site → Manual Deploy → Deploy latest commit (quelques minutes).
                  </Constat>
                )}
                {sante.erpRelie !== null && (
                  <Constat ok={sante.erpRelie}>
                    {sante.erpRelie
                      ? "Le site connaît l'adresse de l'ERP : les candidatures arrivent ici dès qu'elles sont déposées."
                      : "Le site ne connaît pas l'adresse de l'ERP : les candidatures restent sur le site. Générez une nouvelle clé et collez le bloc ENTIER (avec ERP_BASE_URL)."}
                  </Constat>
                )}
                {sante.signe !== null && (
                  <Constat ok={sante.signe} neutre={!sante.signe}>
                    {sante.signe ? "Le site signe ses envois (secret de signature en place)." : "Le site ne signe pas ses envois : collez aussi la ligne ERP_WEBHOOK_SECRET."}
                  </Constat>
                )}
                {sante.candidaturesEnAttente !== null && sante.candidaturesEnAttente > 0 && (
                  <Constat ok={false}>
                    {sante.candidaturesEnAttente} candidature(s) attendent sur le site d&apos;être livrées à l&apos;ERP
                    {sante.plusAncienneEnAttente ? ` (la plus ancienne depuis le ${formatDateTime(new Date(sante.plusAncienneEnAttente))})` : ""}
                    {sante.derniereErreurDeLivraison ? ` — ${sante.derniereErreurDeLivraison}` : ""}.
                  </Constat>
                )}
                {sante.stockageDeSecours === true && (
                  <Constat ok neutre>
                    Le site n&apos;a pas de disque permanent : il recharge ses offres et ses articles depuis l&apos;ERP à chaque redémarrage — automatiquement.
                  </Constat>
                )}
                {sante.demarreLe && <li className="text-xs text-muted-foreground">Dernier démarrage du site : {formatDateTime(new Date(sante.demarreLe))}.</li>}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Constat({ ok, neutre = false, children }: { ok: boolean; neutre?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      {ok
        ? <CheckCircle2 className={neutre ? "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" : "mt-0.5 h-4 w-4 shrink-0 text-success"} aria-label="Oui" />
        : <AlertTriangle className={neutre ? "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" : "mt-0.5 h-4 w-4 shrink-0 text-warning"} aria-label="À regarder" />}
      <span className="min-w-0">{children}</span>
    </li>
  );
}
