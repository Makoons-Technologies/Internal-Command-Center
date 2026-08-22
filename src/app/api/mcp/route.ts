import { createMcpHandler } from "@modelcontextprotocol/server";
import { isValidBearer } from "@/lib/auth";
import { createCommandCenterServer } from "@/mcp/create-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const mcp = createMcpHandler(createCommandCenterServer);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

function unauthorized(): Response {
  return withCors(
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    }),
  );
}

async function handle(request: Request): Promise<Response> {
  if (!isValidBearer(request.headers.get("authorization"))) {
    return unauthorized();
  }
  return withCors(await mcp.fetch(request));
}

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}
