import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCompany, toggleCompany } from "@/lib/actions/company-actions";
import { createDepartment, assignEmployeeDepartment, assignEmployeeManager } from "@/lib/actions/department-actions";
import { createSupplier, toggleSupplier } from "@/lib/actions/supplier-actions";
import { createCompanyContact } from "@/lib/actions/company-contact-actions";
import { createAccountWithInvite, INVITE_TTL_HOURS } from "@/lib/user-invites";
import { ROLE_LABELS } from "@/lib/labels";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";

/**
 * OPS STRUCTURELLES — entités du groupe, départements & rattachements (organigramme, N+1),
 * fournisseurs du portail, annuaire d'entreprise — par les ACTIONS CANONIQUES de
 * l'Administration. Le cloisonnement par entité découle de ces rattachements : chaque carte
 * dit ce que le geste OUVRE ou FERME.
 */

async function resolveCompanyAny(raw: string): Promise<{ id: string; name: string; isActive: boolean } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le nom de l'entité (champ « name »)." };
  const rows = await prisma.company.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
    take: 4,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucune entité « ${q} ».` };
  return { error: `Plusieurs entités correspondent à « ${q} » : ${rows.map((r) => r.name).join(", ")} — préciser.` };
}

async function resolveDepartment(raw: string): Promise<{ id: string; name: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le nom du département (champ « department »)." };
  const rows = await prisma.department.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, company: { select: { name: true } } },
    take: 4,
  });
  if (rows.length === 1) return { id: rows[0].id, name: rows[0].name };
  if (rows.length === 0) return { error: `Aucun département « ${q} ».` };
  return { error: `Plusieurs départements correspondent à « ${q} » : ${rows.map((r) => `${r.name}${r.company ? ` (${r.company.name})` : ""}`).join(", ")} — préciser.` };
}

async function resolveEmployeeByName(raw: string, label: string): Promise<{ id: string; fullName: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: `Précisez ${label} (nom au registre RH).` };
  const rows = await prisma.employee.findMany({
    where: { fullName: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, fullName: true },
    take: 4,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun employé actif « ${q} » au registre RH.` };
  return { error: `Plusieurs employés correspondent à « ${q} » : ${rows.map((r) => r.fullName).join(", ")} — préciser.` };
}

/** Rôle depuis un code (« SUPER_ADMIN ») ou un libellé FR (« assistante de direction ») — jamais deviné. */
function roleOf(raw: string): UserRole | null {
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const q = fold(raw);
  if (!q) return null;
  const byCode = Object.keys(ROLE_LABELS).find((code) => fold(code.replace(/_/g, " ")) === q || code.toLowerCase() === q.replace(/[\s-]+/g, "_"));
  if (byCode) return byCode as UserRole;
  const byLabel = Object.entries(ROLE_LABELS).filter(([, label]) => fold(label) === q || fold(label).includes(q));
  if (byLabel.length === 1) return byLabel[0][0] as UserRole;
  return null;
}

