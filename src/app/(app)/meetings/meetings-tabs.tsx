"use client";

import * as React from "react";

/**
 * Onglets « À venir & en cours » / « Passées ». Les deux blocs sont rendus côté serveur
 * et simplement masqués par CSS pour éviter tout re-rendu. Les réunions passées restent
 * visibles dans le Calendrier (module distinct) — seul le listing actif les écarte.
 */
export function MeetingsTabs({
  active, past, activeCount, pastCount,
}: {
  active: React.ReactNode;
  past: React.ReactNode;
  activeCount: number;
  pastCount: number;
}) {
  const [tab, setTab] = React.useState<"active" | "past">("active");
  const btn = (key: "active" | "past", label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${tab === key ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-secondary"}`}
    >
      {label} <span className="ml-1 rounded-full bg-secondary px-1.5 text-xs">{count}</span>
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {btn("active", "À venir & en cours", activeCount)}
        {btn("past", "Passées", pastCount)}
      </div>
      <div className={tab === "active" ? "" : "hidden"}>{active}</div>
      <div className={tab === "past" ? "" : "hidden"}>{past}</div>
    </div>
  );
}
