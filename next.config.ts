import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habeas Mentem Lab, costruito da scripts/build-lab.mjs in public/lab:
  // /lab apre la pagina, gli asset restano in /lab/assets.
  async rewrites() {
    return [{ source: "/lab", destination: "/lab/index.html" }];
  },
  async headers() {
    return [{ source: "/lab/:path*", headers: [{ key: "Permissions-Policy", value: "bluetooth=(self)" }] }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default nextConfig;
