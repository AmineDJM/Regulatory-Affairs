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
    // ── MÉMOIRE DE BUILD : borner le PARALLÉLISME, pas la fonctionnalité ──────────────
    //
    // Mesuré sur un build propre (4 vCPU, échantillonnage RSS de l'arbre node) :
    //   compilation webpack …… pic 4612 Mo (1 processus à 4491)
    //   typecheck tsc ………………… pic 2692 Mo (phase distincte, jamais simultanée)
    //   génération statique …… pic 3924 Mo = parent 2005 + 3 workers à ~550 Mo
    //
    // Le piège : Next dimensionne ses workers sur le NOMBRE DE CŒURS de la machine de
    // build. Ici 4 cœurs → 3 workers → 3,9 Go. Sur un builder Render à 8 ou 16 vCPU, la
    // même étape réclame 2005 + 7×550 ≈ 5,9 Go, voire ≈ 10 Go — d'où le « Ran out of
    // memory (used over 8GB) » que la machine de développement ne reproduit jamais.
    // Le pic ne dépendait donc pas du code mais du matériel : on le BORNE.
    //
    // `cpus` plafonne les workers de collecte/génération de pages. Deux workers gardent
    // le parallélisme utile en rendant le pic INDÉPENDANT du builder.
    cpus: 2,
    // Chaque compilation (serveur, client, edge) tourne dans son propre processus, qui
    // MEURT ensuite : la mémoire retourne à l'OS au lieu de s'accumuler dans un seul tas
    // pour les trois. C'est ce qui plafonne le pic de la phase de compilation.
    webpackBuildWorker: true,
    // LE PLUS GROS LEVIER MESURÉ : −1034 Mo sur le pic (4548 → 3514) et −127 s de
    // compilation. Le pic tombait en FIN de compilation — signature de la minification.
    //
    // Ce qu'on abandonne : les bundles SERVEUR (jamais téléchargés par le navigateur)
    // restent non minifiés, donc plus gros sur le disque et un démarrage à froid
    // marginalement plus lent. Ce qu'on garde intact : la minification CLIENT — les
    // bundles réellement servis au navigateur — et tout le reste du comportement.
    // Aucune vérification n'est désactivée, aucune fonctionnalité retirée.
    serverMinification: false,
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
