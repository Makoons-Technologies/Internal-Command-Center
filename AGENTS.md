<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Always commit and push

After finishing work that changes files, commit and push in the same turn. Do not wait to be asked.

- Stage the files you changed (and any new files that belong in the repo).
- Commit with a concise message that says why the change exists.
- Push the current branch to `origin` (`-u` if it has no upstream).
- Do not leave finished work uncommitted.
- Do not commit `.env`, `.env.local`, tokens, keys, or credential files.
- Do not force-push, skip hooks, or rewrite history unless the user explicitly asks.
- Do not push to `main`/`master` with `--force`.
