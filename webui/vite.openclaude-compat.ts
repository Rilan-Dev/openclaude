import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const webuiRoot = __dirname
const repoRoot = path.resolve(webuiRoot, '..')
const rootSrc = path.resolve(repoRoot, 'src')
const webuiSrc = path.resolve(webuiRoot, 'src')

const OPTIONAL_PREFIX = '\0openclaude-optional:'
const TEXT_PREFIX = '\0openclaude-text:'
const MISSING_RELATIVE_PREFIX = '\0openclaude-missing-relative:'
const MISSING_MODULE_PREFIX = '\0openclaude-missing-module:'

const featureFlags: Record<string, boolean> = {
  VOICE_MODE: false,
  PROACTIVE: false,
  KAIROS: false,
  BRIDGE_MODE: false,
  DAEMON: false,
  AGENT_TRIGGERS: false,
  ABLATION_BASELINE: false,
  CONTEXT_COLLAPSE: true,
  COMMIT_ATTRIBUTION: false,
  HISTORY_SNIP: true,
  UDS_INBOX: false,
  BG_SESSIONS: true,
  WEB_BROWSER_TOOL: true,
  CHICAGO_MCP: false,
  COWORKER_TYPE_TELEMETRY: false,
  MCP_SKILLS: true,

  COORDINATOR_MODE: true,
  BUILTIN_EXPLORE_PLAN_AGENTS: true,
  BUDDY: true,
  MONITOR_TOOL: true,
  TEAMMEM: true,
  MESSAGE_ACTIONS: true,

  DUMP_SYSTEM_PROMPT: true,
  CACHED_MICROCOMPACT: true,
  AWAY_SUMMARY: true,
  TRANSCRIPT_CLASSIFIER: true,
  ULTRATHINK: true,
  TOKEN_BUDGET: true,
  HISTORY_PICKER: true,
  QUICK_SEARCH: true,
  SHOT_STATS: true,
  EXTRACT_MEMORIES: true,
  FORK_SUBAGENT: true,
  RESUME_COMPACT_PROMPT: true,
  VERIFICATION_AGENT: true,
  PROMPT_CACHE_BREAK_DETECTION: true,
  HOOK_PROMPTS: true,
}

const featureCallRe = /\bfeature\(\s*['"](\w+)['"][,\s]*\)/gs
const featureImportRe =
  /import\s*\{[^}]*\bfeature\b[^}]*\}\s*from\s*['"]bun:bundle['"];?\s*\n?/g

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function encodeJson(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value))
}

function decodeJson<T>(value: string): T {
  return JSON.parse(decodeURIComponent(value)) as T
}

