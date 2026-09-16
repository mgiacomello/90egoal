import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf porta con sé una build di pdf.js: fuori dal bundle del server,
  // dove va caricata a runtime e solo quando serve davvero.
  serverExternalPackages: ["unpdf"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default nextConfig;
