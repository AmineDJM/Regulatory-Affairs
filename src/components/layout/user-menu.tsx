"use client";

import * as React from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { doSignOut } from "@/lib/actions/auth-actions";
import { ROLE_LABELS } from "@/lib/labels";

interface UserMenuProps {
  name: string;
  email: string;
  role: string;
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-secondary"
      >
        <Avatar name={name} size="sm" />
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-tight">{name}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {ROLE_LABELS[role] ?? role}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 animate-fade-in rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          <div className="px-2.5 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <form action={doSignOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