function tryResolveFile(absPath: string): string | null {
  const candidates = [
    absPath,
    absPath.replace(/\.js$/, '.ts'),
    absPath.replace(/\.js$/, '.tsx'),
    absPath.replace(/\.jsx$/, '.tsx'),
    `${absPath}.ts`,
    `${absPath}.tsx`,
    `${absPath}.js`,
    `${absPath}.jsx`,
    path.join(absPath, 'index.ts'),
    path.join(absPath, 'index.tsx'),
    path.join(absPath, 'index.js'),
    path.join(absPath, 'index.jsx'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

function toRelativeImport(fromFile: string, targetFile: string): string {
  let rel = path.relative(path.dirname(fromFile), targetFile).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

function rewriteBrowserMappedImports(
  code: string,
  importerFile: string,
  browserAliases: Record<string, string>,
): string {
  let out = code

  for (const [specifier, targetFile] of Object.entries(browserAliases)) {
    const replacement = toRelativeImport(importerFile, targetFile)
    const escaped = escapeRegex(specifier)

    out = out.replace(
      new RegExp(`((?:from\\s*|import\\s*\\(\\s*)['"])${escaped}(['"])`, 'g'),
      (_m, before, after) => `${before}${replacement}${after}`,
    )

    out = out.replace(
      new RegExp(`(\\bimport\\s*['"])${escaped}(['"])`, 'g'),
      (_m, before, after) => `${before}${replacement}${after}`,
    )
  }

  return out
}

function rewriteMainForWebRender(code: string, normalizedId: string): string {
  if (
    !normalizedId.endsWith('/src/main.tsx') &&
    normalizedId !== 'src/main.tsx'
  ) {
    return code
  }

  let out = code.replace(
    /export async function main\(\) \{/,
    `export async function main() {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx main() started')
  }`,
  )

  out = out.replace(
    /initializeWarningHandler\(\);/,
    `initializeWarningHandler();
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx warning handler initialized')
  }`,
  )

  out = out.replace(
    /profileCheckpoint\('main_before_run'\);\s*await run\(\);/,
    `profileCheckpoint('main_before_run');
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx before run()')
  }
  await run();
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx after run()')
  }`,
  )

  out = out.replace(
    /async function run\(\): Promise<CommanderCommand> \{\s*profileCheckpoint\('run_function_start'\);/,
    `async function run(): Promise<CommanderCommand> {
  profileCheckpoint('run_function_start');
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx run() started')
  }`,
  )

  out = out.replace(
    /profileCheckpoint\('run_commander_initialized'\);/,
    `profileCheckpoint('run_commander_initialized');
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx commander initialized')
  }`,
  )

  out = out.replace(
    /program\.hook\('preAction', async thisCommand => \{\s*await Promise\.all\(\[ensureMdmSettingsLoaded\(\), ensureKeychainPrefetchCompleted\(\)\]\);\s*await init\(\);/,
    `program.hook('preAction', async thisCommand => {
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx preAction started')
    }
    await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()]);
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx preAction settings/keychain ready')
    }
    await init();
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx preAction init complete')
    }`,
  )

  out = out.replace(
    /action\(async \(prompt, options\) => \{\s*profileCheckpoint\('action_handler_start'\);/,
    `action(async (prompt, options) => {
    profileCheckpoint('action_handler_start');
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx default action started', { prompt, optionKeys: Object.keys(options ?? {}) })
    }`,
  )

  out = out.replace(
    /profileCheckpoint\('action_before_setup'\);\s*logForDebugging\('\[STARTUP\] Running setup\(\)\.\.\.'\);/,
    `profileCheckpoint('action_before_setup');
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx before setup()')
    }
    logForDebugging('[STARTUP] Running setup()...');`,
  )

  out = out.replace(
    /await setupPromise;\s*logForDebugging\(`\[STARTUP\] setup\(\) completed in \$\{Date\.now\(\) - setupStart\}ms`\);/,
    `await setupPromise;
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx after setup()')
    }
    logForDebugging(\`[STARTUP] setup() completed in \${Date.now() - setupStart}ms\`);`,
  )

  out = out.replace(
    /const \[commands, agentDefinitionsResult\] = await Promise\.all\(\[commandsPromise \?\? getCommands\(currentCwd\), agentDefsPromise \?\? getAgentDefinitionsWithOverrides\(currentCwd\)\]\);/,
    `if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx before commands/agents load')
    }
    const [commands, agentDefinitionsResult] = await Promise.all([commandsPromise ?? getCommands(currentCwd), agentDefsPromise ?? getAgentDefinitionsWithOverrides(currentCwd)]);
    if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
      console.log('[OpenClaude WebUI trace] src/main.tsx after commands/agents load', { commands: commands.length, activeAgents: agentDefinitionsResult.activeAgents.length })
    }`,
  )

  out = out.replace(
    /const ctx = getRenderContext\(false\);\s*getFpsMetrics = ctx\.getFpsMetrics;\s*stats = ctx\.stats;\s*const \{\s*createRoot\s*\} = await import\('\.\/ink\.js'\);\s*root = await createRoot\(ctx\.renderOptions\);/,
    `if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
        console.log('[OpenClaude WebUI trace] src/main.tsx before ink root setup')
      }
      const ctx = getRenderContext(false);
      getFpsMetrics = ctx.getFpsMetrics;
      stats = ctx.stats;
      if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
        root = {
          render: () => undefined,
          unmount: () => undefined,
          waitUntilExit: async () => undefined,
        }
        console.log('[OpenClaude WebUI trace] src/main.tsx using browser root adapter')
      } else {
        const {
          createRoot
        } = await import('./ink.js');
        root = await createRoot(ctx.renderOptions);
      }`,
  )

  out = out.replace(
    /const onboardingShown = await showSetupScreens\(root, permissionMode, allowDangerouslySkipPermissions, commands, enableClaudeInChrome, devChannels\);/,
    `if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
        console.log('[OpenClaude WebUI trace] src/main.tsx before showSetupScreens()')
      }
      const onboardingShown = await showSetupScreens(root, permissionMode, allowDangerouslySkipPermissions, commands, enableClaudeInChrome, devChannels);
      if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
        console.log('[OpenClaude WebUI trace] src/main.tsx after showSetupScreens()')
      }`,
  )

  out = out.replace(
    /profileCheckpoint\('run_before_parse'\);\s*await program\.parseAsync\(process\.argv\);\s*profileCheckpoint\('run_after_parse'\);/g,
    `profileCheckpoint('run_before_parse');
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx before program.parseAsync()', process.argv)
  }
  await program.parseAsync(process.argv);
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/main.tsx after program.parseAsync()')
  }
  profileCheckpoint('run_after_parse');`,
  )

  out = out.replace(
    /await\s+launchRepl\(\s*root\s*,\s*\{/g,
    "if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {\n          console.log('[OpenClaude WebUI trace] src/main.tsx calling launchRepl()')\n        }\n        await launchRepl(root, {\n        renderMode: 'web',",
  )

  return out
}

function rewriteCliEntrypointForWebTrace(code: string, normalizedId: string): string {
  if (
    !normalizedId.endsWith('/src/entrypoints/cli.tsx') &&
    normalizedId !== 'src/entrypoints/cli.tsx'
  ) {
    return code
  }

  return code.replace(
    /export async function main\(\s*args: string\[] = process\.argv\.slice\(2\),\s*options: CliEntrypointOptions = \{\},\s*\): Promise<void> \{/,
    `export async function main(
  args: string[] = process.argv.slice(2),
  options: CliEntrypointOptions = {},
): Promise<void> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/entrypoints/cli.tsx main() started')
  }`,
  ).replace(
    /  const \{ printStartupScreen \} = await importers\.startupScreen\(\)\s*printStartupScreen\(earlyModelFlag\)/,
    `  if (process.env.OPENCLAUDE_RENDER_MODE !== 'web') {
    const { printStartupScreen } = await importers.startupScreen()
    printStartupScreen(earlyModelFlag)
  }`,
  ).replace(
    /  \/\/ Hydrate GitHub credentials after profile is applied so CLAUDE_CODE_USE_GITHUB from profile is available\s*\{\s*const \{\s*hydrateGithubModelsTokenFromSecureStorage,\s*refreshGithubModelsTokenIfNeeded,\s*\} = await importers\.githubModelsCredentials\(\)\s*await refreshGithubModelsTokenIfNeeded\(\)\s*hydrateGithubModelsTokenFromSecureStorage\(\)\s*\}/,
    `  // Hydrate GitHub credentials after profile is applied so CLAUDE_CODE_USE_GITHUB from profile is available
  if (process.env.OPENCLAUDE_RENDER_MODE !== 'web' || process.env.CLAUDE_CODE_USE_GITHUB) {
    const {
      hydrateGithubModelsTokenFromSecureStorage,
      refreshGithubModelsTokenIfNeeded,
    } = await importers.githubModelsCredentials()
    await refreshGithubModelsTokenIfNeeded()
    hydrateGithubModelsTokenFromSecureStorage()
  }`,
  )
}

function rewriteInteractiveSetupForWeb(code: string, normalizedId: string): string {
  if (
    !normalizedId.endsWith('/src/interactiveHelpers.tsx') &&
    normalizedId !== 'src/interactiveHelpers.tsx'
  ) {
    return code
  }

  let out = code

  out = out.replace(
    /export async function showSetupScreens\(root: Root, permissionMode: PermissionMode, allowDangerouslySkipPermissions: boolean, commands\?: Command\[], claudeInChrome\?: boolean, devChannels\?: ChannelEntry\[]\): Promise<boolean> \{/,
    `export async function showSetupScreens(root: Root, permissionMode: PermissionMode, allowDangerouslySkipPermissions: boolean, commands?: Command[], claudeInChrome?: boolean, devChannels?: ChannelEntry[]): Promise<boolean> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/interactiveHelpers.tsx skipping blocking setup screens for browser render')
    setSessionTrustAccepted(true)
    resetGrowthBook()
    void initializeGrowthBook()
    void getSystemContext()
    applyConfigEnvironmentVariables()
    return false
  }`,
  )

  out = out.replace(
    /export async function renderAndRun\(root: Root, element: React\.ReactNode\): Promise<void> \{\s*root\.render\(element\);\s*startDeferredPrefetches\(\);\s*await root\.waitUntilExit\(\);\s*await gracefulShutdown\(0\);\s*\}/,
    `export async function renderAndRun(root: Root, element: React.ReactNode): Promise<void> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/interactiveHelpers.tsx rendering REPL into browser Ink adapter')
    const [
      { createRoot: createBrowserRoot },
      { default: InternalInkApp },
      { TerminalWriteProvider },
    ] = await Promise.all([
      import('react-dom/client'),
      import('./ink/components/App.js'),
      import('./ink/useTerminalNotification.js'),
    ])
    const mountId = (globalThis as typeof globalThis & { __OPENCLAUDE_WEB_ROOT_ID__?: string }).__OPENCLAUDE_WEB_ROOT_ID__ ?? 'root'
    const mount = globalThis.document?.getElementById(mountId)
    if (!mount) {
      throw new Error(\`OpenClaude WebUI root element #\${mountId} was not found\`)
    }
    const browserRoot = createBrowserRoot(mount)
    browserRoot.render(
      <InternalInkApp
        stdin={process.stdin}
        stdout={process.stdout}
        stderr={process.stderr}
        exitOnCtrlC={false}
        onExit={() => undefined}
        terminalColumns={Math.max(96, Math.floor((globalThis.innerWidth ?? 1200) / 8))}
        terminalRows={Math.max(32, Math.floor((globalThis.innerHeight ?? 800) / 18))}
        selection={{
          anchor: null,
          focus: null,
          isDragging: false,
          anchorSpan: null,
          scrolledOffAbove: [],
          scrolledOffBelow: [],
          scrolledOffAboveSW: [],
          scrolledOffBelowSW: [],
          lastPressHadAlt: false,
        }}
        onSelectionChange={() => undefined}
        onClickAt={() => false}
        onHoverAt={() => undefined}
        getHyperlinkAt={() => undefined}
        onOpenHyperlink={() => undefined}
        onMultiClick={() => undefined}
        onSelectionDrag={() => undefined}
        onStdinResume={() => undefined}
        onCursorDeclaration={() => undefined}
        dispatchKeyboardEvent={() => undefined}
      >
        <TerminalWriteProvider value={() => undefined}>
          {element}
        </TerminalWriteProvider>
      </InternalInkApp>,
    )
    startDeferredPrefetches()
    return
  }

  root.render(element);
  startDeferredPrefetches();
  await root.waitUntilExit();
  await gracefulShutdown(0);
}`,
  )

  return out
}

function rewriteReplLauncherForWeb(code: string, normalizedId: string): string {
  if (
    !normalizedId.endsWith('/src/replLauncher.tsx') &&
    normalizedId !== 'src/replLauncher.tsx'
  ) {
    return code
  }

  return code
    .replace(
      /export async function launchRepl\(root: Root, appProps: AppWrapperProps, replProps: REPLProps, renderAndRun: \(root: Root, element: React\.ReactNode\) => Promise<void>\): Promise<void> \{/,
      `export async function launchRepl(root: Root, appProps: AppWrapperProps, replProps: REPLProps, renderAndRun: (root: Root, element: React.ReactNode) => Promise<void>): Promise<void> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    console.log('[OpenClaude WebUI trace] src/replLauncher.tsx launchRepl() started')
  }`,
    )
    .replace(
      /    const \[\s*\{ App \},\s*\{ REPL \},\s*\/\/ \{ ChatWindow \},\s*\{ AppStateProvider \},\s*\{ startDeferredPrefetches \},\s*\] = await Promise\.all\(\[\s*import\('\.\/components\/App\.js'\),\s*import\('\.\/screens\/REPL\.js'\),\s*\/\/ import\('\.\/screens\/ChatWindow\.js'\),\s*import\('\.\/state\/AppState\.js'\),\s*import\('\.\/main\.js'\),\s*\]\)/,
      `    const [
      { App },
      { REPL },
      // { ChatWindow },
      { default: InternalInkApp },
      { TerminalWriteProvider },
      { startDeferredPrefetches },
    ] = await Promise.all([
      import('./components/App.js'),
      import('./screens/REPL.js'),
      // import('./screens/ChatWindow.js'),
      import('./ink/components/App.js'),
      import('./ink/useTerminalNotification.js'),
      import('./main.js'),
    ])`,
    )
    .replace(
      /    browserRoot\.render\(\s*<React\.StrictMode>\s*<AppStateProvider\s*initialState=\{appProps\.initialState\}\s*onChangeAppState=\{onChangeAppState\}\s*>\s*\{appElement\}\s*<\/AppStateProvider>\s*<\/React\.StrictMode>,\s*\)/,
      `    browserRoot.render(
      <React.StrictMode>
        <InternalInkApp
          stdin={process.stdin}
          stdout={process.stdout}
          stderr={process.stderr}
          exitOnCtrlC={false}
          onExit={() => undefined}
          terminalColumns={Math.max(96, Math.floor((globalThis.innerWidth ?? 1200) / 8))}
          terminalRows={Math.max(640, Math.floor(globalThis.innerHeight ?? 800))}
          selection={{
            anchor: null,
            focus: null,
            isDragging: false,
            anchorSpan: null,
            scrolledOffAbove: [],
            scrolledOffBelow: [],
            scrolledOffAboveSW: [],
            scrolledOffBelowSW: [],
            lastPressHadAlt: false,
          }}
          onSelectionChange={() => undefined}
          onClickAt={() => false}
          onHoverAt={() => undefined}
          getHyperlinkAt={() => undefined}
          onOpenHyperlink={() => undefined}
          onMultiClick={() => undefined}
          onSelectionDrag={() => undefined}
          onStdinResume={() => undefined}
          onCursorDeclaration={() => undefined}
          dispatchKeyboardEvent={() => undefined}
        >
          <TerminalWriteProvider value={() => undefined}>
            {appElement}
          </TerminalWriteProvider>
        </InternalInkApp>
      </React.StrictMode>,
    )`,
    )
}

function suppressUnsupportedBrowserDynamicImportWarnings(
  code: string,
  normalizedId: string,
): string {
  if (
    !normalizedId.endsWith('/src/utils/bash/registry.ts') &&
    normalizedId !== 'src/utils/bash/registry.ts'
  ) {
    return code
  }

  return code.replace(
    "import(`@withfig/autocomplete/build/${command}.js`)",
    "import(/* @vite-ignore */ `@withfig/autocomplete/build/${command}.js`)",
  )
}

function rewriteBrowserOnlyNetworkStartup(code: string, normalizedId: string): string {
  if (
    normalizedId.endsWith('/src/utils/releaseNotes.ts') ||
    normalizedId === 'src/utils/releaseNotes.ts'
  ) {
    return code.replace(
      /async function fetchGitHubReleases\(\): Promise<GitHubRelease\[]> \{/,
      `async function fetchGitHubReleases(): Promise<GitHubRelease[]> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    return []
  }`,
    )
  }

  if (
    normalizedId.endsWith('/src/utils/plugins/officialMarketplaceGcs.ts') ||
    normalizedId === 'src/utils/plugins/officialMarketplaceGcs.ts'
  ) {
    return code.replace(
      /export async function fetchOfficialMarketplaceFromGcs\(\s*installLocation: string,\s*marketplacesCacheDir: string,\s*\): Promise<string \| null> \{/,
      `export async function fetchOfficialMarketplaceFromGcs(
  installLocation: string,
  marketplacesCacheDir: string,
): Promise<string | null> {
  if (process.env.OPENCLAUDE_RENDER_MODE === 'web') {
    return null
  }`,
    )
  }

  return code
}

function rewriteAgentPermissionDefaultsForWeb(
  code: string,
  normalizedId: string,
): string {
  if (
    normalizedId.endsWith('/src/tools/AgentTool/AgentTool.tsx') ||
    normalizedId.endsWith('/src/tools/AgentTool/resumeAgent.ts') ||
    normalizedId === 'src/tools/AgentTool/AgentTool.tsx' ||
    normalizedId === 'src/tools/AgentTool/resumeAgent.ts'
  ) {
    return code.replace(
      /mode:\s*selectedAgent\.permissionMode\s*\?\?\s*'acceptEdits'/g,
      "mode: selectedAgent.permissionMode ?? (process.env.OPENCLAUDE_RENDER_MODE === 'web' ? 'bubble' : 'acceptEdits')",
    )
  }

  if (
    normalizedId.endsWith('/src/tools/AgentTool/runAgent.ts') ||
    normalizedId === 'src/tools/AgentTool/runAgent.ts'
  ) {
    return code.replace(
      /const agentPermissionMode = agentDefinition\.permissionMode/,
      "const agentPermissionMode = agentDefinition.permissionMode ?? (process.env.OPENCLAUDE_RENDER_MODE === 'web' && isAsync ? 'bubble' : undefined)",
    )
  }

  return code
}

function readOptionalDeclaredModules(): Set<string> {
  const modules = new Set<string>()
  const file = path.resolve(repoRoot, 'src/optionalModules.d.ts')

  if (!fs.existsSync(file)) return modules

  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/declare\s+module\s+['"]([^'"]+)['"]/g)) {
    modules.add(match[1])
  }

  return modules
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ent.name === 'node_modules' ||
      ent.name === 'dist' ||
      ent.name === '.vite'
    ) {
      continue
    }

    const full = path.join(dir, ent.name)

    if (ent.isDirectory()) {
      walkFiles(full, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      out.push(full)
    }
  }

  return out
}

function stripCommentsForImportScan(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

function moduleKey(specifier: string): string {
  return `module:${specifier}`
}

// Subpath imports of an optional module (e.g. '@ant/computer-use-mcp/sentinelApps')
// are resolved to the same root stub ('@ant/computer-use-mcp'). The stub must
// therefore export every named import seen across the root AND all of its
// subpaths, otherwise an `import { x } from 'root/sub'` fails with
// "does not provide an export named 'x'" and crashes the module graph.
function collectModuleNames(
  namedImports: Map<string, Set<string>>,
  rootModuleName: string,
): Set<string> {
  const names = new Set<string>()
  const rootKey = moduleKey(rootModuleName)
  const subpathPrefix = `${rootKey}/`

  for (const [key, set] of namedImports) {
    if (key === rootKey || key.startsWith(subpathPrefix)) {
      for (const name of set) names.add(name)
    }
  }

  return names
}

function findOptionalModuleRoot(
  source: string,
  optionalModules: Set<string>,
): string | null {
  for (const moduleName of optionalModules) {
    if (source === moduleName || source.startsWith(`${moduleName}/`)) {
      return moduleName
    }
  }
  return null
}

function relativeKey(importer: string, specifier: string): string {
  return `relative:${normalizePath(importer)}::${specifier}`
}

function registerNames(
  map: Map<string, Set<string>>,
  key: string,
  namedPart: string,
): void {
  if (!namedPart.trim()) return

  const rawNames = namedPart
    .split(',')
    .map(s => s.trim().replace(/^type\s+/, ''))
    .filter(Boolean)

  if (rawNames.length === 0) return
  if (!map.has(key)) map.set(key, new Set())

  const names = map.get(key)!

  for (const raw of rawNames) {
    const originalName = raw.split(/\s+as\s+/)[0]?.trim()
    if (originalName && /^[A-Za-z_$][\w$]*$/.test(originalName)) {
      names.add(originalName)
    }
  }
}

function scanNamedImports(optionalModules: Set<string>): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  const files = [...walkFiles(rootSrc), ...walkFiles(webuiSrc)]

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    const code = stripCommentsForImportScan(raw)

    for (const m of code.matchAll(
      /import\s+(?:type\s+)?(?:\{([^}]*)\}|([\w$]+))?\s*(?:,\s*\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]/g,
    )) {
      const specifier = m[4]
      const namedPart = m[1] || m[3] || ''

      if (
        optionalModules.has(specifier) ||
        findOptionalModuleRoot(specifier, optionalModules)
      ) {
        registerNames(result, moduleKey(specifier), namedPart)
      }

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        registerNames(result, relativeKey(file, specifier), namedPart)
      }

      if (specifier.startsWith('@/tasks/')) {
        registerNames(result, moduleKey(specifier), namedPart)
      }
    }

    for (const m of code.matchAll(
      /export\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g,
    )) {
      const namedPart = m[1]
      const specifier = m[2]

      if (
        optionalModules.has(specifier) ||
        findOptionalModuleRoot(specifier, optionalModules)
      ) {
        registerNames(result, moduleKey(specifier), namedPart)
      }

      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        registerNames(result, relativeKey(file, specifier), namedPart)
      }

      if (specifier.startsWith('@/tasks/')) {
        registerNames(result, moduleKey(specifier), namedPart)
      }
    }
  }

  return result
}

function makeGenericStub(moduleName: string, names: Set<string>): string {
  if (moduleName === 'bun:bundle') {
    return `
export function feature(_name) {
  return false
}
`
  }

  if (moduleName === 'plist') {
    return `
export function parse(_input) {
  return {}
}

export default {
  parse,
}
`
  }

  if (moduleName === 'cacache') {
    return `
export const ls = {
  stream(_path) {
    return {
      async *[Symbol.asyncIterator]() {}
    }
  }
}

export const rm = {
  async entry(_path, _key) {}
}

export default {
  ls,
  rm,
}
`
  }

  if (
    moduleName === 'react/compiler-runtime' ||
    moduleName === 'react-compiler-runtime'
  ) {
    return `
export function c(size) {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}

export default {
  c,
}
`
  }

  const overrides: Record<string, string> = {
    BROWSER_TOOLS: '[]',
    ColorDiff: 'null',
    ColorFile: 'null',
    SandboxViolationStore: 'null',
    SandboxManager:
      'class { static isSupportedPlatform() { return false } static create() { return null } }',
    BaseSandboxManager:
      'class { static isSupportedPlatform() { return false } static annotateStderrWithSandboxFailures(_command, stderr) { return stderr } }',
    SandboxRuntimeConfigSchema:
      '{ parse: value => value ?? {}, safeParse: value => ({ success: true, data: value ?? {} }) }',
    McpbManifestSchema:
      '{ parse: value => value ?? {}, safeParse: value => ({ success: true, data: value ?? {} }) }',
    ExportResultCode: '{ SUCCESS: 0, FAILED: 1 }',
    BROWSER_TOOLS_BY_NAME: '{}',
    getMcpConfigForManifest: 'async () => ({})',
    createClaudeForChromeMcpServer: 'async () => null',
    getSyntaxTheme: '() => null',
    plot: '() => ""',
    linkifyUrlsInText: 'value => value',
  }

  const namedExports = [...names]
    .filter(name => name !== 'default')
    .filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
    .map(name => `export const ${name} = ${overrides[name] ?? 'stub'}`)
    .join('\n')

  return `
const noop = (..._args) => null

const handler = {
  get(target, prop) {
    if (prop === '__esModule') return true
    if (prop === 'then') return undefined
    if (prop === Symbol.toStringTag) return 'Module'
    if (prop in target) return target[prop]
    return stub
  },
  apply() {
    return null
  },
  construct() {
    return {}
  },
}

const stub = new Proxy(noop, handler)

export default stub
export const __stub = true
${namedExports}
`
}

export function browserAliasesFromRootPackage(): Record<string, string> {
  const pkgPath = path.resolve(repoRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const browser = pkg.browser ?? {}
  const aliases: Record<string, string> = {}
  const nodeBuiltinsShim = path.resolve(webuiRoot, 'shims/nodeBuiltins.js')
  const reactBrowserKeys = new Set([
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
  ])

  for (const [key, value] of Object.entries(browser)) {
    if (reactBrowserKeys.has(key)) continue
    if (typeof value === 'string') {
      aliases[key] = path.resolve(repoRoot, value)
    }
  }

  aliases['path/posix'] = nodeBuiltinsShim
  aliases['node:path/posix'] = nodeBuiltinsShim

  return aliases
}

function makeOptionalModules(): Set<string> {
  const modules = readOptionalDeclaredModules()

  for (const mod of [
    'bun:bundle',

    'plist',
    'cacache',
    'fuse',
    'asciichart',

    'audio-capture-napi',
    'audio-capture.node',
    'image-processor-napi',
    'modifiers-napi',
    'url-handler-napi',
    'color-diff-napi',

    '@anthropic-ai/mcpb',
    '@ant/claude-for-chrome-mcp',
    '@anthropic-ai/sandbox-runtime',

    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-provider-ini',
    '@aws-sdk/credential-provider-login',
    '@aws-sdk/credential-provider-node',
    '@aws-sdk/credential-providers',
    '@smithy/node-http-handler',

    '@ant/computer-use-mcp',
    '@ant/computer-use-mcp/sentinelApps',
    '@ant/computer-use-mcp/types',
    '@ant/computer-use-swift',
    '@ant/computer-use-input',
  ]) {
    modules.add(mod)
  }

  return modules
}

export function openClaudeCompatPlugin(): Plugin {
  const optionalModules = makeOptionalModules()
  const browserAliases = browserAliasesFromRootPackage()
  const namedImports = scanNamedImports(optionalModules)

  return {
    name: 'openclaude-vite-compat',
    enforce: 'pre',

    resolveId(source, importer) {
      if (Object.prototype.hasOwnProperty.call(browserAliases, source)) {
        return browserAliases[source]
      }

      if (source.startsWith('node:')) {
        const withoutNodePrefix = source.slice('node:'.length)
        if (
          Object.prototype.hasOwnProperty.call(
            browserAliases,
            withoutNodePrefix,
          )
        ) {
          return browserAliases[withoutNodePrefix]
        }
      }

      if (source === 'bun:bundle') {
        return `${OPTIONAL_PREFIX}${source}`
      }

      const optionalModuleRoot = findOptionalModuleRoot(
        source,
        optionalModules,
      )
      if (optionalModuleRoot) {
        return `${OPTIONAL_PREFIX}${optionalModuleRoot}`
      }

      if (/\.(md|txt)$/.test(source)) {
        return `${TEXT_PREFIX}${source}`
      }

      if (source.startsWith('@/')) {
        const resolved = tryResolveFile(path.resolve(rootSrc, source.slice(2)))
        if (resolved) return resolved

        if (source.startsWith('@/tasks/')) {
          return `${MISSING_MODULE_PREFIX}${source}`
        }
      }

      if (source.startsWith('src/')) {
        const resolved = tryResolveFile(path.resolve(repoRoot, source))
        if (resolved) return resolved
      }

      if (
        importer &&
        !importer.startsWith('\0') &&
        (source.startsWith('./') || source.startsWith('../'))
      ) {
        const cleanImporter = importer.split('?')[0]
        const normalizedImporter = normalizePath(cleanImporter)

        if (
          source === '../services/api/credentialPool.js' &&
          normalizedImporter.endsWith('/src/integrations/routeMetadata.ts')
        ) {
          return path.resolve(rootSrc, 'services/api/credentialPool.ts')
        }

        const resolved = tryResolveFile(
          path.resolve(path.dirname(cleanImporter), source),
        )

        if (resolved) return resolved

        if (source.endsWith('.js')) {
          return `${MISSING_RELATIVE_PREFIX}${encodeJson({
            importer: normalizePath(cleanImporter),
            source,
          })}`
        }
      }

      return null
    },

    load(id) {
      if (id.startsWith(TEXT_PREFIX)) {
        return `export default ''`
      }

      if (id.startsWith(OPTIONAL_PREFIX)) {
        const moduleName = id.slice(OPTIONAL_PREFIX.length)
        return makeGenericStub(
          moduleName,
          collectModuleNames(namedImports, moduleName),
        )
      }

      if (id.startsWith(MISSING_MODULE_PREFIX)) {
        const moduleName = id.slice(MISSING_MODULE_PREFIX.length)
        return makeGenericStub(
          moduleName,
          collectModuleNames(namedImports, moduleName),
        )
      }

      if (id.startsWith(MISSING_RELATIVE_PREFIX)) {
        const data = decodeJson<{ importer: string; source: string }>(
          id.slice(MISSING_RELATIVE_PREFIX.length),
        )

        return makeGenericStub(
          data.source,
          namedImports.get(relativeKey(data.importer, data.source)) ??
            new Set(),
        )
      }

      return null
    },

    transform(code, id) {
      const cleanId = id.split('?')[0]
      const normalizedId = normalizePath(cleanId)

      const isSource =
        normalizedId.startsWith(normalizePath(rootSrc)) ||
        normalizedId.startsWith(normalizePath(webuiSrc))

      if (!isSource) return null

      let transformed = code

      transformed = rewriteBrowserMappedImports(
        transformed,
        cleanId,
        browserAliases,
      )

      transformed = rewriteCliEntrypointForWebTrace(transformed, normalizedId)
      transformed = rewriteMainForWebRender(transformed, normalizedId)
      transformed = rewriteInteractiveSetupForWeb(transformed, normalizedId)
      transformed = rewriteReplLauncherForWeb(transformed, normalizedId)
      transformed = suppressUnsupportedBrowserDynamicImportWarnings(
        transformed,
        normalizedId,
      )
      transformed = rewriteBrowserOnlyNetworkStartup(transformed, normalizedId)
      transformed = rewriteAgentPermissionDefaultsForWeb(
        transformed,
        normalizedId,
      )

      if (transformed.includes('feature(') || transformed.includes('bun:bundle')) {
        transformed = transformed
          .replace(featureImportRe, '')
          .replace(featureCallRe, (_match, name) =>
            String(featureFlags[name] ?? false),
          )
      }

      if (transformed === code) return null

      return {
        code: transformed,
        map: null,
      }
    },
  }
}
