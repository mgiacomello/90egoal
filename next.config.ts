import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habeas Mentem Lab, costruito da scripts/build-lab.mjs in public/lab:
  // /lab apre la pagina, gli asset restano in /lab/assets.
  // Sul sottodominio del laboratorio (lab.neurolegalcortex.com, o qualunque
  // host che inizi con "lab.") la radice apre direttamente il laboratorio:
  // gli asset restano in /lab/assets, che esiste sullo stesso host.
  async rewrites() {
    return [
      { source: "/", has: [{ type: "host", value: "lab\\..*" }], destination: "/lab/index.html" },
      { source: "/lab", destination: "/lab/index.html" },
    ];
  },
  async headers() {
    const bluetooth = [{ key: "Permissions-Policy", value: "bluetooth=(self)" }];
    return [
      { source: "/lab/:path*", headers: bluetooth },
      { source: "/", has: [{ type: "host", value: "lab\\..*" }], headers: bluetooth },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
};

export default nextConfig;
