import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // unpdf porta con sé una build di pdf.js: fuori dal bundle del server,
  // dove va caricata a runtime e solo quando serve davvero.
  serverExternalPackages: ['unpdf'],
}

export default nextConfig
