import { prisma } from "@/lib/prisma";
import { canAccessEntity } from "@/lib/entity-access";
import { auNomDeQui } from "@/lib/hr/stand-in-resolve";
import { userCan, hasGlobalView, hasRole, scopeRegulatory, scopeDirectives, type SessionUser } from "@/lib/rbac";
import { getPendingValidations } from "@/lib/queries/validations";
import { dossiersPromoAMonTour } from "@/lib/queries/promo-circuit";
import { clauseDemandesSecretariatVisibles } from "@/lib/queries/visibilite-listes";
import { libelleEtape } from "@/lib/promo-material/circuit";
import { toNumber, formatCurrency } from "@/lib/utils";
import type { PromoMaterialStatus } from "@prisma/client";
import {
  type BadgeTone, TASK_STATUS, ADMIN_REQUEST_STATUS, REGULATORY_STATUS, EXPENSE_ORDER_STATUS, LEAVE_STATUS, CONGRESS_REQUEST_STATUS, MEDICAL_INFO_STATUS, PROMO_MATERIAL_STATUS, DIRECTIVE_STATUS, SUPPORT_STATUS, DOSSIER_STATUS,
} from "@/lib/labels";

/**
 * UN GESTE QUE CETTE PERSONNE PEUT POSER SUR CETTE LIGNE, ICI ET MAINTENANT.
 *
 * `phrase` est rédigée PAR LE SERVEUR, avec la référence exacte : c'est ce qui permet de
 * trancher depuis la conversation sans avoir à retrouver « VAL-2026-014 » à la main. Elle
 * n'exécute rien — elle entre par la porte normale (proposition → carte → action canonique).
 *
 * On ne pose une action QUE si elle est décidable maintenant : proposer « Approuver » sur une
 * étape séquentielle dont ce n'est pas encore le tour promettrait un geste que l'exécution
 * refuserait — une déception, et une perte de confiance dans tous les autres boutons.
 */
export interface ActionSuggestion {
  libelle: string;
  phrase: string;
  ton?: "primaire" | "danger";
}

export interface ActionItem {
  key: string;
  title: string;
  subtitle: string;
  module: string;
  href: string;
  kind: "validation" | "request" | "payment" | "regulatory" | "task" | "hr";
  priority: string | null;
  deadline: string | null;
  owner: string;
  statusLabel: string | null;
  statusTone: BadgeTone | null;
  /** Ce qu'on peut faire sans quitter la conversation. Absent = seul le lien reste. */
  actions?: ActionSuggestion[];
}

export interface ActionNotification {
  id: string;
  title: string;
  body: string;
  link: string;
  type: string;
  createdAt: string;
}

const resolve = (map: Record<string, { label: string; tone: BadgeTone }>, v: string) => ({
  statusLabel: map[v]?.label ?? v,
  statusTone: map[v]?.tone ?? ("neutral" as BadgeTone),
});

/**
 * Les libellés et adresses des demandes Ad & Pro à étapes, EN LOT (une requête par nature) — pour
 * la section « À arbitrer ». Une ligne introuvable (supprimée entre-temps) n'a pas de libellé et
 * n'est pas listée : on ne montre pas un lien vers rien.
 */
async function libellesAdPro(refs: readonly { type: string; id: string }[]): Promise<Map<string, { titre: string; nature: string; href: string; demandeur: string | null }>> {
  const out = new Map<string, { titre: string; nature: string; href: string; demandeur: string | null }>();
  const ids = (t: string) => refs.filter((r) => r.type === t).map((r) => r.id);
  const [spo, evt, intl, nat] = await Promise.all([
    ids("SPONSORING").length ? prisma.sponsoringRequest.findMany({ where: { id: { in: ids("SPONSORING") } }, select: { id: true, reference: true, institution: true, requesterId: true } }) : [],
    ids("EVENT").length ? prisma.event.findMany({ where: { id: { in: ids("EVENT") } }, select: { id: true, name: true, requesterId: true } }) : [],
    ids("CONGRESS_INTERNATIONAL").length ? prisma.congressInternational.findMany({ where: { id: { in: ids("CONGRESS_INTERNATIONAL") } }, select: { id: true, name: true, requesterId: true } }) : [],
    ids("CONGRESS_NATIONAL").length ? prisma.congressNational.findMany({ where: { id: { in: ids("CONGRESS_NATIONAL") } }, select: { id: true, name: true, requesterId: true } }) : [],
  ]);
  const demandeurs = [...spo, ...evt, ...intl, ...nat].map((r) => r.requesterId).filter((x): x is string => Boolean(x));
  const noms = new Map((demandeurs.length
    ? await prisma.user.findMany({ where: { id: { in: [...new Set(demandeurs)] } }, select: { id: true, name: true } })
    : []).map((u) => [u.id, u.name]));
  const nom = (id: string | null) => (id ? noms.get(id) ?? null : null);
  for (const r of spo) out.set(`SPONSORING:${r.id}`, { titre: `${r.reference} — ${r.institution}`, nature: "Sponsoring", href: `/sponsoring/${r.id}`, demandeur: nom(r.requesterId) });
  for (const r of evt) out.set(`EVENT:${r.id}`, { titre: r.name, nature: "Événement", href: `/events/${r.id}`, demandeur: nom(r.requesterId) });
  for (const r of intl) out.set(`CONGRESS_INTERNATIONAL:${r.id}`, { titre: r.name, nature: "Prise en charge internationale", href: `/congress-international/${r.id}`, demandeur: nom(r.requesterId) });
  for (const r of nat) out.set(`CONGRESS_NATIONAL:${r.id}`, { titre: r.name, nature: "Prise en charge nationale", href: `/congress-national/${r.id}`, demandeur: nom(r.requesterId) });
  return out;
}

