/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Libs Node serveur uniquement (jamais bundlées côté client) : auth, mail (IMAP/SMTP).
    serverComponentsExternalPackages: ["bcryptjs", "imapflow", "nodemailer", "mailparser"],
  },
  // Security headers applied to every response.
  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;
