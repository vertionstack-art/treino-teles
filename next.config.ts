import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O service worker precisa ser conferido a cada abertura para as atualizações chegarem
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default nextConfig;
