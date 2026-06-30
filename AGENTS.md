# AGENTS.md - AI Agent Coding Guide

This guide is for AI coding agents working in the OpenClaude repository. Read it before changing code, and also follow [CONTRIBUTING.md](CONTRIBUTING.md) for contributor policy, PR expectations, review follow-up, and project scope.

## Project Snapshot

OpenClaude is a coding-agent CLI for cloud and local model providers. It supports OpenAI-compatible APIs, Anthropic, Gemini, DeepSeek, Ollama, MCP, local backends, slash commands, tools, agents, and a React/Ink terminal UI.

The installed CLI runs on Node.js `>=22.0.0`. Bun is used for source builds, scripts, dependency management, and tests.

## Work Style

- Keep changes focused on one problem.
- Prefer existing patterns in the file or nearby module.
- Avoid unrelated formatting, renames, dependency changes, or broad rewrites.
- Add or update tests when behavior changes.
- Update docs when setup, commands, provider behavior, or user-facing behavior changes.
- For new features, larger refactors, dependencies, or runtime changes, follow the issue-first guidance in [CONTRIBUTING.md](CONTRIBUTING.md).

## Stack And Conventions

- TypeScript with strict mode and ESM imports.
- React + Ink for terminal UI.
- Bun lockfile and Bun scripts for development workflows.
- Node runtime for the built CLI.
- Python exists for legacy/local-provider helper code. Do not add new Python code or expand Python-based features unless a maintainer explicitly approves that direction.

Common libraries and patterns:

- `chalk` for terminal color.
- `commander` for CLI argument parsing.
- `execa` for child processes.
- Existing service, provider, settings, permission, and UI patterns over new abstractions.

## Repository Map

- `src/commands/` - slash and CLI command implementations.
- `src/components/` - React/Ink UI components.
- `src/services/` - API, MCP, OAuth, wiki, voice, and other service integrations.
- `src/tools/` - tool implementations.
- `src/utils/` - shared utilities.
- `src/integrations/` - provider and model integration metadata.
- `src/entrypoints/` - CLI, MCP, SDK, and generated public types.
- `src/tasks/` - local, remote, workflow, and monitor task handling.
- `docs/integrations/` - provider integration guidance.
- `web/` - documentation website.
- `python/` - legacy/local-provider helper code and tests; maintain existing code here, but prefer TypeScript for new implementation.

## Technical Navigation Map

Use this map when changing chat UX, WebUI migration code, sessions, provider logic, or tool behavior.

Chat window and message rendering:

- `src/screens/REPL.tsx` - main interactive chat screen. It wires prompt input, message list, slash-command overlays, permissions, status, and fullscreen layout.
- `src/components/Messages.tsx` - transcript list renderer.
- `src/components/Message.tsx`, `src/components/MessageRow.tsx`, and `src/components/Message*.tsx` - individual message, role-specific rows, assistant/tool output, loading, and metadata display.
- `src/components/PromptInput/` - prompt composer implementation, footer controls, shimmer/input behavior, model and command affordances.
- `src/components/BaseTextInput.tsx` and `src/components/TextInput.tsx` - lower-level text input behavior used by prompt input flows.
- `src/components/ui/` - WebUI-oriented shadcn-style reusable components. Keep browser-only visual components here when they should not replace terminal Ink primitives globally.
- `webui/repl.css` - primary WebUI stylesheet for the REPL/chat migration, including message bubbles, prompt input, permission cards, pickers, and browser-specific layout polish.

Layouts and WebUI runtime:

- `src/components/FullscreenLayout.tsx` - top-level fullscreen shell used around REPL surfaces.
- `webui/` - browser entrypoint, Vite config, shims, and WebUI-specific runtime files.
- `webui/bootstrap.tsx` - browser bootstrap and runtime guard behavior.
- `webui/shims/` - browser replacements for Node/Bun modules. If code reaches Node APIs in WebUI, check these shims before changing app logic.
- `src/utils/imports.ts` - shared import/runtime helpers, including browser-runtime checks and terminal-control stripping utilities.

Sessions, conversations, and transcript storage:

- `src/utils/sessionStorage.ts` - main session/transcript manager, JSONL append queue, `/resume` log discovery, transcript loading, renaming, summaries, tags, and metadata.
- `src/utils/sessionStoragePortable.ts` - portable transcript metadata readers used by session discovery and resume flows.
- `src/utils/sessionPersistencePolicy.ts` - rules for when session entries should or should not be persisted.
- `src/utils/getWorktreePaths.ts` and `src/utils/getWorktreePathsPortable.ts` - worktree/session discovery helpers used by resume and title search.
- `src/commands/resume/` and `/resume` command handlers under `src/commands/` - resume command UI/control flow.
- Browser WebUI cannot use the real Node filesystem directly. Browser transcript persistence depends on `webui/shims/nodeBuiltins.js`; do not add browser session code that assumes native `fs` access.

Input, commands, permissions, and keybindings:

- `src/commands/` - slash command definitions and handlers.
- `src/components/permissions/` - permission request UI and decision handling for tools such as WebFetch, Bash, file edits, and MCP tools.
- `src/keybindings/` - keybinding setup, command routing, and keymap state.
- `src/keybindings/KeybindingProviderSetup.tsx` - keybinding provider wiring used by the interactive app.

Providers, models, clients, and query execution:

- `src/query.ts` and `src/QueryEngine.ts` - model query orchestration, streaming, tool-use handling, and conversation execution flow.
- `src/services/api/` - API clients, provider request/response plumbing, session ingress, and backend integrations.
- `src/integrations/` - provider and model metadata, recommendation data, and integration-specific configuration.
- `src/components/ProviderManager.tsx` and provider-related components in `src/components/` - provider profile UI and user-facing provider settings.
- `docs/integrations/` - provider implementation guidance. Read this before changing provider behavior.

Tools and MCP:

- `src/tools/` - tool implementations such as Bash, WebFetch, file operations, and REPL helpers.
- `src/services/tools/` - tool coordination and shared tool services.
- `src/services/mcp/` - MCP client/server connection management, resource/tool discovery, and MCP runtime state.
- `src/services/mcp/MCPConnectionManager.tsx` - MCP connection UI/status surface. Keep browser presentation separate from core connection behavior.

## Validation

Run the narrowest useful checks for your change, and list the exact commands in the PR.

Core checks:

```bash
bun install
bun run build
bun run smoke
bun run check
bun run typecheck
bun run typecheck:type-tests
```

Focused checks:

```bash
bun test ./path/to/test-file.test.ts
bun run test:provider
bun run test:provider-recommendation
```

Python checks, only when touching existing Python helper code:

```bash
python -m pytest -q python/tests
```

Web checks, when touching `web/`:

```bash
bun run web:typecheck
bun run web:build
```

Diagnostics and PR hygiene:

```bash
bun run doctor:runtime
bun run security:pr-scan
```

## Provider Changes

When modifying provider behavior:

1. Start with `docs/integrations/overview.md`.
2. Use the relevant how-to guide under `docs/integrations/how-to/`.
3. Check existing provider implementations before adding a new pattern.
4. Test the exact provider/model path you changed when possible.
5. Avoid breaking third-party providers while fixing first-party behavior.

## Things To Avoid

- Do not change the Node runtime or Bun development workflow without prior maintainer agreement.
- Do not add new Python code, Python provider paths, or Python dependencies without explicit maintainer approval.
- Do not introduce dependencies without clear project benefit.
- Do not skip tests for behavior changes.
- Do not silently change provider tags; maintainers control them during review.
- Do not ignore CodeRabbit or maintainer feedback; address it before requesting more review.
