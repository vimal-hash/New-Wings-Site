import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){
    return ["models","textures","basis","draco"].map(folder=>({
      source:`/${folder}/:path*`,has:[{type:"query" as const,key:"v",value:"[a-f0-9]{12}"}],
      headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}],
    }));
  },
  /* config options here */
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