export const ORG_OPS_IMPL: Record<string, OpImpl> = {
  create_account_invite: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      const email = opStr(input, "email").toLowerCase();
      const roleRaw = opStr(input, "role");
      if (!name) return { error: "Précisez le nom complet de la personne (champ « name »)." };
      if (!email || !email.includes("@")) return { error: "Précisez l'e-mail du compte (champ « email »)." };
      const role = roleOf(roleRaw);
      if (!role) {
        return { error: `Rôle « ${roleRaw || "(vide)"} » inconnu. Rôles possibles : ${Object.entries(ROLE_LABELS).map(([c, l]) => `${l} (${c})`).join(", ")}.` };
      }
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return { error: `Un compte existe déjà avec l'e-mail ${email}.` };
      return {
        title: `Créer le compte de ${name} (lien d'invitation)`,
        fields: [
          { label: "Nom", value: name },
          { label: "E-mail", value: email },
          { label: "Rôle", value: `${ROLE_LABELS[role] ?? role} (${role})` },
          ...(opStr(input, "title") ? [{ label: "Fonction", value: opStr(input, "title") }] : []),
          { label: "Lien", value: `valable ${INVITE_TTL_HOURS} h, à usage unique` },
        ],
        warnings: [
          "AUCUN mot de passe ne transite : la personne définit le sien en ouvrant le lien. Transmettez-lui le lien affiché sur le reçu (le compte est inconnectable avant).",
        ],
        args: { name, email, role, title: opStr(input, "title") || null },
        successMessage: `Compte de ${name} créé — transmettre le lien d'invitation.`,
        revalidate: ["/admin"],
      };
    },
    async execute(args, user) {
      const r = await createAccountWithInvite(
        { name: args.name ?? "", email: args.email ?? "", role: (args.role ?? "VIEWER") as UserRole, title: args.title },
        user.id,
      );
      if ("error" in r) return { ok: false, error: r.error };
      return {
        ok: true,
        createdId: r.userId,
        message:
          `Compte créé. Lien d'invitation (valable ${INVITE_TTL_HOURS} h, usage unique) : ${r.path} — ` +
          `à transmettre à la personne, qui définira elle-même son mot de passe.`,
        link: r.path,
        revalidate: ["/admin"],
      };
    },
  },

  create_company: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      if (!name) return { error: "Donnez le nom de l'entité (champ « name »)." };
      return {
        title: `Créer l'entité « ${name} »`,
        fields: [
          { label: "Entité", value: name },
          ...(opStr(input, "shortName") ? [{ label: "Nom court", value: opStr(input, "shortName") }] : []),
        ],
        warnings: ["Le CLOISONNEMENT par entité s'applique aussitôt : les données rattachées à cette entité ne seront visibles que de ses membres (et du Super Admin)."],
        args: { name, shortName: opStr(input, "shortName") },
        successMessage: `Entité « ${name} » créée.`,
        link: "/admin",
        revalidate: ["/admin"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("name", args.name ?? "");
      if (args.shortName) fd.set("shortName", args.shortName);
      const r = await createCompany(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La création de l'entité a été refusée." };
      return { ok: true, createdId: r.id, revalidate: ["/admin"] };
    },
  },

  toggle_company: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const company = await resolveCompanyAny(opStr(input, "name"));
      if ("error" in company) return company;
      return {
        title: `${company.isActive ? "Désactiver" : "Réactiver"} l'entité « ${company.name} »`,
        fields: [{ label: "Entité", value: `${company.name} (${company.isActive ? "active" : "inactive"})` }],
        warnings: [company.isActive
          ? "Désactivée, l'entité sort des menus de rattachement — rien n'est effacé, réversible."
          : "Réactivée, l'entité revient dans les menus de rattachement."],
        args: { id: company.id, name: company.name },
        successMessage: `Entité « ${company.name} » ${company.isActive ? "désactivée" : "réactivée"}.`,
        link: "/admin",
        revalidate: ["/admin"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      const r = await toggleCompany(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le changement d'état de l'entité a été refusé." };
      return { ok: true, revalidate: ["/admin"] };
    },
  },

  create_department: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      if (!name) return { error: "Donnez le nom du département (champ « name »)." };
      let parent: { id: string; name: string } | null = null;
      if (opStr(input, "parent")) {
        const p = await resolveDepartment(opStr(input, "parent"));
        if ("error" in p) return p;
        parent = p;
      }
      let company: { id: string; name: string } | null = null;
      if (!parent && opStr(input, "entity")) {
        const c = await resolveCompanyAny(opStr(input, "entity"));
        if ("error" in c) return c;
        company = c;
      }
      return {
        title: `Créer le département « ${name} »`,
        fields: [
          { label: "Département", value: name },
          { label: "Rattachement", value: parent ? `Sous-département de « ${parent.name} » (même entité)` : company ? `Entité ${company.name}` : "Transverse au groupe" },
        ],
        args: { name, parentId: parent?.id ?? null, companyId: company?.id ?? null },
        successMessage: `Département « ${name} » créé.`,
        link: "/rh",
        revalidate: ["/rh", "/admin"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("name", args.name ?? "");
      if (args.parentId) fd.set("parentId", args.parentId);
      if (args.companyId) fd.set("companyId", args.companyId);
      const r = await createDepartment(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La création du département a été refusée." };
      return { ok: true, createdId: r.id, revalidate: ["/rh", "/admin"] };
    },
  },

  assign_department: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const emp = await resolveEmployeeByName(opStr(input, "employee"), "l'employé");
      if ("error" in emp) return emp;
      const raw = opStr(input, "department");
      const detach = !raw || /^(aucun|retire|détache|detache)/i.test(raw);
      const dept = detach ? null : await resolveDepartment(raw);
      if (dept && "error" in dept) return dept;
      return {
        title: detach ? `Détacher ${emp.fullName} de son département` : `Rattacher ${emp.fullName} au département « ${(dept as { name: string }).name} »`,
        fields: [
          { label: "Employé", value: emp.fullName },
          { label: "Département", value: detach ? "aucun (détaché)" : (dept as { name: string }).name },
        ],
        warnings: ["L'organigramme et les circuits N+1 / responsable de département suivent ce rattachement."],
        args: { employeeId: emp.id, departmentId: detach ? null : (dept as { id: string }).id, employee: emp.fullName },
        successMessage: detach ? `${emp.fullName} détaché de son département.` : `${emp.fullName} rattaché à « ${(dept as { name: string }).name} ».`,
        link: "/rh",
        revalidate: ["/rh"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("employeeId", args.employeeId ?? "");
      if (args.departmentId) fd.set("departmentId", args.departmentId);
      const r = await assignEmployeeDepartment(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le rattachement a été refusé." };
      return { ok: true, revalidate: ["/rh"] };
    },
  },

  assign_manager: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const emp = await resolveEmployeeByName(opStr(input, "employee"), "l'employé");
      if ("error" in emp) return emp;
      const raw = opStr(input, "manager");
      const detach = !raw || /^(aucun|retire|personne)/i.test(raw);
      const manager = detach ? null : await resolveEmployeeByName(raw, "le responsable (N+1)");
      if (manager && "error" in manager) return manager;
      if (manager && manager.id === emp.id) return { error: "Un employé ne peut pas être son propre N+1." };
      return {
        title: detach ? `Retirer le N+1 de ${emp.fullName}` : `Désigner ${(manager as { fullName: string }).fullName} comme N+1 de ${emp.fullName}`,
        fields: [
          { label: "Employé", value: emp.fullName },
          { label: "Responsable (N+1)", value: detach ? "aucun" : (manager as { fullName: string }).fullName },
        ],
        warnings: ["Les circuits de validation qui remontent au N+1 suivent cette désignation."],
        args: { employeeId: emp.id, managerId: detach ? null : (manager as { id: string }).id, employee: emp.fullName },
        successMessage: detach ? `N+1 de ${emp.fullName} retiré.` : `${(manager as { fullName: string }).fullName} désigné N+1 de ${emp.fullName}.`,
        link: "/rh",
        revalidate: ["/rh"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("employeeId", args.employeeId ?? "");
      if (args.managerId) fd.set("managerId", args.managerId);
      const r = await assignEmployeeManager(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La désignation du N+1 a été refusée." };
      return { ok: true, revalidate: ["/rh"] };
    },
  },

  create_supplier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      if (!name) return { error: "Donnez le nom du fournisseur (champ « name »)." };
      return {
        title: `Créer le fournisseur « ${name} »`,
        fields: [
          { label: "Fournisseur", value: name },
          ...(opStr(input, "country") ? [{ label: "Pays", value: opStr(input, "country") }] : []),
          ...(opStr(input, "email") ? [{ label: "E-mail de contact", value: opStr(input, "email") }] : []),
        ],
        warnings: ["Les accès de son portail externe se gèrent ensuite depuis sa fiche (jamais de mot de passe par ce chat)."],
        args: { name, country: opStr(input, "country"), contactEmail: opStr(input, "email"), notes: opStr(input, "notes") },
        successMessage: `Fournisseur « ${name} » créé.`,
        link: "/admin",
        revalidate: ["/admin"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("name", args.name ?? "");
      if (args.country) fd.set("country", args.country);
      if (args.contactEmail) fd.set("contactEmail", args.contactEmail);
      if (args.notes) fd.set("notes", args.notes);
      const r = await createSupplier(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La création du fournisseur a été refusée." };
      return { ok: true, createdId: r.id, revalidate: ["/admin"] };
    },
  },

  toggle_supplier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const q = opStr(input, "name");
      if (!q) return { error: "Précisez le nom du fournisseur (champ « name »)." };
      const rows = await prisma.supplier.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, active: true },
        take: 4,
      });
      if (rows.length === 0) return { error: `Aucun fournisseur « ${q} ».` };
      if (rows.length > 1) return { error: `Plusieurs fournisseurs correspondent à « ${q} » : ${rows.map((r) => r.name).join(", ")} — préciser.` };
      const supplier = rows[0];
      return {
        title: `${supplier.active ? "Désactiver" : "Réactiver"} le fournisseur « ${supplier.name} »`,
        fields: [{ label: "Fournisseur", value: `${supplier.name} (${supplier.active ? "actif" : "inactif"})` }],
        warnings: [supplier.active ? "Désactivé, son portail externe ne répond plus (réversible)." : "Réactivé, son portail externe répond à nouveau."],
        args: { id: supplier.id, name: supplier.name },
        successMessage: `Fournisseur « ${supplier.name} » ${supplier.active ? "désactivé" : "réactivé"}.`,
        link: "/admin",
        revalidate: ["/admin"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      const r = await toggleSupplier(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le changement d'état du fournisseur a été refusé." };
      return { ok: true, revalidate: ["/admin"] };
    },
  },

  create_contact: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      if (!name) return { error: "Donnez le nom du contact (champ « name » — ex. « Imprimerie El Djazaïr »)." };
      const kind = opStr(input, "kind");
      const contactName = opStr(input, "contactName");
      const phone = opStr(input, "phone");
      const email = opStr(input, "email");
      return {
        title: `Ajouter le contact « ${name} » à l'annuaire d'entreprise`,
        fields: [
          { label: "Contact", value: name },
          ...(kind ? [{ label: "Nature", value: kind }] : []),
          ...(contactName ? [{ label: "Personne", value: contactName }] : []),
          ...(phone ? [{ label: "Téléphone", value: phone }] : []),
          ...(email ? [{ label: "E-mail", value: email }] : []),
        ],
        args: { name, kind, contactName, phone, email, address: opStr(input, "address") },
        successMessage: `Contact « ${name} » ajouté à l'annuaire d'entreprise.`,
        revalidate: ["/moyens-generaux"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("name", args.name ?? "");
      if (args.kind) fd.set("kind", args.kind);
      if (args.contactName) fd.set("contactName", args.contactName);
      if (args.phone) fd.set("phone", args.phone);
      if (args.email) fd.set("email", args.email);
      if (args.address) fd.set("address", args.address);
      const r = await createCompanyContact(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'ajout du contact a été refusé." };
      return { ok: true, createdId: r.id, revalidate: ["/moyens-generaux"] };
    },
  },
};
