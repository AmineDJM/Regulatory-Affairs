"use client";

import * as React from "react";
import { Bot, Search, Check, Paperclip, Mail, FolderKanban, Send, Sparkles } from "lucide-react";

/**
 * « Captures » illustrées (mini-maquettes fidèles, sans dépendre d'images) des
 * outils transverses, pour l'étape de découverte de l'onboarding. Pur visuel.
 */

function Frame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-secondary/40 px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <span className="ml-2 text-[0.625rem] font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/** Assistant IA flottant : question en langage naturel → carte d'action confirmable. */
export function AssistantPreview() {
  return (
    <Frame title="Assistant — partout, en bas à droite">
      <div className="space-y-2 text-[0.6875rem]">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-primary-foreground">
          Crée un projet « Prix billets congrès Alger » pour Radia
        </div>
        <div className="flex items-start gap-1.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Bot className="h-3 w-3" /></span>
          <div className="w-full rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">
            <p className="mb-1.5 text-muted-foreground">C'est prêt — je crée ce projet :</p>
            <div className="rounded-lg border border-border bg-card p-2">
              <p className="flex items-center gap-1.5 font-medium"><FolderKanban className="h-3 w-3 text-primary" /> Nouveau projet</p>
              <p className="mt-0.5 text-muted-foreground">Responsable : Radia · Priorité : Normale</p>
              <div className="mt-1.5 flex gap-1.5">
                <span className="rounded bg-primary px-2 py-0.5 text-[0.625rem] font-medium text-primary-foreground">Confirmer</span>
                <span className="rounded border border-border px-2 py-0.5 text-[0.625rem]">Annuler</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Recherche universelle (⌘K) : sauter à un module ou un enregistrement. */
export function SearchPreview() {
  return (
    <Frame title="Recherche universelle">
      <div className="space-y-2 text-[0.6875rem]">
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Aller à…</span>
          <kbd className="ml-auto rounded border border-border px-1 py-0.5 text-[0.5625rem]">⌘K</kbd>
        </div>
        {[
          { i: <FolderKanban className="h-3 w-3" />, t: "Projets", s: "Module" },
          { i: <Mail className="h-3 w-3" />, t: "Courrier", s: "Module" },
          { i: <Sparkles className="h-3 w-3" />, t: "Dr. Benali — visite", s: "Médecin" },
        ].map((r) => (
          <div key={r.t} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-muted-foreground">{r.i}</span>
            <span className="font-medium">{r.t}</span>
            <span className="ml-auto text-[0.625rem] text-muted-foreground">{r.s}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Courrier : boîte e-mail pro intégrée. */
export function CourrierPreview() {
  return (
    <Frame title="Courrier — votre boîte pro">
      <div className="grid grid-cols-[1fr_2fr] gap-2 text-[0.6875rem]">
        <div className="space-y-1">
          {["Réception", "Envoyés", "Brouillons"].map((f, i) => (
            <div key={f} className={`flex items-center justify-between rounded-md px-2 py-1 ${i === 0 ? "bg-card font-medium shadow-sm ring-1 ring-primary/10" : "text-muted-foreground"}`}>
              <span>{f}</span>{i === 0 && <span className="rounded-full bg-primary px-1.5 text-[0.5625rem] text-primary-foreground">3</span>}
            </div>
          ))}
          <div className="mt-1 flex items-center justify-center gap-1 rounded-md bg-gradient-to-r from-primary to-primary/80 px-2 py-1 text-[0.625rem] font-medium text-primary-foreground"><Send className="h-3 w-3" /> Nouveau</div>
        </div>
        <div className="space-y-1">
          {[
            { n: "PCH", s: "Bon de commande #2231", u: true },
            { n: "Khaled D.", s: "Re: logos produits", u: false },
            { n: "ANPP", s: "Accusé de réception", u: false },
          ].map((m) => (
            <div key={m.s} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.5625rem] font-semibold text-accent-foreground">{m.n[0]}</span>
              <div className="min-w-0">
                <p className={m.u ? "font-semibold" : ""}>{m.n}</p>
                <p className="truncate text-[0.625rem] text-muted-foreground">{m.s}</p>
              </div>
              {m.u && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Dossier de suivi : un sujet, tout au même endroit. */
export function DossierPreview() {
  return (
    <Frame title="Projet">
      <div className="space-y-2 text-[0.6875rem]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-semibold"><FolderKanban className="h-3.5 w-3.5 text-primary" /> Analyse IQVIA — Cardio</p>
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[0.5625rem] font-medium text-warning">En cours</span>
        </div>
        <div className="flex gap-1.5">
          {["Discussion", "Fichiers", "E-mails"].map((t, i) => (
            <span key={t} className={`rounded px-2 py-0.5 ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{t}</span>
          ))}
        </div>
        <div className="space-y-1 rounded-lg border border-border bg-secondary/30 p-2">
          <p className="flex items-center gap-1.5"><Paperclip className="h-3 w-3 text-muted-foreground" /> Rapport_IQVIA.xlsx</p>
          <p className="flex items-center gap-1.5"><Paperclip className="h-3 w-3 text-muted-foreground" /> Synthèse.pptx</p>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-3 w-3 text-success" /> Yacine a ajouté les chiffres Q2</div>
      </div>
    </Frame>
  );
}
