import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.BACKEND_URL ??
  "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // beforeFiles rewrites run BEFORE Next.js checks its own pages/routes.
      // This guarantees /api/* is always proxied to the backend, never
      // matched against app/api/ route handlers (which don't exist here).
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${BACKEND_URL}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