export async function getActionCenter(user: SessionUser) {
  const now = new Date();
  const items: ActionItem[] = [];

  // 1. Mes tâches (WORKSPACE — tout le monde)
  const tasks = await prisma.task.findMany({
    where: { assignedToId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take: 60,
  });
  for (const t of tasks) {
    items.push({
      key: `task-${t.id}`, title: t.title, subtitle: t.module ?? "", module: "Mon espace",
      href: "/mon-espace", kind: "task", priority: t.priority,
      deadline: t.dueDate?.toISOString() ?? null, owner: "", ...resolve(TASK_STATUS, t.status),
    });
  }

  // 2. Validations à faire — SEULEMENT celles où c'est MON tour. Une étape séquentielle en
  //    attente du validateur précédent n'est pas du travail à faire : la lister gonflait la
  //    file d'items sur lesquels aucun geste n'est possible. Elle reste visible sur l'écran
  //    /validations, section « Qui vous reviendront » — rien n'est perdu, c'est trié.
  if (userCan(user, "VALIDATIONS", "VIEW")) {
    const pending = await getPendingValidations(user.id);
    for (const v of pending) {
      if (!v.actionable) continue;
      items.push({
        key: `val-${v.stepId}`, title: v.title,
        // En intérim, la ligne dit pour QUI l'on tranche : signer « pour soi » une étape adressée à
        // l'absent, sans le savoir, ferait porter la décision au mauvais nom dans la tête de chacun.
        subtitle: [v.pourLeCompteDe ? `Intérim pour ${v.pourLeCompteDe}` : null, v.amount !== null ? formatCurrency(v.amount) : v.objectType].filter(Boolean).join(" · "),
        // LE LIEN MÈNE DANS LA VALIDATION, pas sur l'écran du module. Arriver sur une liste
        // pour y rechercher la ligne qu'on vient de cliquer est un pas de trop — et c'est
        // celui qu'on ne fait pas : on repart, et la validation attend un jour de plus.
        module: "Validations", href: `/validations?focus=${v.stepId}#val-${v.stepId}`, kind: "validation", priority: v.priority,
        deadline: v.deadline, owner: v.requester,
        statusLabel: "À valider",
        statusTone: "warning",
        actions: [
          { libelle: "Approuver", phrase: `Approuve la validation ${v.reference}`, ton: "primaire" as const },
          { libelle: "Refuser", phrase: `Refuse la validation ${v.reference}`, ton: "danger" as const },
        ],
      });
    }
  }

  // 2b. EN INTÉRIM — CE QUI ATTEND L'ABSENT QUE JE REMPLACE (§118.185 — audit 360°, I18).
  //
  // Les portes de décision acceptent désormais l'intérimaire ; sans ce bloc, il lui fallait deviner
  // où chercher — quatre écrans, et une absence de trois semaines pour s'en apercevoir. Une ligne
  // par décision, au nom de l'absent ; jamais ses propres demandes, que les portes lui refusent.
  const auNomInterim = await auNomDeQui(user.id);
  if (auNomInterim.absents.length > 0) {
    const absents = auNomInterim.absents.map((a) => a.userId);
    const fiches = await prisma.employee.findMany({ where: { userId: { in: absents } }, select: { id: true, userId: true } });
    const ficheIds = fiches.map((f) => f.id);
    const nomDeLaFiche = new Map(fiches.map((f) => [f.id, auNomInterim.nomDe(f.userId)]));
    const pour = (nom: string | null | undefined) => `Intérim pour ${nom ?? "l'absent"}`;
    const [conges, achats, formations, plans] = await Promise.all([
      ficheIds.length
        ? prisma.leaveRequest.findMany({
            where: { status: "PENDING", stage: "MANAGER", managerId: { in: ficheIds }, NOT: { employee: { userId: user.id } } },
            select: { id: true, managerId: true, days: true, startDate: true, employee: { select: { fullName: true } } },
            orderBy: { startDate: "asc" }, take: 40,
          })
        : [],
      prisma.adminApproval.findMany({
        where: { status: "PENDING", validatorId: { in: absents }, request: { deletedAt: null }, NOT: { request: { requesterId: user.id } } },
        select: { id: true, validatorId: true, request: { select: { id: true, title: true, reference: true } } },
        orderBy: { createdAt: "asc" }, take: 40,
      }),
      ficheIds.length
        ? prisma.training.findMany({
            where: {
              status: "PENDING", stage: "MANAGER", NOT: { requesterId: user.id },
              OR: [{ managerId: { in: ficheIds } }, { requester: { employee: { managerId: { in: ficheIds } } } }],
            },
            select: { id: true, title: true, reference: true, managerId: true },
            orderBy: { createdAt: "asc" }, take: 40,
          })
        : [],
      prisma.tourPlan.findMany({
        where: {
          repId: { not: user.id },
          OR: [{ reviewerId: { in: absents }, status: "SUBMITTED" }, { escalatedToId: { in: absents }, status: "ESCALATED" }],
        },
        select: { id: true, reviewerId: true, escalatedToId: true, status: true, rep: { select: { name: true } } },
        orderBy: { submittedAt: "asc" }, take: 40,
      }),
    ]);
    for (const c of conges) {
      items.push({
        key: `interim-leave-${c.id}`, title: `Congé — ${c.employee.fullName}`, subtitle: `${pour(c.managerId ? nomDeLaFiche.get(c.managerId) : null)} · ${toNumber(c.days)} j`,
        module: "Ressources humaines", href: "/mon-espace#conges-a-signer", kind: "validation", priority: null,
        deadline: c.startDate.toISOString(), owner: c.employee.fullName, statusLabel: "À signer", statusTone: "warning",
      });
    }
    for (const a of achats) {
      items.push({
        key: `interim-achat-${a.id}`, title: a.request.title, subtitle: `${pour(auNomInterim.nomDe(a.validatorId))} · ${a.request.reference}`,
        module: "Demandes administratives", href: `/demandes/${a.request.id}`, kind: "validation", priority: null,
        deadline: null, owner: "", statusLabel: "À valider", statusTone: "warning",
      });
    }
    for (const f of formations) {
      items.push({
        key: `interim-formation-${f.id}`, title: f.title, subtitle: `${pour(f.managerId ? nomDeLaFiche.get(f.managerId) : null)} · ${f.reference}`,
        module: "Formations", href: "/formations", kind: "validation", priority: null,
        deadline: null, owner: "", statusLabel: "À trancher", statusTone: "warning",
      });
    }
    for (const p of plans) {
      const absent = p.status === "ESCALATED" ? p.escalatedToId : p.reviewerId;
      items.push({
        key: `interim-plan-${p.id}`, title: `Plan de tournée — ${p.rep.name}`, subtitle: pour(auNomInterim.nomDe(absent)),
        module: "Promotion médicale", href: `/medical/plan-de-tournee?plan=${p.id}`, kind: "validation", priority: null,
        deadline: null, owner: p.rep.name, statusLabel: "À trancher", statusTone: "warning",
      });
    }
  }

  // 2c. À CORRIGER — MES DEMANDES AD & PRO RENVOYÉES POUR CORRECTION (§118.186 — audit 360°, R02/R03).
  //
  // Un renvoi rend la main au DEMANDEUR : sans cette ligne, il l'apprenait par une notification qui
  // se perd, et la demande attendait — chez lui, sans qu'aucun écran ne le lui rappelle. Le statut
  // projeté (« RETURNED ») suffit à la trouver ; le dernier renvoi donne l'étape et le motif.
  const PLAFOND_A_CORRIGER = 30;
  const [spoR, ciR, cnR, evR] = await Promise.all([
    prisma.sponsoringRequest.findMany({ where: { requesterId: user.id, status: "RETURNED" }, select: { id: true, reference: true, institution: true }, orderBy: { updatedAt: "asc" }, take: PLAFOND_A_CORRIGER + 1 }),
    prisma.congressInternational.findMany({ where: { requesterId: user.id, requestStatus: "RETURNED" }, select: { id: true, name: true }, orderBy: { updatedAt: "asc" }, take: PLAFOND_A_CORRIGER + 1 }),
    prisma.congressNational.findMany({ where: { requesterId: user.id, requestStatus: "RETURNED" }, select: { id: true, name: true }, orderBy: { updatedAt: "asc" }, take: PLAFOND_A_CORRIGER + 1 }),
    prisma.event.findMany({ where: { requesterId: user.id, requestStatus: "RETURNED" }, select: { id: true, name: true }, orderBy: { updatedAt: "asc" }, take: PLAFOND_A_CORRIGER + 1 }),
  ]);
  const aCorriger = [
    ...spoR.map((r) => ({ type: "SPONSORING", id: r.id, titre: `${r.reference} — ${r.institution}`, nature: "Sponsoring", href: `/sponsoring/${r.id}` })),
    ...ciR.map((r) => ({ type: "CONGRESS_INTERNATIONAL", id: r.id, titre: r.name, nature: "Prise en charge internationale", href: `/congress-international/${r.id}` })),
    ...cnR.map((r) => ({ type: "CONGRESS_NATIONAL", id: r.id, titre: r.name, nature: "Prise en charge nationale", href: `/congress-national/${r.id}` })),
    ...evR.map((r) => ({ type: "EVENT", id: r.id, titre: r.name, nature: "Événement", href: `/events/${r.id}` })),
  ];
  if (aCorriger.length > 0) {
    const renvois = await prisma.workflowStepEvent.findMany({
      where: { action: "RETURN", instance: { status: "RETURNED", entityId: { in: aCorriger.map((d) => d.id) } } },
      select: { stepTitle: true, note: true, instance: { select: { entityId: true, entityType: true } } },
      orderBy: { createdAt: "desc" },
    });
    const dernier = new Map<string, { stepTitle: string; note: string | null }>();
    for (const r of renvois) {
      const cle = `${r.instance.entityType}:${r.instance.entityId}`;
      if (!dernier.has(cle)) dernier.set(cle, r);
    }
    const apercu = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);
    for (const d of aCorriger.slice(0, PLAFOND_A_CORRIGER)) {
      const r = dernier.get(`${d.type}:${d.id}`);
      items.push({
        key: `corriger-${d.type}-${d.id}`, title: `À corriger — ${d.titre}`,
        subtitle: r ? `${r.stepTitle}${r.note ? ` : ${apercu(r.note)}` : ""}` : d.nature,
        module: d.nature, href: d.href, kind: "request", priority: null,
        deadline: null, owner: "", statusLabel: "À corriger", statusTone: "warning",
      });
    }
    // Au-delà du plafond, on le DIT (§118.60) — une liste coupée se lirait comme complète.
    if (aCorriger.length > PLAFOND_A_CORRIGER || [spoR, ciR, cnR, evR].some((l) => l.length > PLAFOND_A_CORRIGER)) {
      items.push({
        key: "corriger-reste", title: "D'autres demandes vous attendent pour correction",
        subtitle: "La liste « Ad & Pro » les montre toutes (état « À corriger »).",
        module: "Ad & Pro", href: "/ad-pro", kind: "request", priority: null,
        deadline: null, owner: "", statusLabel: "À corriger", statusTone: "warning",
      });
    }
  }

  // 3. Demandes administratives qui me sont assignées / que je dois valider
  if (userCan(user, "ADMIN_REQUESTS", "VIEW")) {
    const reqs = await prisma.administrativeRequest.findMany({
      where: { OR: [{ assignedToId: user.id }, { validatorId: user.id }], status: { notIn: ["DONE", "CANCELLED"] } },
      include: { requester: { select: { name: true } } },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }], take: 60,
    });
    for (const r of reqs) {
      items.push({
        key: `req-${r.id}`, title: r.title, subtitle: r.reference, module: "Demandes administratives",
        href: `/demandes/${r.id}`, kind: "request", priority: r.priority,
        deadline: r.deadline?.toISOString() ?? null, owner: r.requester?.name ?? "", ...resolve(ADMIN_REQUEST_STATUS, r.status),
      });
    }
    // LE SECRÉTARIAT VOIT AUSSI CE QUE PERSONNE N'A PRIS (audit 360°, I10). Les demandes sans
    // responsable — la valeur par défaut du formulaire, et la règle des devis Ad & Pro et promo —
    // n'étaient listées nulle part, et l'accueil de l'assistante pouvait dire « Rien ne vous
    // attend » avec dix demandes neuves au bureau. Dans SA portée (la clause du bureau).
    if (hasRole(user, "DIRECTION_ASSISTANT")) {
      const vues = new Set(reqs.map((r) => r.id));
      const libres = await prisma.administrativeRequest.findMany({
        where: { AND: [await clauseDemandesSecretariatVisibles(user), { assignedToId: null, status: "NEW", deletedAt: null }] },
        include: { requester: { select: { name: true } } },
        orderBy: [{ deadline: "asc" }, { createdAt: "asc" }], take: 60,
      });
      for (const r of libres) {
        if (vues.has(r.id)) continue;
        items.push({
          key: `req-${r.id}`, title: r.title, subtitle: `${r.reference} · à prendre en charge`, module: "Demandes administratives",
          href: `/demandes/${r.id}`, kind: "request", priority: r.priority,
          deadline: r.deadline?.toISOString() ?? null, owner: r.requester?.name ?? "", ...resolve(ADMIN_REQUEST_STATUS, r.status),
        });
      }
    }
  }

  // 4. Paiements / ordres de dépense à régler — la file du COMPTABLE, pas de tous ceux qui
  //    ont le droit Finances. La Direction et le DG portent FINANCES: MANAGE (ils peuvent
  //    ouvrir l'écran), mais régler n'est pas leur travail quotidien : soixante ordres dans
  //    leur espace noyaient ce qui les attend vraiment. Le Super Admin, lui, voit tout.
  if (hasRole(user, "FINANCE_BUDGET_MANAGER") || user.role === "SUPER_ADMIN") {
    const orders = await prisma.expenseOrder.findMany({ where: { status: "PENDING" }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], take: 60 });
    for (const o of orders) {
      items.push({
        key: `pay-${o.id}`, title: o.label, subtitle: `${o.reference} · ${formatCurrency(toNumber(o.amount))}`,
        module: "Espace comptable", href: `/finances/paiements-a-faire?focus=${o.id}#ord-${o.id}`, kind: "payment", priority: null,
        deadline: o.dueDate?.toISOString() ?? null, owner: o.beneficiary ?? "", ...resolve(EXPENSE_ORDER_STATUS, o.status),
      });
    }
  }

  // 5. Dossiers Regulatory à mettre à jour (les miens, non clôturés)
  if (userCan(user, "REGULATORY", "VIEW")) {
    const products = await prisma.regulatoryProduct.findMany({
      where: { AND: [scopeRegulatory(user), { OR: [{ responsibleId: user.id }, { assistantId: user.id }] }, { status: { notIn: ["CLOSED", "DECISION_OBTAINED"] } }] },
      orderBy: [{ targetDate: "asc" }, { updatedAt: "desc" }], take: 40,
    });
    for (const p of products) {
      items.push({
        key: `reg-${p.id}`, title: p.dci, subtitle: p.reference, module: "Regulatory",
        href: `/regulatory/${p.id}`, kind: "regulatory", priority: p.priority,
        deadline: p.targetDate?.toISOString() ?? null, owner: "", ...resolve(REGULATORY_STATUS, p.status),
      });
    }
  }

  // 6. Demandes de congé à décider (RH)
  if (userCan(user, "RH", "UPDATE")) {
    const leaves = await prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" }, take: 40,
    });
    for (const l of leaves) {
      items.push({
        key: `leave-${l.id}`, title: `Congé — ${l.employee?.user?.name ?? "Employé"}`, subtitle: `${Number(l.days)} j`,
        module: "Ressources humaines", href: "/rh", kind: "hr", priority: null,
        deadline: l.startDate.toISOString(), owner: l.employee?.user?.name ?? "", ...resolve(LEAVE_STATUS, l.status),
      });
    }
  }

  // 6a. À ARBITRER — TOUTES LES NATURES AD & PRO, LUES SUR L'ÉTAPE COURANTE (audit 360°, I11).
  //
  // L'espace de la Direction Marketing ne couvrait que les congrès, typés « demande » donc hors de
  // l'indicateur « À valider » : un sponsoring, un événement, un contrat de consulting ou une
  // « autre demande » posés sur SON étape dormaient — personne ne lui disait qu'ils l'attendaient.
  // La règle est celle du moteur (`canActOnStep`, portée RÔLE) : l'étape courante nomme les rôles
  // qui agissent, et l'on n'en invente pas d'autre. La vue globale et le Super Admin, qui passent
  // partout, ont leurs propres sections : les y verser noierait ce qui les attend vraiment.
  if (!hasGlobalView(user.role) && user.role !== "SUPER_ADMIN") {
    const dejaListes = new Set(items.map((i) => i.href));
    // LES ÉTAPES QUI NOMMENT MON RÔLE d'abord, puis les seules instances posées dessus — une
    // fenêtre « les N plus anciennes de toute la base » laissait les étapes des autres rôles
    // remplir la fenêtre et taire, en silence, ce qui m'attend (§118.60).
    const mesRoles = [user.role, user.secondaryRole].filter((r): r is NonNullable<typeof r> => Boolean(r));
    const etapes = await prisma.workflowStep.findMany({
      where: { actorScope: "ROLE", actorRoles: { hasSome: mesRoles } },
      select: { definitionId: true, slug: true, title: true },
    });
    const etapeDe = new Map(etapes.map((e) => [`${e.definitionId}:${e.slug}`, e]));
    const surMesEtapes = etapes.length
      ? { status: "IN_PROGRESS" as const, OR: etapes.map((e) => ({ definitionId: e.definitionId, currentSlug: e.slug })) }
      : null;
    const [aMoi, totalAMoi] = surMesEtapes
      ? await Promise.all([
          prisma.workflowInstance.findMany({
            where: surMesEtapes,
            select: { entityType: true, entityId: true, currentSlug: true, definitionId: true },
            orderBy: { updatedAt: "asc" }, take: 40,
          }),
          prisma.workflowInstance.count({ where: surMesEtapes }),
        ])
      : [[], 0];
    const libelles = await libellesAdPro(aMoi.map((i) => ({ type: String(i.entityType), id: i.entityId })));
    const ouvrables = await Promise.all(aMoi.map((i) => canAccessEntity(user, i.entityType, i.entityId, "VIEW")));
    aMoi.forEach((i, k) => {
      const l = libelles.get(`${i.entityType}:${i.entityId}`);
      if (!l || !ouvrables[k] || dejaListes.has(l.href)) return;
      const e = etapeDe.get(`${i.definitionId}:${i.currentSlug}`);
      items.push({
        key: `arb-${i.entityType}-${i.entityId}`, title: l.titre, subtitle: `${l.nature} · ${e?.title ?? "à votre étape"}`,
        module: "Ad & Pro", href: l.href, kind: "validation", priority: null, deadline: null, owner: l.demandeur ?? "",
        statusLabel: "À arbitrer", statusTone: "warning",
      });
    });
    // CE QUI N'EST PAS LISTÉ SE COMPTE (§118.60) : au-delà de quarante, une ligne le dit et mène à
    // la liste du pôle — une coupe muette se lirait comme « rien d'autre ne m'attend ».
    if (totalAMoi > aMoi.length) {
      items.push({
        key: "arb-reste", title: `${totalAMoi - aMoi.length} autre(s) demande(s) Ad & Pro attendent votre étape`,
        subtitle: "Les plus anciennes sont listées ci-dessus", module: "Ad & Pro", href: "/ad-pro",
        kind: "validation", priority: null, deadline: null, owner: "", statusLabel: "À arbitrer", statusTone: "warning",
      });
    }
    // Consulting et « autre demande » n'ont pas de circuit à étapes : ce qui les attend se lit sur
    // leur statut, et la règle de décision est celle de leur action (`peutSurLeContrat`, VALIDATE).
    // UNE COUPE SE DIT (§118.60) : on lit un de plus que ce qu'on montre ; s'il existe, une ligne
    // le dit et mène à la liste. Le compte exact demanderait la porte de chaque ligne de la base.
    const PLAFOND = 30;
    const FENETRE = PLAFOND * 2 + 1;
    const lister = async (
      candidats: { id: string; reference: string; title: string }[],
      type: "CONSULTING_CONTRACT" | "AD_PRO_OTHER",
      ligne: (c: { id: string; reference: string; title: string }) => ActionItem,
      reste: ActionItem,
    ) => {
      let montres = 0;
      for (const c of candidats) {
        const it = ligne(c);
        if (dejaListes.has(it.href) || !(await canAccessEntity(user, type, c.id, "VIEW"))) continue;
        if (montres === PLAFOND) { items.push(reste); return; }
        items.push(it);
        montres += 1;
      }
      // La fenêtre lue était pleine : au-delà, on ne SAIT pas — et l'on ne se tait pas.
      if (candidats.length === FENETRE) items.push(reste);
    };
    if (userCan(user, "CONSULTING", "VALIDATE")) {
      const contrats = await prisma.consultingContract.findMany({
        where: { status: "AWAITING_VALIDATION", pole: "AD_PRO", OR: [{ validatorId: null }, { validatorId: user.id }] },
        select: { id: true, reference: true, title: true },
        orderBy: { updatedAt: "asc" }, take: FENETRE,
      }).catch(() => []);
      await lister(contrats, "CONSULTING_CONTRACT", (c) => ({
        key: `arb-cons-${c.id}`, title: c.title, subtitle: `Consulting · ${c.reference}`, module: "Ad & Pro",
        href: `/consulting/${c.id}`, kind: "validation", priority: null, deadline: null, owner: "",
        statusLabel: "À valider", statusTone: "warning",
      }), {
        key: "arb-cons-reste", title: "D'autres contrats de consulting attendent votre validation", subtitle: "Les plus anciens sont listés ci-dessus",
        module: "Ad & Pro", href: "/consulting", kind: "validation", priority: null, deadline: null, owner: "", statusLabel: "À valider", statusTone: "warning",
      });
    }
    if (userCan(user, "AD_PRO_OTHER", "VALIDATE")) {
      const autres = await prisma.adProOtherRequest.findMany({
        where: { status: "AWAITING_DECISION" },
        select: { id: true, reference: true, title: true },
        orderBy: { updatedAt: "asc" }, take: FENETRE,
      }).catch(() => []);
      await lister(autres, "AD_PRO_OTHER", (a) => ({
        key: `arb-autre-${a.id}`, title: a.title, subtitle: `Autre demande · ${a.reference}`, module: "Ad & Pro",
        href: `/ad-pro/autres/${a.id}`, kind: "validation", priority: null, deadline: null, owner: "",
        statusLabel: "À décider", statusTone: "warning",
      }), {
        key: "arb-autre-reste", title: "D'autres demandes attendent votre décision", subtitle: "Les plus anciennes sont listées ci-dessus",
        module: "Ad & Pro", href: "/ad-pro", kind: "validation", priority: null, deadline: null, owner: "", statusLabel: "À décider", statusTone: "warning",
      });
    }
  }

  // 6b. Congrès / événements à valider (Direction) ou à analyser (Direction Marketing)
  const congressTone = (s: string): { statusLabel: string; statusTone: BadgeTone } => ({
    statusLabel: CONGRESS_REQUEST_STATUS[s]?.label ?? s,
    statusTone: CONGRESS_REQUEST_STATUS[s]?.tone ?? "warning",
  });
  for (const cfg of [
    { module: "CONGRESS_INTERNATIONAL" as const, label: "Prises en charge Internationales", href: "/congress-international" },
    { module: "CONGRESS_NATIONAL" as const, label: "Prises en charge Nationales", href: "/congress-national" },
  ]) {
    if (!userCan(user, cfg.module, "VIEW")) continue;
    const canValidate = userCan(user, cfg.module, "VALIDATE") || hasGlobalView(user.role);
    const or: { requestStatus?: unknown; productManagerId?: string }[] = [{ requestStatus: "PRELIMINARY_APPROVED", productManagerId: user.id }];
    if (canValidate) or.push({ requestStatus: { in: ["AWAITING_PRELIMINARY", "AWAITING_FINAL"] } });
    const where = { OR: or } as never;
    const list = cfg.module === "CONGRESS_INTERNATIONAL"
      ? await prisma.congressInternational.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 })
      : await prisma.congressNational.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 });
    for (const c of list) {
      items.push({
        key: `cong-${c.id}`, title: c.name,
        subtitle: c.requestStatus === "PRELIMINARY_APPROVED" ? "À analyser (Direction Marketing)" : c.requestStatus === "AWAITING_FINAL" ? "Validation définitive" : "Validation préliminaire",
        module: cfg.label, href: `${cfg.href}/${c.id}`, kind: "request", priority: null,
        deadline: null, owner: "", ...congressTone(c.requestStatus),
      });
    }
  }

  // 6c. Information médicale — l'INSTRUCTION (à déclarer, pièces demandées, prêt à valider)
  //     est le travail du PHARMACIEN RESPONSABLE (PRIM), et de lui seul : la Direction a le
  //     droit d'agir sur le module, mais ces événements ne sont pas SA file. Elle ne reçoit
  //     que l'étape qui lui appartient — la validation finale (AWAITING_DIRECTION), même
  //     garde que l'action `validateDeclarationByDirection`. Le Super Admin voit tout.
  {
    const prim = hasRole(user, "MEDICAL_INFO_PHARMACIST") || user.role === "SUPER_ADMIN";
    const direction = hasGlobalView(user);
    const miStatuses: ("AWAITING_REVIEW" | "DOCS_REQUESTED" | "READY" | "AWAITING_DIRECTION")[] = [
      ...(prim ? (["AWAITING_REVIEW", "DOCS_REQUESTED", "READY"] as const) : []),
      ...(direction ? (["AWAITING_DIRECTION"] as const) : []),
    ];
    const decls = miStatuses.length
      ? await prisma.medicalInfoDeclaration.findMany({
          where: { status: { in: miStatuses } },
          orderBy: { createdAt: "desc" }, take: 40,
        })
      : [];
    for (const d of decls) {
      items.push({
        key: `mi-${d.id}`, title: d.label, subtitle: d.reference,
        module: "Information médicale", href: `/information-medicale/${d.id}`, kind: "validation", priority: null,
        deadline: null, owner: "", ...resolve(MEDICAL_INFO_STATUS, d.status),
      });
    }
  }

  // 6d. Matériel promotionnel — étape en attente de l'acteur courant.
  //
  // (a) L'ANCIEN CIRCUIT (seize statuts) : le `status` fait foi, et SEULEMENT pour lui
  //     (`circuitState: null`). Un dossier à circuit garde son `status` de création figé pour
  //     toujours : le lire ici l'affichait « Prospection demandée — à valider » chez tous les
  //     porteurs de la validation du module, y compris après qu'ils l'avaient validé (§118.153).
  if (userCan(user, "PROMO_MATERIAL", "VIEW")) {
    const global = hasGlobalView(user.role);
    const mine = new Set<PromoMaterialStatus>();
    if (userCan(user, "PROMO_MATERIAL", "VALIDATE") || global) ["PROSPECTION_REQUESTED", "AGENCY_CHOSEN", "BC_VALIDATED", "FINAL_MATERIAL"].forEach((s) => mine.add(s as PromoMaterialStatus));
    if (user.role === "FINANCE_BUDGET_MANAGER" || global) ["BC_FINANCE_REVIEW", "PAYMENT_INITIATED", "INVOICED"].forEach((s) => mine.add(s as PromoMaterialStatus));
    if (user.role === "MEDICAL_INFO_PHARMACIST" || global) ["BC_SENT", "CONFORMITY_REVIEW"].forEach((s) => mine.add(s as PromoMaterialStatus));
    if (global) mine.add("MATERIAL_PRODUCED");
    const marketing: PromoMaterialStatus[] = ["QUOTES_UPLOADED", "PAYMENT_DONE", "VISA_OBTAINED", "BAT_PRINTING"];
    const or: { status: { in: PromoMaterialStatus[] }; requesterId?: string }[] = [];
    if (mine.size) or.push({ status: { in: [...mine] } });
    or.push(global ? { status: { in: marketing } } : { status: { in: marketing }, requesterId: user.id });
    const promos = await prisma.promoMaterial.findMany({ where: { circuitState: null, OR: or }, orderBy: { createdAt: "desc" }, take: 40 });
    for (const p of promos) {
      items.push({
        key: `pm-${p.id}`, title: p.title, subtitle: p.reference,
        module: "Matériel promotionnel", href: `/promo-material/${p.id}`, kind: "validation", priority: null,
        deadline: null, owner: "", ...resolve(PROMO_MATERIAL_STATUS, p.status),
      });
    }
  }
  // (b) LES DOSSIERS À CIRCUIT : ceux dont c'est MON tour, selon la règle du circuit lui-même —
  //     et sans filtre par module : le N+1 et l'assistante de direction n'ont pas le module, et
  //     c'est pourtant à eux que la demande attend. Une validation va dans « Validations à
  //     faire » ; demander ou retranscrire les devis sont des gestes, qui vont dans « À traiter ».
  for (const d of await dossiersPromoAMonTour(user)) {
    items.push({
      key: `pm-${d.id}`, title: d.title, subtitle: d.reference,
      module: "Matériel promotionnel", href: `/promo-material/${d.id}`,
      kind: d.tour === "VALIDATION" ? "validation" : "request", priority: null,
      deadline: null, owner: "", statusLabel: libelleEtape(d.etat, d.version), statusTone: "warning",
    });
  }

  // 6d. Pièces qui me sont demandées au titre de l'information médicale (tout utilisateur)
  const myDocReqs = await prisma.medicalInfoDocRequest.findMany({
    where: { targetUserId: user.id, status: "PENDING" },
    include: { declaration: { select: { id: true, reference: true } } },
    orderBy: { createdAt: "desc" }, take: 30,
  });
  for (const r of myDocReqs) {
    items.push({
      key: `midoc-${r.id}`, title: `Pièce à déposer — ${r.label}`, subtitle: r.declaration.reference,
      module: "Information médicale", href: `/information-medicale/${r.declaration.id}`, kind: "request", priority: null,
      deadline: null, owner: "", statusLabel: "À déposer", statusTone: "warning",
    });
  }

  // 6e. Directives de la Direction qui me concernent (non clôturées)
  if (userCan(user, "DIRECTIVES", "VIEW")) {
    // Les notes adressées « aux salariés d'une entité » n'atteignent leur file d'actions que si
    // l'on sait de quelle entité la personne relève — sans cela, elles seraient reçues mais
    // absentes de « Mon travail », l'écran qui sert justement à ne rien oublier.
    const { companyIdsOf } = await import("@/lib/directives/recipients");
    const directives = await prisma.directive.findMany({
      where: { AND: [scopeDirectives(user, await companyIdsOf(user.id)), { status: { notIn: ["DONE", "ARCHIVED"] } }] },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 40,
    });
    for (const d of directives) {
      items.push({
        key: `dir-${d.id}`, title: d.title, subtitle: d.reference, module: "Directives",
        href: `/directives/${d.id}`, kind: "task", priority: d.priority,
        deadline: d.dueDate?.toISOString() ?? null, owner: "", ...resolve(DIRECTIVE_STATUS, d.status),
      });
    }
  }

  // 6f. Demandes de support qui m'attendent (destinataire / répondant)
  if (userCan(user, "SUPPORT", "VIEW")) {
    const reqs = await prisma.supportRequest.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        OR: [{ targetUserId: user.id }, { targetRole: user.role }, { assignedToId: user.id }],
      },
      include: { requester: { select: { name: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 40,
    });
    for (const r of reqs) {
      items.push({
        key: `sup-${r.id}`, title: r.subject, subtitle: r.reference, module: "Support",
        href: `/support/${r.id}`, kind: "request", priority: r.priority,
        deadline: null, owner: r.requester?.name ?? "", ...resolve(SUPPORT_STATUS, r.status),
      });
    }
  }

  // 6g. Dossiers de suivi qui me sont confiés (responsable), actifs
  if (userCan(user, "DOSSIERS", "VIEW")) {
    const dossiers = await prisma.dossier.findMany({
      where: { assignedToId: user.id, status: { notIn: ["DONE", "ARCHIVED"] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }], take: 40,
    });
    for (const d of dossiers) {
      items.push({
        key: `dos-${d.id}`, title: d.title, subtitle: d.reference, module: "Dossiers",
        href: `/dossiers/${d.id}`, kind: "request", priority: d.priority,
        deadline: d.dueDate?.toISOString() ?? null, owner: "", ...resolve(DOSSIER_STATUS, d.status),
      });
    }
  }

  // 7. Notifications non lues
  let notifications: ActionNotification[] = [];
  if (userCan(user, "NOTIFICATIONS", "VIEW")) {
    const notifs = await prisma.notification.findMany({ where: { userId: user.id, isRead: false }, orderBy: { createdAt: "desc" }, take: 20 });
    notifications = notifs.map((n) => ({ id: n.id, title: n.title, body: n.body ?? "", link: n.link ?? "", type: n.type, createdAt: n.createdAt.toISOString() }));
  }

  const isOverdue = (i: ActionItem) => i.deadline !== null && new Date(i.deadline) < now;
  const isUrgent = (i: ActionItem) => i.priority === "HIGH" || i.priority === "CRITICAL";

  const stats = {
    todo: items.length,
    urgent: items.filter(isUrgent).length,
    overdue: items.filter(isOverdue).length,
    validations: items.filter((i) => i.kind === "validation").length,
    unread: notifications.length,
  };

  return { items, notifications, stats };
}
