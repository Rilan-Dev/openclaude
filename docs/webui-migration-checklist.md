# WebUI Migration Checklist

This project currently uses compiled React/Ink source for the terminal UI. Many
files intentionally start with:

```ts
import { c as _c } from "react-compiler-runtime"
```

Do not remove these imports while migrating WebUI behavior. Treat them as part
of the existing TUI source shape unless the whole file is intentionally replaced
by a generated equivalent.

## Boundaries

- Keep Ink/TUI primitives in `src/ink/` terminal-first.
- Do not import `webui/` files from `src/`.
- Use `src/utils/runtime.ts` for neutral runtime checks such as browser render mode.
- Put browser shims, Vite transforms, proxying, and Node/Bun compatibility in `webui/`.
- Put reusable browser visual components in `src/components/ui/` or a clearly WebUI-only component file.
- Keep CLI behavior working from `src/entrypoints/cli.tsx` and `src/main.tsx`.

## Migration Checklist

- Audit staged changes before editing: `git status --short` and `git diff --cached --name-status`.
- Search for accidental compiled-runtime removal: `git diff --cached -G "react-compiler-runtime" -- src`.
- Search for bad source-to-WebUI imports: `rg "webui/shims|../webui|../../webui" src`.
- Preserve TUI renderers first, then add WebUI branches behind `isBrowserRuntime()`.
- Prefer WebUI compatibility transforms in `webui/vite.openclaude-compat.ts` for browser-only runtime shims.
- Verify `bun run typecheck` and record unrelated baseline failures separately.
- Verify `bun run web:typecheck` after aligning WebUI TypeScript config/version.

## Current Notes

- Latest browser-visible fixes:
  - `src/components/Markdown.tsx` renders semantic browser Markdown tables,
    lists, headings, code blocks, and links while preserving the Ink renderer.
  - `src/components/messages/AssistantTextMessage.tsx` removes the terminal
    leading assistant dot in browser mode.
  - `src/components/messages/AssistantToolUseMessage.tsx` renders browser tool
    calls as structured status cards.
  - `src/components/permissions/SharedShellPermissionRequest.tsx` renders Bash
    and shell approvals as WebUI permission cards.
  - `src/components/LogSelector.tsx` renders `/resume` as a browser session
    picker instead of a terminal `TreeSelect`.
  - `webui/repl.css` owns the current browser transcript, markdown, tool,
    permission, and resume picker visual system.
- `src/components/MessageRow.tsx`, `src/components/ModelPicker.tsx`,
  `src/components/PromptInput/PromptInputModeIndicator.tsx`,
  `src/ink/components/Box.tsx`, `src/ink/components/Text.tsx`,
  `src/components/design-system/ThemedBox.tsx`, and
  `src/components/design-system/ThemedText.tsx` must retain their
  `react-compiler-runtime` imports.
- `src/components/FullscreenLayout.tsx` now has a browser branch for the
  conversation shell, sticky prompt, new-message pill, prompt suggestions, and
  prompt dialog overlay. Keep the existing Ink branch for fullscreen terminal
  rendering.
- `src/components/design-system/ThemedBox.tsx`,
  `src/components/design-system/ThemedText.tsx`,
  `src/ink/components/Box.tsx`, and `src/ink/components/Text.tsx` now emit DOM
  primitives in browser runtime. This is the main bridge for converting broad
  `src/components/*` TUI surfaces without manually replacing every `<Box>` and
  `<Text>` call site.
- `src/components/messages/WebMessage.tsx` is the browser message adapter for
  all compiled `src/components/messages/**/*.tsx` components. `MessageRow`
  wraps every rendered message in this boundary, so the existing `_c` compiled
  leaf components keep their terminal behavior while receiving modern WebUI
  bubble layout in browser runtime.
- Browser-specific layout and provider chooser work is still staged in
  component-level migration seams and should be extracted further as the WebUI
  stabilizes.

## Next Surface Buckets

- Highest remaining Ink-only browser risks found by the latest audit:
  - `src/components/LogoV2/WelcomeV2.tsx`
  - `src/commands/plugin/ManagePlugins.tsx`
  - `src/components/ContextVisualization.tsx`
  - `src/components/Stats.tsx`
  - `src/components/mcp/ElicitationDialog.tsx`
  - `src/components/mcp/MCPRemoteServerMenu.tsx`
  - `src/commands/plugin/ManageMarketplaces.tsx`
  - `src/screens/Doctor.tsx`
  - `src/commands/plugin/BrowseMarketplace.tsx`
  - `src/commands/plugin/DiscoverPlugins.tsx`
- Prompt composer: `src/components/PromptInput/PromptInput.tsx`,
  `PromptInputFooter*.tsx`, `BaseTextInput.tsx`, `TextInput.tsx`,
  `ShimmeredInput.tsx`.
- Messages: continue polishing individual specialized bodies such as tool
  result diffs and attachment previews, but the row-level WebUI boundary now
  covers every compiled `src/components/messages/**/*.tsx` renderer.
- Permissions and dialogs: `src/components/permissions/**/*.tsx`,
  `AutoModeOptInDialog.tsx`, `TrustDialog`, and MCP approval flows.
- Provider and model pickers: `ProviderManager.tsx`, `ModelPicker.tsx`,
  `OutputStylePicker.tsx`, and provider preset commands.
- Agents/tools: `src/tools/*/UI.tsx`, `src/components/tasks/*.tsx`,
  agent creation wizard surfaces.
