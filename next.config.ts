import type { NextConfig } from "next";

const mcpHost = process.env.MCP_SUBDOMAIN_HOST?.trim();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "@libsql/linux-x64-gnu", "@libsql/win32-x64-msvc"],
  async rewrites() {
    if (!mcpHost) return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: mcpHost }],
        destination: "/api/mcp",
      },
    ];
  },
};

export default nextConfig;
