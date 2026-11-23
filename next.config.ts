import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const folders = ["models", "textures", "basis", "draco", "rope-model", "rope-laptop", "rope-flight-laptop", "sound"];
    const paths = [...folders.map(folder => `/${folder}/:path*`), "/images/theatre-screen-ghosted.webp"];
    return paths.map(source => ({
      source,
      has: [{ type: "query" as const, key: "v", value: "[a-f0-9]{12}" }],
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }));
  },
  allowedDevOrigins: ["192.168.1.5","192.168.1.6"], // this computer on the local network (its address changes), so the dev page can be opened from a laptop
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
