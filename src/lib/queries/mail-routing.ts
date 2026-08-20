import { prisma } from "@/lib/prisma";
import { getDepartmentOptions } from "@/lib/departments";

/**
 * À QUI S'ADRESSE UN PLI — les deux menus du registre des courriers.
 *
 * La DIRECTION vient de l'organigramme réel (les mêmes départements que partout ailleurs :
 * budgets, validations, RH), indentée selon sa profondeur — pas d'une liste écrite à la main qui
 * aurait vieilli dès la première réorganisation. La PERSONNE est un compte actif : un pli ne
 * s'adresse pas à quelqu'un qui a quitté la société.
 *
 * Extrait ici parce que les DEUX écrans en ont besoin — la liste (pour enregistrer) et la fiche
 * (pour corriger). Recopiés, les deux menus auraient divergé, et l'on ne pourrait plus corriger
 * sur la fiche un rattachement qu'on peut poser à la création.
 */
export async function mailRoutingOptions(): Promise<{
  departments: { value: string; label: string }[];
  people: { value: string; label: string }[];
}> {
  const [departments, people] = await Promise.all([
    getDepartmentOptions(),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    departments: departments.map((d) => ({ value: d.id, label: d.label })),
    people: people.map((u) => ({ value: u.id, label: u.name })),
  };
}
