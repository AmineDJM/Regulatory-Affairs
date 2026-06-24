import { icons, type LucideProps } from "lucide-react";

interface IconProps extends LucideProps {
  name: string;
}

/** Renders a lucide-react icon by name (used by config-driven navigation). */
export function Icon({ name, ...props }: IconProps) {
  const LucideIcon = icons[name as keyof typeof icons];
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
}
