import type { NextConfig } from "next";

// Android Remote Control — configuration Next.js (output standalone pour Docker).
// Les en-têtes de sécurité HTTP sont posés ici ET dans Nginx (défense en profondeur).

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
