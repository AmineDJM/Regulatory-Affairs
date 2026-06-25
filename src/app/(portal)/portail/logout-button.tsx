"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supplierLogout } from "@/lib/actions/supplier-portal-actions";
import { Button } from "@/components/ui/button";

export function SupplierLogoutButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(async () => { await supplierLogout(); router.replace("/portail/login"); router.refresh(); })}
    >
      <LogOut className="h-4 w-4" /> Déconnexion
    </Button>
  );
}
