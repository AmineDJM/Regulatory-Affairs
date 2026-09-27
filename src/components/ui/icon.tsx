import * as React from "react";
import * as Lucide from "lucide-react";
import { icons, type LucideProps } from "lucide-react";

interface IconProps extends LucideProps {
  name: string;
}

type ComposantIcone = (typeof icons)[keyof typeof icons];

/**
 * UN NOM D'ICÔNE → SON COMPOSANT — le seul endroit du dépôt où une chaîne devient une icône.
 *
 * lucide a RENOMMÉ une partie de ses icônes (`AlertTriangle` → `TriangleAlert`, `CheckCircle2` →
 * `CircleCheck`…). L'import nommé de l'ancien nom marche encore ; la table `icons`, elle, ne
 * connaît que le nom d'aujourd'hui. Mesuré (§118.149) : sept noms passés en chaîne dans le dépôt
 * ne résolvaient RIEN — des cartes d'indicateurs et des états vides sans icône, sur une douzaine
 * d'écrans, sans la moindre erreur. On accepte donc l'ancien nom que le module exporte encore :
 * c'est lui qui dit ce qu'il connaît, pas une table d'alias écrite ici, qui serait fausse au
 * prochain renommage (§118.73). Seul un composant d'icône est rendu : un export qui n'en est pas
 * un (une fonction utilitaire, la table elle-même) rend `null`.
 */
export function iconeParNom(name: string): ComposantIcone | null {
  const canonique = icons[name as keyof typeof icons];
  if (canonique) return canonique;
  const alias = (Lucide as unknown as Record<string, unknown>)[name];
  return alias !== null && typeof alias === "object" && "render" in alias ? (alias as unknown as ComposantIcone) : null;
}

/** Renders a lucide-react icon by name (used by config-driven navigation). */
export function Icon({ name, ...props }: IconProps) {
  const LucideIcon = iconeParNom(name);
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
}
