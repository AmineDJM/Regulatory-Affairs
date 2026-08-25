/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // PAS un contournement : le lint tourne en PHASE SÉPARÉE et BLOQUANTE du build de
    // déploiement (`npm run build:render` → `next lint && next build`). Le faire tourner une
    // seconde fois DANS `next build` additionnait ~1 Go (ESLint) aux ~1,4 Go du typecheck
    // (Prisma : 560 K lignes de définitions) dans le MÊME processus Node → OOM à la limite
    // par défaut de 2 Go sur Render (« Ineffective mark-compacts near heap limit »). Le
    // typecheck, lui, reste DANS le build (`typescript.ignoreBuildErrors` n'est PAS touché).
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Libs Node serveur uniquement (jamais bundlées côté client) : auth, mail (IMAP/SMTP),
    // extraction/OCR (tesseract.js/mupdf/sharp = WASM/natif, à ne pas bundler).
    serverComponentsExternalPackages: ["bcryptjs", "imapflow", "nodemailer", "mailparser", "pdf-parse", "mammoth", "xlsx", "tesseract.js", "mupdf", "sharp", "docxtemplater", "pizzip"],
    // Téléversements via Server Action (documents Regulatory/Congrès/Dossiers…) : Next
    // plafonne le corps à 1 Mo par défaut, ce qui rendait inopérante la limite réglée par
    // l'admin. On lève ce plafond à 256 Mo ; la VRAIE limite reste celle définie par le
    // Super Admin (AppSetting → validateUpload). Les très gros fichiers passent par le Drive
    // (routes en flux, jusqu'à la limite Drive configurée).
    serverActions: { bodySizeLimit: "256mb" },
  },
  // Security headers applied to every response.
  async headers() {
    // CSP volontairement ciblée sur les directives à fort impact ET sans risque
    // de casse : on NE restreint PAS script-src/style-src/connect-src (Next.js
    // injecte des scripts/styles inline ; l'éditeur OnlyOffice charge son api.js
    // et s'affiche en iframe ; l'aperçu e-mail/PDF utilise blob:/data:). On bloque
    // en revanche le clickjacking, les plugins, l'injection de <base> et le
    // détournement de formulaires, et on force HTTPS.
    const csp = [
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // SAMEORIGIN (et non DENY) : protège du clickjacking cross-origin tout en
          // autorisant l'app à embarquer ses propres fichiers (aperçu PDF in-app).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // `self` (et non liste vide) : autorise micro (rapports vocaux), caméra
            // (scan QR check-in) et géolocalisation pour NOTRE origine uniquement.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          { key: "Content-Security-Policy", value: csp },
          // Force HTTPS pendant 2 ans (Render sert en HTTPS) — anti-downgrade / MITM.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Isolation des fenêtres (anti-XS-Leaks / tabnabbing).
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default nextConfig;
