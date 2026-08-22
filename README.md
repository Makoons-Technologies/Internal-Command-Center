# Makoons Command Center

Internal personal ops board. Not Viselle product UI.

Source of truth: [MVP-SPEC.md](./MVP-SPEC.md).

## Local

```bash
npm install
npm run seed
npm run dev
```

Board: [http://localhost:3000](http://localhost:3000)

Local MCP (stdio):

```bash
npm run mcp
```

## What to give Grok (once live)

Grok connects over HTTP MCP, not stdio.

1. **MCP URL:** `https://YOUR_DOMAIN/api/mcp`  
   Or the subdomain, if you set one: `https://mcp.YOUR_DOMAIN`
2. **Header:** `Authorization: Bearer COMMAND_CENTER_TOKEN`
3. **Access:** every tool — cards and the COO checklist

Tools: `list_cards`, `upsert_card`, `complete_card`, `flag_blocker`, `get_needs_joseph`, `list_checklist`, `add_checklist_item`, `update_checklist_item`, `toggle_checklist_item`, `delete_checklist_item`, `reorder_checklist`.

## What to give the COO

1. **Board URL:** `https://YOUR_DOMAIN`
2. **The same `COMMAND_CENTER_TOKEN`** — they paste it on `/login`

## Vercel

Production uses Turso via the Vercel Marketplace (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). Local stays on `data/makoons.db` unless those vars are set.

`COMMAND_CENTER_TOKEN` gates `/login` and `/api/mcp`. Custom domains / `MCP_SUBDOMAIN_HOST` can wait.
