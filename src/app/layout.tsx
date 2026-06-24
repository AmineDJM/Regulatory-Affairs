import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMD Internal OS — Adventum Pharma",
  description:
    "Logiciel interne centralisé pour la gestion des pôles Regulatory, Sponsoring, Budgets, Congrès, Ventes, Logistique PCH, Promotion médicale et Business Development d'Adventum Pharma.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
