import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createCommandCenterServer } from "./create-server";

void serveStdio(createCommandCenterServer);
console.error("Makoons Command Center MCP server running on stdio");
