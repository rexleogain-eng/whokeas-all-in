import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "whokeas\\.store",
          },
        ],
        destination: "https://www.whokeas.store/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
