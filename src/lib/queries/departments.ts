import { prisma } from "@/lib/prisma";

export interface DepartmentLeaf {
  id: string;
  name: string;
  code: string;
  members: number;
}
export interface DepartmentNode extends DepartmentLeaf {
  children: DepartmentLeaf[];
}

/** Arbre des départements (têtes + leurs sous-départements) avec le nombre d'employés rattachés. */
export async function getDepartmentsTree(): Promise<DepartmentNode[]> {
  const depts = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });
  const leaf = (d: (typeof depts)[number]): DepartmentLeaf => ({ id: d.id, name: d.name, code: d.code, members: d._count.users });
  return depts
    .filter((d) => !d.parentId)
    .map((t) => ({ ...leaf(t), children: depts.filter((c) => c.parentId === t.id).map(leaf) }));
}
