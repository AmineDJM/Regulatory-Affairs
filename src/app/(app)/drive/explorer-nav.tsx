import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { QUICK_ACCESS, DRIVE_ROOT, TRASH_ENTRY } from "@/lib/drive/explorer";

/**
 * LE VOLET DE NAVIGATION — la colonne de gauche d'un explorateur de fichiers.
 *
 * C'est elle qui rend un explorateur reconnaissable : l'accès rapide en haut (ce qu'on vient de
 * toucher), les emplacements ensuite, la corbeille en bas. Sans elle, on ne sait plus « où » l'on
 * est ni où l'on peut aller — il ne reste qu'une liste, et il faut s'en souvenir.
 *
 * Sur mobile elle passe à l'horizontale : un volet fixe mangerait la moitié d'un écran de
 * téléphone, et l'ordre des entrées suffit alors à jouer le même rôle.
 */
export function ExplorerNav({
  active, spaces,
}: {
  /** Clé de l'entrée courante : `recent`, `downloads`, `root`, `trash`, ou l'id d'une catégorie. */
  active: string;
  spaces: { id: string; name: string; icon: string | null }[];
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-0.5">
      <p className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );

  const Entry = ({ href, icon, label, k }: { href: string; icon: string; label: string; k: string }) => (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
        active === k ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-secondary"
      }`}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0 opacity-80" />
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="surface w-full shrink-0 p-2 lg:w-56" aria-label="Emplacements du Drive">
      <Section title="Accès rapide">
        {QUICK_ACCESS.map((e) => <Entry key={e.key} href={e.href} icon={e.icon} label={e.label} k={e.key} />)}
      </Section>

      <Section title="Emplacements">
        <Entry href={DRIVE_ROOT.href} icon={DRIVE_ROOT.icon} label={DRIVE_ROOT.label} k={DRIVE_ROOT.key} />
        {spaces.map((s) => (
          <Entry key={s.id} href={`/drive/espace/${s.id}`} icon={s.icon || "FolderOpen"} label={s.name} k={s.id} />
        ))}
      </Section>

      <div className="mt-2 border-t border-border pt-2">
        <Entry href={TRASH_ENTRY.href} icon={TRASH_ENTRY.icon} label={TRASH_ENTRY.label} k={TRASH_ENTRY.key} />
      </div>
    </nav>
  );
}
