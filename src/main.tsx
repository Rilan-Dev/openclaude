// These side-effects must run before all other imports:
// 2. startMdmRawRead fires MDM subprocesses (plutil/reg query) so they run in
//    parallel with the remaining ~135ms of imports below
// 3. startKeychainPrefetch fires both macOS keychain reads (OAuth + legacy API
//    key) in parallel — isRemoteManagedSettingsEligible() otherwise reads them
//    sequentially via sync spawn inside applySafeConfigEnvironmentVariables()
//    (~65ms on every macOS startup)

// eslint-disable-next-line custom-rules/no-top-level-side-effect
import { startMdmRawRead } from './utils/settings/mdm/rawRead.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
startMdmRawRead();
import { ensureKeychainPrefetchCompleted, startKeychainPrefetch } from './utils/secureStorage/keychainPrefetch.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
startKeychainPrefetch();
import { feature } from 'bun:bundle';
import { Command as CommanderCommand, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import mapValues from 'lodash-es/mapValues.js';
import pickBy from 'lodash-es/pickBy.js';
import uniqBy from 'lodash-es/uniqBy.js';
import React from 'react';
import { getOauthConfig } from './constants/oauth.js';
import { getRemoteSessionUrl } from './constants/product.js';
import { getSystemContext, getUserContext } from './context.js';
import { init, initializeTelemetryAfterTrust } from './entrypoints/init.js';
import { addToHistory } from './history.js';
import type { Root } from './ink.js';
import { launchRepl } from './replLauncher.js';
import { refreshGrowthBookAfterAuthChange } from './services/analytics/growthbook.js';
import { fetchBootstrapData } from './services/api/bootstrap.js';
import { refreshStartupDiscoveryForActiveRoute } from './integrations/discoveryService.js';
import { prefetchOllamaModels } from './utils/model/ollamaModels.js';
import { type DownloadResult, downloadSessionFiles, type FilesApiConfig, parseFileSpecs } from './services/api/filesApi.js';
import { prefetchPassesEligibility } from './services/api/referral.js';
import { prefetchOfficialMcpUrls } from './services/mcp/officialRegistry.js';
import type { McpSdkServerConfig, McpServerConfig, ScopedMcpServerConfig } from './services/mcp/types.js';
import { isPolicyAllowed, loadPolicyLimits, refreshPolicyLimits, waitForPolicyLimitsToLoad } from './services/policyLimits/index.js';
import { loadRemoteManagedSettings, refreshRemoteManagedSettings } from './services/remoteManagedSettings/index.js';
import type { ToolInputJSONSchema } from './Tool.js';
import { createSyntheticOutputTool, isSyntheticOutputToolEnabled } from './tools/SyntheticOutputTool/SyntheticOutputTool.js';
import { getTools } from './tools.js';
import { canUserConfigureAdvisor, getInitialAdvisorSetting, isAdvisorEnabled, isValidAdvisorModel, modelSupportsAdvisor } from './utils/advisor.js';
import { isAgentSwarmsEnabled } from './utils/agentSwarmsEnabled.js';
import { count, uniq } from './utils/array.js';
import { getSubscriptionType, isClaudeAISubscriber, prefetchAwsCredentialsAndBedRockInfoIfSafe, prefetchGcpCredentialsIfSafe, validateForceLoginOrg } from './utils/auth.js';
import { checkHasTrustDialogAccepted, getGlobalConfig, getRemoteControlAtStartup, isAutoUpdaterDisabled, saveGlobalConfig } from './utils/config.js';
import { seedEarlyInput, stopCapturingEarlyInput } from './utils/earlyInput.js';
import { getInitialEffortSetting, parseEffortValue } from './utils/effort.js';
import { getInitialFastModeSetting, isFastModeEnabled, prefetchFastModeStatus, resolveFastModeStatusFromCache } from './utils/fastMode.js';
import { applyConfigEnvironmentVariables } from './utils/managedEnv.js';
import { createSystemMessage, createUserMessage } from './utils/messages.js';
import { getPlatform } from './utils/platform.js';
import { getBaseRenderOptions } from './utils/renderOptions.js';
import { getSessionIngressAuthToken } from './utils/sessionIngressAuth.js';
import { settingsChangeDetector } from './utils/settings/changeDetector.js';
import { skillChangeDetector } from './utils/skills/skillChangeDetector.js';
import { jsonParse } from './utils/slowOperations.js';
import { computeInitialTeamContext } from './utils/swarm/reconnection.js';
import { initializeWarningHandler } from './utils/warningHandler.js';
import { isWorktreeModeEnabled } from './utils/worktreeModeEnabled.js';

// Lazy require to avoid circular dependency: teammate.ts -> AppState.tsx -> ... -> main.tsx
/* eslint-disable @typescript-eslint/no-require-imports */
const getTeammateUtils = () => require('./utils/teammate.js') as typeof import('./utils/teammate.js');
const getTeammatePromptAddendum = () => require('./utils/swarm/teammatePromptAddendum.js') as typeof import('./utils/swarm/teammatePromptAddendum.js');
const getTeammateModeSnapshot = () => require('./utils/swarm/backends/teammateModeSnapshot.js') as typeof import('./utils/swarm/backends/teammateModeSnapshot.js');
/* eslint-enable @typescript-eslint/no-require-imports */
// Dead code elimination: conditional import for COORDINATOR_MODE
/* eslint-disable @typescript-eslint/no-require-imports */
const coordinatorModeModule = feature('COORDINATOR_MODE') ? require('./coordinator/coordinatorMode.js') as typeof import('./coordinator/coordinatorMode.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
// Dead code elimination: conditional import for KAIROS (assistant mode)
/* eslint-disable @typescript-eslint/no-require-imports */
const assistantModule = feature('KAIROS') ? require('./assistant/index.js') as typeof import('./assistant/index.js') : null;
const kairosGate = feature('KAIROS') ? require('./assistant/gate.js') as typeof import('./assistant/gate.js') : null;
import { relative, resolve } from 'path';
import { isAnalyticsDisabled } from 'src/services/analytics/config.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { initializeAnalyticsGates } from 'src/services/analytics/sink.js';
import { getOriginalCwd, setAdditionalDirectoriesForClaudeMd, setIsRemoteMode, setMainLoopModelOverride, setMainThreadAgentType, setTeleportedSessionInfo } from './bootstrap/state.js';
import { filterCommandsForRemoteMode, getCommands } from './commands.js';
import type { StatsStore } from './context/stats.js';
import { launchAssistantInstallWizard, launchAssistantSessionChooser, launchInvalidSettingsDialog, launchResumeChooser, launchSnapshotUpdateDialog, launchTeleportRepoMismatchDialog, launchTeleportResumeWrapper } from './dialogLaunchers.js';
import { SHOW_CURSOR } from './ink/termio/dec.js';
import { exitWithError, exitWithMessage, getRenderContext, renderAndRun, showSetupScreens } from './interactiveHelpers.js';
import { initBuiltinPlugins } from './plugins/bundled/index.js';
/* eslint-enable @typescript-eslint/no-require-imports */
import { checkQuotaStatus } from './services/claudeAiLimits.js';
import { getMcpToolsCommandsAndResources, prefetchAllMcpResources } from './services/mcp/client.js';
import { VALID_INSTALLABLE_SCOPES, VALID_UPDATE_SCOPES } from './services/plugins/pluginCliCommands.js';
import { initBundledSkills } from './skills/bundled/index.js';
import type { AgentColorName } from './tools/AgentTool/agentColorManager.js';
import { getActiveAgentsFromList, getAgentDefinitionsWithOverrides, isBuiltInAgent, isCustomAgent, parseAgentsFromJson } from './tools/AgentTool/loadAgentsDir.js';
import type { LogOption } from './types/logs.js';
import type { Message as MessageType } from './types/message.js';
import { assertMinVersion } from './utils/autoUpdater.js';
import { setupClaudeInChrome, shouldAutoEnableClaudeInChrome, shouldEnableClaudeInChrome } from './utils/claudeInChrome/setup.js';
import { mergeClaudeInChromeStartupConfig, resolveClaudeInChromeStartupMode } from './utils/claudeInChrome/startup.js';
import { getContextWindowForModel } from './utils/context.js';
import { loadConversationForResume } from './utils/conversationRecovery.js';
import { buildDeepLinkBanner } from './utils/deepLink/banner.js';
import { createCombinedAbortSignal } from './utils/combinedAbortSignal.js';
import { hasNodeOption, isBareMode, isEnvTruthy, isInProtectedNamespace } from './utils/envUtils.js';
import { refreshExampleCommands } from './utils/exampleCommands.js';
import type { FpsMetrics } from './utils/fpsTracker.js';
import { getWorktreePaths } from './utils/getWorktreePaths.js';
import { findGitRoot, getBranch, getIsGit, getWorktreeCount } from './utils/git.js';
import { getGhAuthStatus } from './utils/github/ghAuthStatus.js';
import { safeParseJSON } from './utils/json.js';
import { logError } from './utils/log.js';
import { getModelDeprecationWarning } from './utils/model/deprecation.js';
import { getDefaultMainLoopModel, getUserSpecifiedModelSetting, normalizeModelStringForAPI, parseUserSpecifiedModel } from './utils/model/model.js';
import { ensureModelStringsInitialized } from './utils/model/modelStrings.js';
import { PERMISSION_MODES } from './utils/permissions/PermissionMode.js';
import { checkAndDisableBypassPermissions, getAutoModeEnabledStateIfCached, initializeToolPermissionContext, initialPermissionModeFromCLI, isDefaultPermissionModeAuto, parseToolListFromCLI, stripDangerousPermissionsForAutoMode, verifyAutoModeGateAccess } from './utils/permissions/permissionSetup.js';
import { cleanupOrphanedPluginVersionsInBackground } from './utils/plugins/cacheUtils.js';
import { initializeVersionedPlugins } from './utils/plugins/installedPluginsManager.js';
import { getManagedPluginNames } from './utils/plugins/managedPlugins.js';
import { getGlobExclusionsForPluginCache } from './utils/plugins/orphanedPluginFilter.js';
import { getPluginSeedDirs } from './utils/plugins/pluginDirectories.js';
import { countFilesRoundedRg } from './utils/ripgrep.js';
import { processSessionStartHooks, processSetupHooks } from './utils/sessionStart.js';
import { cacheSessionTitle, getSessionIdFromLog, loadTranscriptFromFile, saveAgentSetting, saveMode, searchSessionsByCustomTitle, sessionIdExists } from './utils/sessionStorage.js';
import { ensureMdmSettingsLoaded } from './utils/settings/mdm/settings.js';
import { eagerLoadSettingsFromArgs } from './utils/settings/flagSettings.js';
import { getInitialSettings, getManagedSettingsKeysForLogging, getSettingsForSource, getSettingsWithErrors } from './utils/settings/settings.js';
import type { ValidationError } from './utils/settings/validation.js';
import { logPluginLoadErrors, logPluginsEnabledForSession } from './utils/telemetry/pluginTelemetry.js';
import { logSkillsLoaded } from './utils/telemetry/skillLoadedEvent.js';
import { validateUuid } from './utils/uuid.js';
// Plugin startup checks are now handled non-blockingly in REPL.tsx

import { registerMcpAddCommand } from 'src/commands/mcp/addCommand.js';
import { registerMcpDoctorCommand } from 'src/commands/mcp/doctorCommand.js';
import { registerMcpXaaIdpCommand } from 'src/commands/mcp/xaaIdpCommand.js';
import { fetchClaudeAIMcpConfigsIfEligible } from 'src/services/mcp/claudeai.js';
import { clearServerCache } from 'src/services/mcp/client.js';
import { areMcpConfigsAllowedWithEnterpriseMcpConfig, dedupClaudeAiMcpServers, doesEnterpriseMcpConfigExist, filterMcpServersByPolicy, getClaudeCodeMcpConfigs, getMcpServerSignature, parseMcpConfig, parseMcpConfigFromFilePath } from 'src/services/mcp/config.js';
import { excludeCommandsByServer, excludeResourcesByServer } from 'src/services/mcp/utils.js';
import { isXaaEnabled } from 'src/services/mcp/xaaIdpLogin.js';
import { getRelevantTips } from 'src/services/tips/tipRegistry.js';
import { logContextMetrics } from 'src/utils/api.js';
import { CLAUDE_IN_CHROME_MCP_SERVER_NAME, isClaudeInChromeMCPServer } from 'src/utils/claudeInChrome/common.js';
import { registerCleanup } from 'src/utils/cleanupRegistry.js';
import { createEmptyAttributionState } from 'src/utils/commitAttribution.js';
import { countConcurrentSessions, registerSession, updateSessionName } from 'src/utils/concurrentSessions.js';
import { getCwd } from 'src/utils/cwd.js';
import { logForDebugging, setHasFormattedOutput } from 'src/utils/debug.js';
import { errorMessage, getErrnoCode, isENOENT, TeleportOperationError, toError } from 'src/utils/errors.js';
import { isInteractiveSession } from 'src/utils/interactivity.js';
import { gracefulShutdown, gracefulShutdownSync } from 'src/utils/gracefulShutdown.js';
import { setAllHookEventsEnabled } from 'src/utils/hooks/hookEvents.js';
import { refreshModelCapabilities } from 'src/utils/model/modelCapabilities.js';
import { peekForStdinData, writeToStderr } from 'src/utils/process.js';
import { setCwd } from 'src/utils/Shell.js';
import { type ProcessedResume, processResumedConversation } from 'src/utils/sessionRestore.js';
import { plural } from 'src/utils/stringUtils.js';
import { type ChannelEntry, getInitialMainLoopModel, getIsNonInteractiveSession, getSdkBetas, getSessionId, getUserMsgOptIn, setAllowedChannels, setChromeFlagOverride, setClientType, setCwdState, setDirectConnectServerUrl, setInitialMainLoopModel, setInlinePlugins, setIsInteractive, setKairosActive, setOriginalCwd, setQuestionPreviewFormat, setSdkBetas, setSessionBypassPermissionsMode, setSessionDangerousPermissionMode, setSessionPersistenceDisabled, setSessionSource, setUserMsgOptIn, switchSession } from './bootstrap/state.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const autoModeStateModule = feature('TRANSCRIPT_CLASSIFIER') ? require('./utils/permissions/autoModeState.js') as typeof import('./utils/permissions/autoModeState.js') : null;

// TeleportRepoMismatchDialog, TeleportResumeWrapper dynamically imported at call sites
import { migrateAutoUpdatesToSettings } from './migrations/migrateAutoUpdatesToSettings.js';
import { migrateBypassPermissionsAcceptedToSettings } from './migrations/migrateBypassPermissionsAcceptedToSettings.js';
import { migrateEnableAllProjectMcpServersToSettings } from './migrations/migrateEnableAllProjectMcpServersToSettings.js';
import { migrateLegacyOpusToCurrent } from './migrations/migrateLegacyOpusToCurrent.js';
import { migrateOpusToOpus1m } from './migrations/migrateOpusToOpus1m.js';
import { migrateReplBridgeEnabledToRemoteControlAtStartup } from './migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.js';
import { migrateSonnet1mToSonnet45 } from './migrations/migrateSonnet1mToSonnet45.js';
import { migrateSonnet45ToSonnet46 } from './migrations/migrateSonnet45ToSonnet46.js';
import { resetAutoModeOptInForDefaultOffer } from './migrations/resetAutoModeOptInForDefaultOffer.js';
import { resetProToOpusDefault } from './migrations/resetProToOpusDefault.js';
import { createRemoteSessionConfig } from './remote/RemoteSessionManager.js';
/* eslint-enable @typescript-eslint/no-require-imports */
// teleportWithProgress dynamically imported at call site
import { createDirectConnectSession, DirectConnectError } from './server/createDirectConnectSession.js';
import { initializeLspServerManager } from './services/lsp/manager.js';
import { shouldEnablePromptSuggestion } from './services/PromptSuggestion/promptSuggestion.js';
import { type AppState, getDefaultAppState, IDLE_SPECULATION_STATE } from './state/AppStateStore.js';
import { onChangeAppState } from './state/onChangeAppState.js';
import { createStore } from './state/store.js';
import { asSessionId } from './types/ids.js';
import { filterAllowedSdkBetas } from './utils/betas.js';
import { isInBundledMode, isRunningWithBun } from './utils/bundledMode.js';
import { logForDiagnosticsNoPII } from './utils/diagLogs.js';
import { filterExistingPaths, getKnownPathsForRepo } from './utils/githubRepoPathMapping.js';
import { clearPluginCache, loadAllPluginsCacheOnly } from './utils/plugins/pluginLoader.js';
import { migrateChangelogFromConfig } from './utils/releaseNotes.js';
import { SandboxManager } from './utils/sandbox/sandbox-adapter.js';
import { fetchSession, prepareApiRequest } from './utils/teleport/api.js';
import { checkOutTeleportedSessionBranch, processMessagesForTeleportResume, teleportToRemoteWithErrorHandling, validateGitState, validateSessionRepository } from './utils/teleport.js';
import { shouldEnableThinkingByDefault, type ThinkingConfig } from './utils/thinking.js';
import { initUser, resetUserCache } from './utils/user.js';
import { getTmuxInstallInstructions, isTmuxAvailable, parsePRReference } from './utils/worktree.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effect

/**
 * Log managed settings keys to Statsig for analytics.
 * This is called after init() completes to ensure settings are loaded
 * and environment variables are applied before model resolution.
 */
function logManagedSettings(): void {
  try {
    const policySettings = getSettingsForSource('policySettings');
    if (policySettings) {
      const allKeys = getManagedSettingsKeysForLogging(policySettings);
      logEvent('tengu_managed_settings_loaded', {
        keyCount: allKeys.length,
        keys: allKeys.join(',') as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  } catch (error) {
    // Silently ignore errors - this is just for analytics
    logForDebugging(`[main] logManagedSettings failed: ${errorMessage(error)}`, { level: 'debug' })
  }
}

// Check if running in debug/inspection mode
function isBeingDebugged() {
  const isBun = isRunningWithBun();

  // Check for inspect flags in process arguments (including all variants)
  const hasInspectArg = process.execArgv.some(arg => {
    if (isBun) {
      // Note: Bun has an issue with single-file executables where application arguments
      // from process.argv leak into process.execArgv (similar to https://github.com/oven-sh/bun/issues/11673)
      // This breaks use of --debug mode if we omit this branch
      // We're fine to skip that check, because Bun doesn't support Node.js legacy --debug or --debug-brk flags
      return /--inspect(-brk)?/.test(arg);
    } else {
      // In Node.js, check for both --inspect and legacy --debug flags
      return /--inspect(-brk)?|--debug(-brk)?/.test(arg);
    }
  });

  // Check if NODE_OPTIONS contains inspect flags
  const hasInspectEnv = process.env.NODE_OPTIONS && /--inspect(-brk)?|--debug(-brk)?/.test(process.env.NODE_OPTIONS);

  // Check if inspector is available and active (indicates debugging)
  try {
    // Dynamic import would be better but is async - use global object instead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inspector = (global as any).require('inspector');
    const hasInspectorUrl = !!inspector.url();
    return hasInspectorUrl || hasInspectArg || hasInspectEnv;
  } catch {
    // Ignore error and fall back to argument detection
    return hasInspectArg || hasInspectEnv;
  }
}

// Exit if we detect node debugging or inspection
if (isBeingDebugged()) {
  // Use process.exit directly here since we're in the top-level code before imports
  // and gracefulShutdown is not yet available
  // eslint-disable-next-line custom-rules/no-top-level-side-effects
  process.stderr.write('[openclaude] Debugger detected. Attaching a debugger is not supported in external builds. Exiting.\n')
  process.exit(1);
}

/**
 * Per-session skill/plugin telemetry. Called from both the interactive path
 * and the headless -p path (before runHeadless) — both go through
 * main.tsx but branch before the interactive startup path, so it needs two
 * call sites here rather than one here + one in QueryEngine.
 */
function logSessionTelemetry(): void {
  const model = parseUserSpecifiedModel(getInitialMainLoopModel() ?? getDefaultMainLoopModel());
  void logSkillsLoaded(getCwd(), getContextWindowForModel(model, getSdkBetas()));
  void loadAllPluginsCacheOnly().then(({
    enabled,
    errors
  }) => {
    const managedNames = getManagedPluginNames();
    logPluginsEnabledForSession(enabled, managedNames, getPluginSeedDirs());
    logPluginLoadErrors(errors, managedNames);
  }).catch(err => logError(err));
}
function getCertEnvVarTelemetry(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (process.env.NODE_EXTRA_CA_CERTS) {
    result.has_node_extra_ca_certs = true;
  }
  if (process.env.CLAUDE_CODE_CLIENT_CERT) {
    result.has_client_cert = true;
  }
  if (hasNodeOption('--use-system-ca')) {
    result.has_use_system_ca = true;
  }
  if (hasNodeOption('--use-openssl-ca')) {
    result.has_use_openssl_ca = true;
  }
  return result;
}
async function logStartupTelemetry(): Promise<void> {
  if (isAnalyticsDisabled()) return;
  const [isGit, worktreeCount, ghAuthStatus] = await Promise.all([getIsGit(), getWorktreeCount(), getGhAuthStatus()]);
  logEvent('tengu_startup_telemetry', {
    is_git: isGit,
    worktree_count: worktreeCount,
    gh_auth_status: ghAuthStatus as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    sandbox_enabled: SandboxManager.isSandboxingEnabled(),
    are_unsandboxed_commands_allowed: SandboxManager.areUnsandboxedCommandsAllowed(),
    is_auto_bash_allowed_if_sandbox_enabled: SandboxManager.isAutoAllowBashIfSandboxedEnabled(),
    auto_updater_disabled: isAutoUpdaterDisabled(),
    prefers_reduced_motion: getInitialSettings().prefersReducedMotion ?? false,
    ...getCertEnvVarTelemetry()
  });
}

// @[MODEL LAUNCH]: Consider any migrations you may need for model strings. See migrateSonnet1mToSonnet45.ts for an example.
// Bump this when adding a new sync migration so existing users re-run the set.
const CURRENT_MIGRATION_VERSION = 11;
function runMigrations(): void {
  if (getGlobalConfig().migrationVersion !== CURRENT_MIGRATION_VERSION) {
    migrateAutoUpdatesToSettings();
    migrateBypassPermissionsAcceptedToSettings();
    migrateEnableAllProjectMcpServersToSettings();
    resetProToOpusDefault();
    migrateSonnet1mToSonnet45();
    migrateLegacyOpusToCurrent();
    migrateSonnet45ToSonnet46();
    migrateOpusToOpus1m();
    migrateReplBridgeEnabledToRemoteControlAtStartup();
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      resetAutoModeOptInForDefaultOffer();
    }
    saveGlobalConfig(prev => prev.migrationVersion === CURRENT_MIGRATION_VERSION ? prev : {
      ...prev,
      migrationVersion: CURRENT_MIGRATION_VERSION
    });
  }
  // Async migration - fire and forget since it's non-blocking
  migrateChangelogFromConfig().catch(error => {
    logError(
      new Error(
        `Changelog migration failed; will retry on next startup: ${errorMessage(error)}`,
      ),
    )
  });
}

/**
 * Prefetch system context (including git status) only when it's safe to do so.
 * Git commands can execute arbitrary code via hooks and config (e.g., core.fsmonitor,
 * diff.external), so we must only run them after trust is established or in
 * non-interactive mode where trust is implicit.
 */
function prefetchSystemContextIfSafe(): void {
  const isNonInteractiveSession = getIsNonInteractiveSession();

  // In non-interactive mode (--print), trust dialog is skipped and
  // execution is considered trusted (as documented in help text)
  if (isNonInteractiveSession) {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_non_interactive');
    void getSystemContext().catch(logError);
    return;
  }

  // In interactive mode, only prefetch if trust has already been established
  const hasTrust = checkHasTrustDialogAccepted();
  if (hasTrust) {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_has_trust');
    void getSystemContext().catch(logError);
  } else {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_skipped_no_trust');
  }
  // Otherwise, don't prefetch - wait for trust to be established first
}

/**
 * Start memory-pressure monitor + compaction trigger.
 * Idempotent — startMemoryPressureMonitor early-returns if already running.
 * Called from both headless (--print) and interactive REPL paths.
 */
function startMemoryMonitorIfNeeded(): void {
  void Promise.all([
    import('./utils/memoryPressure.js'),
    import('./utils/memoryCompaction.js'),
    import('./utils/concurrentSessions.js'),
  ]).then(([pressure, compaction, sessions]) =>
    sessions.calculatePerSessionMemoryBudget().then(budgetMB => {
      pressure.startMemoryPressureMonitor({ perSessionBudgetMB: budgetMB })
      compaction.createMemoryCompactionTrigger({
        onCompact: () => { },
        onPruneCache: () => {
          pressure.pruneRegisteredCaches()
        },
      })
    }),
  );
}

/**
 * Start background prefetches and housekeeping that are NOT needed before first render.
 * These are deferred from setup() to reduce event loop contention and child process
 * spawning during the critical startup path.
 * Call this after the REPL has been rendered.
 */
export function startDeferredPrefetches(): void {
  // This function runs after first render, so it doesn't block the initial paint.
  // However, the spawned processes and async work still contend for CPU and event
  // loop time, which skews startup benchmarks (CPU profiles, time-to-first-render
  // measurements). Skip all of it when we're only measuring startup performance.
  if (isEnvTruthy(process.env.CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER) ||
    // --bare: skip ALL prefetches. These are cache-warms for the REPL's
    // first-turn responsiveness (initUser, getUserContext, tips, countFiles,
    // modelCapabilities, change detectors). Scripted -p calls don't have a
    // "user is typing" window to hide this work in — it's pure overhead on
    // the critical path.
    isBareMode()) {
    return;
  }

  // Process-spawning prefetches (consumed at first API call, user is still typing)
  void initUser();
  void getUserContext();
  prefetchSystemContextIfSafe();
  void getRelevantTips();
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) && !isEnvTruthy(process.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH)) {
    void prefetchAwsCredentialsAndBedRockInfoIfSafe();
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) && !isEnvTruthy(process.env.CLAUDE_CODE_SKIP_VERTEX_AUTH)) {
    void prefetchGcpCredentialsIfSafe();
  }
  const { signal: countFilesSignal, cleanup: cleanupCountFilesSignal } =
    createCombinedAbortSignal(undefined, { timeoutMs: 3000 });
  void countFilesRoundedRg(getCwd(), countFilesSignal, []).finally(
    cleanupCountFilesSignal,
  );

  // Analytics and feature flag initialization
  void initializeAnalyticsGates();
  void prefetchOfficialMcpUrls();
  void refreshModelCapabilities();

  // File change detectors deferred from init() to unblock first render
  void settingsChangeDetector.initialize();
  if (!isBareMode()) {
    void skillChangeDetector.initialize();
  }

}
/**
 * Parse and load settings flags early, before init()
 * This ensures settings are filtered from the start of initialization
 */
function eagerLoadSettings(): void {
  const result = eagerLoadSettingsFromArgs();
  if (!result.ok) {
    if (result.cause instanceof Error) {
      logError(result.cause);
    }
    process.stderr.write(chalk.red(`${result.message}\n`));
    process.exit(1);
  }
}
function initializeEntrypoint(isNonInteractive: boolean): void {
  // Skip if already set (e.g., by SDK or other entrypoints)
  if (process.env.CLAUDE_CODE_ENTRYPOINT) {
    return;
  }
  const cliArgs = process.argv.slice(2);

  // Check for MCP serve command (handle flags before mcp serve, e.g., --debug mcp serve)
  const mcpIndex = cliArgs.indexOf('mcp');
  if (mcpIndex !== -1 && cliArgs[mcpIndex + 1] === 'serve') {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'mcp';
    return;
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_ACTION)) {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'claude-code-github-action';
    return;
  }

  // Note: 'local-agent' entrypoint is set by the local agent mode launcher
  // via CLAUDE_CODE_ENTRYPOINT env var (handled by early return above)

  // Set based on interactive status
  process.env.CLAUDE_CODE_ENTRYPOINT = isNonInteractive ? 'sdk-cli' : 'cli';
}

// Set by early argv processing when `claude open <url>` is detected (interactive mode only)
type PendingConnect = {
  url: string | undefined;
  authToken: string | undefined;
  dangerouslySkipPermissions: boolean;
};
const _pendingConnect: PendingConnect | undefined = feature('DIRECT_CONNECT') ? {
  url: undefined,
  authToken: undefined,
  dangerouslySkipPermissions: false
} : undefined;

// Set by early argv processing when `claude assistant [sessionId]` is detected
type PendingAssistantChat = {
  sessionId?: string;
  discover: boolean;
};
const _pendingAssistantChat: PendingAssistantChat | undefined = feature('KAIROS') ? {
  sessionId: undefined,
  discover: false
} : undefined;

// `claude ssh <host> [dir]` — parsed from argv early (same pattern as
// DIRECT_CONNECT above) so the main command path can pick it up and hand
// the REPL an SSH-backed session instead of a local one.
type PendingSSH = {
  host: string | undefined;
  cwd: string | undefined;
  permissionMode: string | undefined;
  dangerouslySkipPermissions: boolean;
  /** --local: spawn the child CLI directly, skip ssh/probe/deploy. e2e test mode. */
  local: boolean;
  /** Extra CLI args to forward to the remote CLI on initial spawn (--resume, -c). */
  extraCliArgs: string[];
};
const _pendingSSH: PendingSSH | undefined = feature('SSH_REMOTE') ? {
  host: undefined,
  cwd: undefined,
  permissionMode: undefined,
  dangerouslySkipPermissions: false,
  local: false,
  extraCliArgs: []
} : undefined;

export async function main() {

  // SECURITY: Prevent Windows from executing commands from current directory
  // This must be set before ANY command execution to prevent PATH hijacking attacks
  // See: https://docs.microsoft.com/en-us/windows/win32/api/processenv/nf-processenv-searchpathw
  process.env.NoDefaultCurrentDirectoryInExePath = '1';

  // Initialize warning handler early to catch warnings
  initializeWarningHandler();
  process.on('exit', () => {
    resetCursor();
  });
  process.on('SIGINT', () => {
    // In print mode, print.ts registers its own SIGINT handler that aborts
    // the in-flight query and calls gracefulShutdown; skip here to avoid
    // preempting it with a synchronous process.exit().
    if (process.argv.includes('-p') || process.argv.includes('--print')) {
      return;
    }
    process.exit(0);
  });

  // Check for cc:// or cc+unix:// URL in argv — rewrite so the main command
  // handles it, giving the full interactive TUI instead of a stripped-down subcommand.
  // For headless (-p), we rewrite to the internal `open` subcommand.
  if (feature('DIRECT_CONNECT')) {
    const rawCliArgs = process.argv.slice(2);
    const ccIdx = rawCliArgs.findIndex(a => a.startsWith('cc://') || a.startsWith('cc+unix://'));
    if (ccIdx !== -1 && _pendingConnect) {
      const ccUrl = rawCliArgs[ccIdx]!;
      const {
        parseConnectUrl
      } = await import('./server/parseConnectUrl.js');
      const parsed = parseConnectUrl(ccUrl);
      _pendingConnect.dangerouslySkipPermissions = rawCliArgs.includes('--dangerously-skip-permissions');
      if (rawCliArgs.includes('-p') || rawCliArgs.includes('--print')) {
        // Headless: rewrite to internal `open` subcommand
        const stripped = rawCliArgs.filter((_, i) => i !== ccIdx);
        const dspIdx = stripped.indexOf('--dangerously-skip-permissions');
        if (dspIdx !== -1) {
          stripped.splice(dspIdx, 1);
        }
        process.argv = [process.argv[0]!, process.argv[1]!, 'open', ccUrl, ...stripped];
      } else {
        // Interactive: strip cc:// URL and flags, run main command
        _pendingConnect.url = parsed.serverUrl;
        _pendingConnect.authToken = parsed.authToken;
        const stripped = rawCliArgs.filter((_, i) => i !== ccIdx);
        const dspIdx = stripped.indexOf('--dangerously-skip-permissions');
        if (dspIdx !== -1) {
          stripped.splice(dspIdx, 1);
        }
        process.argv = [process.argv[0]!, process.argv[1]!, ...stripped];
      }
    }
  }

  // Handle deep link URIs early — this is invoked by the OS protocol handler
  // and should bail out before full init since it only needs to parse the URI
  // and open a terminal.
  if (feature('LODESTONE')) {
    const handleUriIdx = process.argv.indexOf('--handle-uri');
    if (handleUriIdx !== -1 && process.argv[handleUriIdx + 1]) {
      const {
        enableConfigs
      } = await import('./utils/config.js');
      enableConfigs();
      const uri = process.argv[handleUriIdx + 1]!;
      const {
        handleDeepLinkUri
      } = await import('./utils/deepLink/protocolHandler.js');
      const exitCode = await handleDeepLinkUri(uri);
      process.exit(exitCode);
    }

    // macOS URL handler: when LaunchServices launches our .app bundle, the
    // URL arrives via Apple Event (not argv). LaunchServices overwrites
    // __CFBundleIdentifier to the launching bundle's ID, which is a precise
    // positive signal — cheaper than importing and guessing with heuristics.
    if (process.platform === 'darwin' && process.env.__CFBundleIdentifier === 'com.anthropic.claude-code-url-handler') {
      const {
        enableConfigs
      } = await import('./utils/config.js');
      enableConfigs();
      const {
        handleUrlSchemeLaunch
      } = await import('./utils/deepLink/protocolHandler.js');
      const urlSchemeResult = await handleUrlSchemeLaunch();
      process.exit(urlSchemeResult ?? 1);
    }
  }

  // `claude assistant [sessionId]` — stash and strip so the main
  // command handles it, giving the full interactive TUI. Position-0 only
  // (matching the ssh pattern below) — indexOf would false-positive on
  // `claude -p "explain assistant"`. Root-flag-before-subcommand
  // (e.g. `--debug assistant`) falls through to the stub, which
  // prints usage.
  if (feature('KAIROS') && _pendingAssistantChat) {
    const rawArgs = process.argv.slice(2);
    if (rawArgs[0] === 'assistant') {
      const nextArg = rawArgs[1];
      if (nextArg && !nextArg.startsWith('-')) {
        _pendingAssistantChat.sessionId = nextArg;
        rawArgs.splice(0, 2); // drop 'assistant' and sessionId
        process.argv = [process.argv[0]!, process.argv[1]!, ...rawArgs];
      } else if (!nextArg) {
        _pendingAssistantChat.discover = true;
        rawArgs.splice(0, 1); // drop 'assistant'
        process.argv = [process.argv[0]!, process.argv[1]!, ...rawArgs];
      }
      // else: `claude assistant --help` → fall through to stub
    }
  }

  // `claude ssh <host> [dir]` — strip from argv so the main command handler
  // runs (full interactive TUI), stash the host/dir for the REPL branch at
  // ~line 3720 to pick up. Headless (-p) mode not supported in v1: SSH
  // sessions need the local REPL to drive them (interrupt, permissions).
  if (feature('SSH_REMOTE') && _pendingSSH) {
    const rawCliArgs = process.argv.slice(2);
    // SSH-specific flags can appear before the host positional (e.g.
    // `ssh --permission-mode auto host /tmp` — standard POSIX flags-before-
    // positionals). Pull them all out BEFORE checking whether a host was
    // given, so `claude ssh --permission-mode auto host` and `claude ssh host
    // --permission-mode auto` are equivalent. The host check below only needs
    // to guard against `-h`/`--help` (which commander should handle).
    if (rawCliArgs[0] === 'ssh') {
      const localIdx = rawCliArgs.indexOf('--local');
      if (localIdx !== -1) {
        _pendingSSH.local = true;
        rawCliArgs.splice(localIdx, 1);
      }
      const dspIdx = rawCliArgs.indexOf('--dangerously-skip-permissions');
      if (dspIdx !== -1) {
        _pendingSSH.dangerouslySkipPermissions = true;
        rawCliArgs.splice(dspIdx, 1);
      }
      const pmIdx = rawCliArgs.indexOf('--permission-mode');
      if (pmIdx !== -1 && rawCliArgs[pmIdx + 1] && !rawCliArgs[pmIdx + 1]!.startsWith('-')) {
        _pendingSSH.permissionMode = rawCliArgs[pmIdx + 1];
        rawCliArgs.splice(pmIdx, 2);
      }
      const pmEqIdx = rawCliArgs.findIndex(a => a.startsWith('--permission-mode='));
      if (pmEqIdx !== -1) {
        _pendingSSH.permissionMode = rawCliArgs[pmEqIdx]!.split('=')[1];
        rawCliArgs.splice(pmEqIdx, 1);
      }
      // Forward session-resume + model flags to the remote CLI's initial spawn.
      // --continue/-c and --resume <uuid> operate on the REMOTE session history
      // (which persists under the remote's ~/.claude/projects/<cwd>/).
      // --model controls which model the remote uses.
      const extractFlag = (flag: string, opts: {
        hasValue?: boolean;
        as?: string;
      } = {}) => {
        const i = rawCliArgs.indexOf(flag);
        if (i !== -1) {
          _pendingSSH.extraCliArgs.push(opts.as ?? flag);
          const val = rawCliArgs[i + 1];
          if (opts.hasValue && val && !val.startsWith('-')) {
            _pendingSSH.extraCliArgs.push(val);
            rawCliArgs.splice(i, 2);
          } else {
            rawCliArgs.splice(i, 1);
          }
        }
        const eqI = rawCliArgs.findIndex(a => a.startsWith(`${flag}=`));
        if (eqI !== -1) {
          _pendingSSH.extraCliArgs.push(opts.as ?? flag, rawCliArgs[eqI]!.slice(flag.length + 1));
          rawCliArgs.splice(eqI, 1);
        }
      };
      extractFlag('-c', {
        as: '--continue'
      });
      extractFlag('--continue');
      extractFlag('--resume', {
        hasValue: true
      });
      extractFlag('--model', {
        hasValue: true
      });
      extractFlag('--fallback-model', {
        hasValue: true
      });
    }
    // After pre-extraction, any remaining dash-arg at [1] is either -h/--help
    // (commander handles) or an unknown-to-ssh flag (fall through to commander
    // so it surfaces a proper error). Only a non-dash arg is the host.
    if (rawCliArgs[0] === 'ssh' && rawCliArgs[1] && !rawCliArgs[1].startsWith('-')) {
      _pendingSSH.host = rawCliArgs[1];
      // Optional positional cwd.
      let consumed = 2;
      if (rawCliArgs[2] && !rawCliArgs[2].startsWith('-')) {
        _pendingSSH.cwd = rawCliArgs[2];
        consumed = 3;
      }
      const rest = rawCliArgs.slice(consumed);

      // Headless (-p) mode is not supported with SSH in v1 — reject early
      // so the flag doesn't silently cause local execution.
      if (rest.includes('-p') || rest.includes('--print')) {
        process.stderr.write('Error: headless (-p/--print) mode is not supported with openclaude ssh\n');
        gracefulShutdownSync(1);
        return;
      }

      // Rewrite argv so the main command sees remaining flags but not `ssh`.
      process.argv = [process.argv[0]!, process.argv[1]!, ...rest];
    }
  }

  // Check for interactivity early to set isInteractiveSession before init()
  // This is needed because telemetry initialization calls auth functions that need this flag
  const isInteractive = isInteractiveSession({
    stdoutIsTTY: process.stdout?.isTTY ?? false,
    args: process.argv?.slice(2) ?? [],
    env: process.env ?? {},
  })
  const isNonInteractive = !isInteractive;

  // Stop capturing early input for non-interactive modes
  if (isNonInteractive) {
    stopCapturingEarlyInput();
  }

  // Set simplified tracking fields
  setIsInteractive(isInteractive);

  // Initialize entrypoint based on mode - needs to be set before any event is logged
  initializeEntrypoint(isNonInteractive);

  // Determine client type
  const clientType = (() => {
    if (isEnvTruthy(process.env.GITHUB_ACTIONS)) return 'github-action';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-ts') return 'sdk-typescript';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-py') return 'sdk-python';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') return 'sdk-cli';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'claude-vscode') return 'claude-vscode';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'local-agent') return 'local-agent';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'claude-desktop') return 'claude-desktop';

    // Check if session-ingress token is provided (indicates remote session)
    const hasSessionIngressToken = process.env.CLAUDE_CODE_SESSION_ACCESS_TOKEN || process.env.CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR;
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'remote' || hasSessionIngressToken) {
      return 'remote';
    }
    return 'cli';
  })();
  setClientType(clientType);
  const previewFormat = process.env.CLAUDE_CODE_QUESTION_PREVIEW_FORMAT;
  if (previewFormat === 'markdown' || previewFormat === 'html') {
    setQuestionPreviewFormat(previewFormat);
  } else if (!clientType.startsWith('sdk-') &&
    // Desktop and CCR pass previewFormat via toolConfig; when the feature is
    // gated off they pass undefined — don't override that with markdown.
    clientType !== 'claude-desktop' && clientType !== 'local-agent' && clientType !== 'remote') {
    setQuestionPreviewFormat('markdown');
  }

  // Tag sessions created via `claude remote-control` so the backend can identify them
  if (process.env.CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge') {
    setSessionSource('remote-control');
  }

  // Parse and load settings flags early, before init()
  eagerLoadSettings();
  await run();
}
async function getInputPrompt(
  prompt: string,
  inputFormat: 'text' | 'stream-json',
): Promise<string | AsyncIterable<string>> {
  const isBrowser =
    typeof window !== 'undefined' && typeof document !== 'undefined'

  if (isBrowser) {
    return prompt
  }

  const stdin = process.stdin

  if (
    !stdin ||
    typeof stdin.isTTY === 'undefined' ||
    typeof stdin.on !== 'function' ||
    typeof stdin.off !== 'function' ||
    typeof stdin.setEncoding !== 'function'
  ) {
    return prompt
  }

  if (
    !stdin.isTTY &&
    !process.argv.includes('mcp')
  ) {
    if (inputFormat === 'stream-json') {
      return stdin
    }

    stdin.setEncoding('utf8')

    let data = ''

    const onData = (chunk: string) => {
      data += chunk
    }

    stdin.on('data', onData)

    const timedOut = await peekForStdinData(stdin, 3000)

    stdin.off('data', onData)

    if (timedOut) {
      process.stderr.write(
        'Warning: no stdin data received in 3s, proceeding without it. ' +
        'If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.\n',
      )
    }

    return [prompt, data].filter(Boolean).join('\n')
  }

  return prompt
}
async function run(): Promise<void> {

  // Create help config that sorts options by long option name.
  // Commander supports compareOptions at runtime but @commander-js/extra-typings
  // doesn't include it in the type definitions, so we use Object.assign to add it.
  function createSortedHelpConfig(): {
    sortSubcommands: true;
    sortOptions: true;
  } {
    const getOptionSortKey = (opt: Option): string => opt.long?.replace(/^--/, '') ?? opt.short?.replace(/^-/, '') ?? '';
    return Object.assign({
      sortSubcommands: true,
      sortOptions: true
    } as const, {
      compareOptions: (a: Option, b: Option) => getOptionSortKey(a).localeCompare(getOptionSortKey(b))
    });
  }

  const program = new CommanderCommand().configureHelp(createSortedHelpConfig()).enablePositionalOptions();

  // Ink root is only needed for interactive sessions — patchConsole in the
  // Ink constructor would swallow console output in headless mode.
  let root!: Root;
  let getFpsMetrics!: () => FpsMetrics | undefined;
  let stats!: StatsStore;

  await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()]);
  await init();

  // process.title on Windows sets the console title directly; on POSIX,
  // terminal shell integration may mirror the process name to the tab.
  // After init() so settings.json env can also gate this (gh-4765).
  if (!isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE)) {
    process.title = 'openclaude';
  }

  // Attach logging sinks so subcommand handlers can use logEvent/logError.
  // Before PR #11106 logEvent dispatched directly; after, events queue until
  // a sink attaches. setup() attaches sinks for the default command, but
  // subcommands (doctor, mcp, plugin, auth) never call setup() and would
  // silently drop events on process.exit(). Both inits are idempotent.
  const {
    initSinks
  } = await import('./utils/sinks.js');
  initSinks();

  runMigrations();

  // Load remote managed settings for enterprise customers (non-blocking)
  // Fails open - if fetch fails, continues without remote settings
  // Settings are applied via hot-reload when they arrive
  // Must happen after init() to ensure config reading is allowed
  void loadRemoteManagedSettings();
  void loadPolicyLimits();

  // Load settings sync (non-blocking, fail-open)
  // CLI: uploads local settings to remote (CCR download is handled by print.ts)
  if (feature('UPLOAD_USER_SETTINGS')) {
    void import('./services/settingsSync/index.js').then(m => m.uploadUserSettingsInBackground());
  }

  const allowedTools: string[] = []
  const disallowedTools: string[] = []
  const baseTools: string[] = []
  const addDir: string[] = []

  const permissionModeCli: string | undefined = undefined
  const dangerouslySkipPermissions = false
  const allowDangerouslySkipPermissions = false

  let kairosEnabled = false
  let remoteControl = false
  const fullRemoteControl =
    remoteControl || getRemoteControlAtStartup() || kairosEnabled

  let ccrMirrorEnabled = false
  let thinkingEnabled = shouldEnableThinkingByDefault()

  const prompt = ''
  let advisorModel: string | undefined

  const agentsJson: string | undefined = undefined
  const initOnly = false
  const maintenance = false
  const debug = false
  const debugToStderr = false

  // Get isNonInteractiveSession from state (was set before init())
  const isNonInteractiveSession = getIsNonInteractiveSession();


  const initialMainLoopModel = getInitialMainLoopModel();
  const resolvedInitialModel = parseUserSpecifiedModel(initialMainLoopModel ?? getDefaultMainLoopModel());

  const effectivePrompt = prompt || '';
  const inputFormat: 'text' | 'stream-json' = 'text'
  let inputPrompt = await getInputPrompt(effectivePrompt, inputFormat)

  // Build initial notification queue
  const initialNotifications: Array<{
    key: string;
    text: string;
    color?: 'warning';
    priority: 'high';
  }> = [];


  const {
    mode: permissionMode,
    notification: permissionModeNotification
  } = initialPermissionModeFromCLI({
    permissionModeCli,
    dangerouslySkipPermissions
  });


  // This await replaces blocking existsSync/statSync calls that were already in
  // the startup path. Wall-clock time is unchanged; we just yield to the event
  // loop during the fs I/O instead of blocking it. See #19661.
  const initResult = await initializeToolPermissionContext({
    allowedToolsCli: allowedTools,
    disallowedToolsCli: disallowedTools,
    baseToolsCli: baseTools,
    permissionMode,
    allowDangerouslySkipPermissions,
    addDirs: addDir
  });
  let toolPermissionContext = initResult.toolPermissionContext;
  const {
    warnings,
    dangerousPermissions,
    overlyBroadBashPermissions
  } = initResult;

  let verbose = getGlobalConfig().verbose;

  const initialIsBriefOnly = feature('KAIROS') || feature('KAIROS_BRIEF') ? getUserMsgOptIn() : false;

  const effectiveToolPermissionContext = {
    ...toolPermissionContext,
    mode: isAgentSwarmsEnabled() && getTeammateUtils().isPlanModeRequired() ? 'plan' as const : toolPermissionContext.mode
  };

  // Extract worktree option
  // worktree can be true (flag without value) or a string (custom name or PR reference)
  const worktreeOption = isWorktreeModeEnabled() ?? undefined;
  let worktreeName = typeof worktreeOption === 'string' ? worktreeOption : undefined;
  const worktreeEnabled = worktreeOption !== undefined;

  const preSetupCwd = getCwd();

    // Extract strict MCP config flag
  const strictMcpConfig = false;

  // Parse the MCP config files/strings if provided
  let dynamicMcpConfig: Record<string, ScopedMcpServerConfig> = {};
  const mcpConfigStart = Date.now();
  let mcpConfigResolvedMs: number | undefined;
  // --bare skips auto-discovered MCP (.mcp.json, user settings, plugins) —
  // only explicit --mcp-config works. dynamicMcpConfig is spread onto
  // allMcpConfigs downstream so it survives this skip.
  const mcpConfigPromise = (strictMcpConfig || isBareMode() ? Promise.resolve({
    servers: {} as Record<string, ScopedMcpServerConfig>
  }) : getClaudeCodeMcpConfigs(dynamicMcpConfig)).then(result => {
    mcpConfigResolvedMs = Date.now() - mcpConfigStart;
    return result;
  });

  const {
    servers: existingMcpConfigs
  } = await mcpConfigPromise;
  // CLI flag (--mcp-config) should override file-based configs, matching settings precedence
  const allMcpConfigs = {
    ...existingMcpConfigs,
    ...dynamicMcpConfig
  };


  // Separate SDK configs from regular MCP configs
  const sdkMcpConfigs: Record<string, McpSdkServerConfig> = {};
  const regularMcpConfigs: Record<string, ScopedMcpServerConfig> = {};
  for (const [name, config] of Object.entries(allMcpConfigs)) {
    const typedConfig = config as ScopedMcpServerConfig | McpSdkServerConfig;
    if (typedConfig.type === 'sdk') {
      sdkMcpConfigs[name] = typedConfig as McpSdkServerConfig;
    } else {
      regularMcpConfigs[name] = typedConfig as ScopedMcpServerConfig;
    }
  }


  // claude.ai config fetch: -p mode only (interactive uses useManageMCPConnections
  // two-phase loading). Kicked off here to overlap with setup(); awaited
  // before runHeadless so single-turn -p sees connectors. Skipped under
  // enterprise/strict MCP to preserve policy boundaries.
  const claudeaiConfigPromise: Promise<Record<string, ScopedMcpServerConfig>> = isNonInteractiveSession && !strictMcpConfig && !doesEnterpriseMcpConfigExist() &&
  // --bare / SIMPLE: skip claude.ai proxy servers (datadog, Gmail,
  // Slack, BigQuery, PubMed — 6-14s each to connect). Scripted calls
  // that need MCP pass --mcp-config explicitly.
  !isBareMode() ? fetchClaudeAIMcpConfigsIfEligible().then(configs => {
    const {
      allowed,
      blocked
    } = filterMcpServersByPolicy(configs);
    if (blocked.length > 0) {
      process.stderr.write(`Warning: claude.ai MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}\n`);
    }
    return allowed;
  }) : Promise.resolve({});

  // Prefetch MCP resources after trust dialog (this is where execution happens).
  // Interactive mode only: print mode defers connects until headlessStore exists
  // and pushes per-server (below), so ToolSearch's pending-client handling works
  // and one slow server doesn't block the batch.
  const localMcpPromise = isNonInteractiveSession ? Promise.resolve({
    clients: [],
    tools: [],
    commands: []
  }) : prefetchAllMcpResources(regularMcpConfigs);
  const claudeaiMcpPromise = isNonInteractiveSession ? Promise.resolve({
    clients: [],
    tools: [],
    commands: []
  }) : claudeaiConfigPromise.then(configs => Object.keys(configs).length > 0 ? prefetchAllMcpResources(configs) : {
    clients: [],
    tools: [],
    commands: []
  });

  

  // Merge with dedup by name: each prefetchAllMcpResources call independently
  // adds helper tools (ListMcpResourcesTool, ReadMcpResourceTool) via
  // local dedup flags, so merging two calls can yield duplicates. print.ts
  // already uniqBy's the final tool pool, but dedup here keeps appState clean.
  const mcpPromise = Promise.all([localMcpPromise, claudeaiMcpPromise]).then(([local, claudeai]) => ({
    clients: [...local.clients, ...claudeai.clients],
    tools: uniqBy([...local.tools, ...claudeai.tools], 'name'),
    commands: uniqBy([...local.commands, ...claudeai.commands], 'name')
  }));


  mcpPromise.catch(() => {});
  const mcpClients: Awaited<typeof mcpPromise>['clients'] = [];
  const mcpTools: Awaited<typeof mcpPromise>['tools'] = [];
  const mcpCommands: Awaited<typeof mcpPromise>['commands'] = [];
  
  // Reuse preSetupCwd unless setup() chdir'd (worktreeEnabled). Saves a
  // getCwd() syscall in the common path.
  const currentCwd = worktreeEnabled ? getCwd() : preSetupCwd;
  logForDebugging('[STARTUP] Loading commands and agents...');
  const commandsStart = Date.now();

  const setupStart = Date.now();
  const isBrowserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
  const setupPromise = isBrowserRuntime ? Promise.resolve() : (async () => {
    const { setup } = await import('./setup.js');
    await setup(preSetupCwd, permissionMode, allowDangerouslySkipPermissions, worktreeEnabled, worktreeName, false, undefined, 0, '');
  })();
  await setupPromise;
  
  const commandsPromise = worktreeEnabled ? null : getCommands(preSetupCwd);
  const agentDefsPromise = worktreeEnabled ? null : getAgentDefinitionsWithOverrides(preSetupCwd);
  // Suppress transient unhandledRejection if these reject during the
  // ~28ms setupPromise await before Promise.all joins them below.
  commandsPromise?.catch(() => {});
  agentDefsPromise?.catch(() => {});
  // Join the promises kicked before setup() (or start fresh if
  // worktreeEnabled gated the early kick). Both memoized by cwd.
  const [commands, agentDefinitionsResult] = await Promise.all([
    commandsPromise ?? getCommands(currentCwd),
    agentDefsPromise ?? getAgentDefinitionsWithOverrides(currentCwd),
  ])
  
  // Parse CLI agents if provided via --agents flag
  let cliAgents: typeof agentDefinitionsResult.activeAgents = [];
  if (agentsJson) {
    try {
      const parsedAgents = safeParseJSON(agentsJson);
      if (parsedAgents) {
        cliAgents = parseAgentsFromJson(parsedAgents, 'flagSettings');
      }
    } catch (error) {
      logError(error);
    }
  }
  
  // Merge CLI agents with existing ones
  const allAgents = [...agentDefinitionsResult.allAgents, ...cliAgents];
  const agentDefinitions = {
    ...agentDefinitionsResult,
    allAgents,
    activeAgents: getActiveAgentsFromList(allAgents)
  };

  const initialState: AppState = {
    settings: getInitialSettings(),
    tasks: {},
    agentNameRegistry: new Map(),
    // Session-scoped auto-continuation goal — starts unset, matching
    // AppStateStore's default state factory.
    goal: null,
    verbose: verbose ?? getGlobalConfig().verbose ?? false,
    mainLoopModel: initialMainLoopModel,
    mainLoopModelForSession: null,
    isBriefOnly: initialIsBriefOnly,
    expandedView: getGlobalConfig().showSpinnerTree ? 'teammates' : getGlobalConfig().showExpandedTodos ? 'tasks' : 'none',
    showTeammateMessagePreview: isAgentSwarmsEnabled() ? false : undefined,
    selectedIPAgentIndex: -1,
    coordinatorTaskIndex: -1,
    viewSelectionMode: 'none',
    footerSelection: null,
    toolPermissionContext: effectiveToolPermissionContext,
    agent: '',
    agentDefinitions,
    mcp: {
      clients: [],
      tools: [],
      commands: [],
      resources: {},
      pluginReconnectKey: 0
    },
    plugins: {
      enabled: [],
      disabled: [],
      commands: [],
      errors: [],
      installationStatus: {
        marketplaces: [],
        plugins: []
      },
      needsRefresh: false
    },
    statusLineText: undefined,
    kairosEnabled,
    remoteSessionUrl: undefined,
    remoteConnectionStatus: 'connecting',
    remoteBackgroundTaskCount: 0,
    replBridgeEnabled: fullRemoteControl || ccrMirrorEnabled,
    replBridgeExplicit: remoteControl,
    replBridgeOutboundOnly: ccrMirrorEnabled,
    replBridgeConnected: false,
    replBridgeSessionActive: false,
    replBridgeReconnecting: false,
    replBridgeConnectUrl: undefined,
    replBridgeSessionUrl: undefined,
    replBridgeEnvironmentId: undefined,
    replBridgeSessionId: undefined,
    replBridgeError: undefined,
    replBridgeInitialName: 'RemoteControlName Rilan',
    showRemoteCallout: false,
    notifications: {
      current: null,
      queue: initialNotifications
    },
    elicitation: {
      queue: []
    },
    todos: {},
    remoteAgentTaskSuggestions: [],
    fileHistory: {
      snapshots: [],
      trackedFiles: new Set(),
      snapshotSequence: 0
    },
    attribution: createEmptyAttributionState(),
    thinkingEnabled,
    promptSuggestionEnabled: shouldEnablePromptSuggestion(),
    sessionHooks: new Map(),
    inbox: {
      messages: []
    },
    promptSuggestion: {
      text: null,
      promptId: null,
      shownAt: 0,
      acceptedAt: 0,
      generationRequestId: null
    },
    speculation: IDLE_SPECULATION_STATE,
    speculationSessionTimeSavedMs: 0,
    skillImprovement: {
      suggestion: null
    },
    workerSandboxPermissions: {
      queue: [],
      selectedIndex: 0
    },
    pendingWorkerRequest: null,
    pendingSandboxRequest: null,
    authVersion: 0,
    initialMessage: inputPrompt ? {
      message: createUserMessage({
        content: String(inputPrompt)
      })
    } : null,
    effortValue: getInitialEffortSetting(),
    activeOverlays: new Set<string>(),
    fastMode: getInitialFastModeSetting(resolvedInitialModel),
    ...(isAdvisorEnabled() && advisorModel && {
      advisorModel
    }),
    // Compute teamContext synchronously to avoid useEffect setState during render.
    // KAIROS: assistantTeamContext takes precedence — set earlier in the
    // KAIROS block so Agent(name: "foo") can spawn in-process teammates
    // without TeamCreate. computeInitialTeamContext() is for tmux-spawned
    // teammates reading their own identity, not the assistant-mode leader.
    // teamContext: feature('KAIROS') ? assistantTeamContext ?? computeInitialTeamContext?.() : computeInitialTeamContext?.()
  };

  let mainThreadAgentDefinition: (typeof agentDefinitions.activeAgents)[number] | undefined;

  // Start hooks early so they run in parallel with MCP connections.
  // Skip for initOnly/init/maintenance (handled separately), non-interactive
  // (handled via setupTrigger), and resume/continue (conversationRecovery.ts
  // fires 'resume' instead — without this guard, hooks fire TWICE on /resume
  // and the second systemMessage clobbers the first. gh-30825)
  const hooksPromise = initOnly || maintenance || isNonInteractiveSession ? null : processSessionStartHooks('startup', {
    agentType: mainThreadAgentDefinition?.agentType,
    model: resolvedInitialModel
  });

  const initialTools = mcpTools;
  const ide = false
  // Extract disable slash commands flag
  const disableSlashCommands = false;

  const userSpecifiedModel = getDefaultMainLoopModel();
  const userSpecifiedFallbackModel = getDefaultMainLoopModel();
  const hasExplicitModelOverride = userSpecifiedModel !== undefined;
  const baseMainLoopModel = userSpecifiedModel ?? getUserSpecifiedModelSetting() ?? null;

  // Handle system prompt options
  let systemPrompt = '';
  // Handle append system prompt options
  let appendSystemPrompt = '';

  let thinkingConfig: ThinkingConfig = thinkingEnabled !== false ? {
    type: 'adaptive'
  } : {
    type: 'disabled'
  };

  const sessionConfig = {
    debug: debug || debugToStderr,
    commands: [...commands, ...mcpCommands],
    initialTools,
    mcpClients,
    autoConnectIdeFlag: ide,
    mainThreadAgentDefinition,
    baseMainLoopModel,
    hasExplicitModelOverride,
    fallbackModel: userSpecifiedFallbackModel,
    disableSlashCommands,
    dynamicMcpConfig,
    strictMcpConfig,
    systemPrompt,
    appendSystemPrompt,
    thinkingConfig
  };

  // MCP never blocks REPL render OR turn 1 TTFT. useManageMCPConnections
  // populates appState.mcp async as servers connect (connectToServer is
  // memoized — the prefetch calls above and the hook converge on the same
  // connections). getToolUseContext reads store.getState() fresh via
  // computeTools(), so turn 1 sees whatever's connected by query time.
  // Slow servers populate for turn 2+. Matches interactive-no-prompt
  // behavior. Print mode: per-server push into headlessStore (below).
  const hookMessages: Awaited<NonNullable<typeof hooksPromise>> = [];

  const pendingHookMessages = hooksPromise && hookMessages.length === 0 ? hooksPromise : undefined;

  // If launched via a deep link, show a provenance banner so the user
  // knows the session originated externally. Linux xdg-open and
  // browsers with "always allow" set dispatch the link with no OS-level
  // confirmation, so this is the only signal the user gets that the
  // prompt — and the working directory / CLAUDE.md it implies — came
  // from an external source rather than something they typed.
  let deepLinkBanner: ReturnType<typeof createSystemMessage> | null = null;

  const initialMessages = deepLinkBanner ? [deepLinkBanner, ...hookMessages] : hookMessages.length > 0 ? hookMessages : undefined;

  return await launchRepl(root, {
    getFpsMetrics,
    stats,
    initialState,
    renderMode: 'web'
  }, {
    ...sessionConfig,
    initialMessages,
    pendingHookMessages
  }, renderAndRun);
}

async function logTenguInit({
  hasInitialPrompt,
  hasStdin,
  verbose,
  debug,
  debugToStderr,
  print,
  outputFormat,
  inputFormat,
  numAllowedTools,
  numDisallowedTools,
  mcpClientCount,
  worktreeEnabled,
  skipWebFetchPreflight,
  githubActionInputs,
  dangerouslySkipPermissionsPassed,
  permissionMode,
  modeIsBypass,
  allowDangerouslySkipPermissionsPassed,
  systemPromptFlag,
  appendSystemPromptFlag,
  thinkingConfig,
  assistantActivationPath
}: {
  hasInitialPrompt: boolean;
  hasStdin: boolean;
  verbose: boolean;
  debug: boolean;
  debugToStderr: boolean;
  print: boolean;
  outputFormat: string;
  inputFormat: string;
  numAllowedTools: number;
  numDisallowedTools: number;
  mcpClientCount: number;
  worktreeEnabled: boolean;
  skipWebFetchPreflight: boolean | undefined;
  githubActionInputs: string | undefined;
  dangerouslySkipPermissionsPassed: boolean;
  permissionMode: string;
  modeIsBypass: boolean;
  allowDangerouslySkipPermissionsPassed: boolean;
  systemPromptFlag: 'file' | 'flag' | undefined;
  appendSystemPromptFlag: 'file' | 'flag' | undefined;
  thinkingConfig: ThinkingConfig;
  assistantActivationPath: string | undefined;
}): Promise<void> {
  try {
    logEvent('tengu_init', {
      entrypoint: 'claude' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      hasInitialPrompt,
      hasStdin,
      verbose,
      debug,
      debugToStderr,
      print,
      outputFormat: outputFormat as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      inputFormat: inputFormat as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      numAllowedTools,
      numDisallowedTools,
      mcpClientCount,
      worktree: worktreeEnabled,
      skipWebFetchPreflight,
      ...(githubActionInputs && {
        githubActionInputs: githubActionInputs as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      dangerouslySkipPermissionsPassed,
      permissionMode: permissionMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      modeIsBypass,
      inProtectedNamespace: isInProtectedNamespace(),
      allowDangerouslySkipPermissionsPassed,
      thinkingType: thinkingConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...(systemPromptFlag && {
        systemPromptFlag: systemPromptFlag as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      ...(appendSystemPromptFlag && {
        appendSystemPromptFlag: appendSystemPromptFlag as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      is_simple: isBareMode() || undefined,
      is_coordinator: feature('COORDINATOR_MODE') && coordinatorModeModule?.isCoordinatorMode() ? true : undefined,
      ...(assistantActivationPath && {
        assistantActivationPath: assistantActivationPath as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      autoUpdatesChannel: (getInitialSettings().autoUpdatesChannel ?? 'latest') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
  } catch (error) {
    logError(error);
  }
}
function maybeActivateProactive(options: unknown): void {
  if ((feature('PROACTIVE') || feature('KAIROS')) && ((options as {
    proactive?: boolean;
  }).proactive || isEnvTruthy(process.env.CLAUDE_CODE_PROACTIVE))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const proactiveModule = require('./proactive/index.js');
    if (!proactiveModule.isProactiveActive()) {
      proactiveModule.activateProactive('command');
    }
  }
}
function maybeActivateBrief(options: unknown): void {
  if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return;
  const briefFlag = (options as {
    brief?: boolean;
  }).brief;
  const briefEnv = isEnvTruthy(process.env.CLAUDE_CODE_BRIEF);
  if (!briefFlag && !briefEnv) return;
  // --brief / CLAUDE_CODE_BRIEF are explicit opt-ins: check entitlement,
  // then set userMsgOptIn to activate the tool + prompt section. The env
  // var also grants entitlement (isBriefEntitled() reads it), so setting
  // CLAUDE_CODE_BRIEF=1 alone force-enables for dev/testing — no GB gate
  // needed. initialIsBriefOnly reads getUserMsgOptIn() directly.
  // Conditional require: static import would leak the tool name string
  // into external builds via BriefTool.ts → prompt.ts.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const {
    isBriefEntitled
  } = require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const entitled = isBriefEntitled();
  if (entitled) {
    setUserMsgOptIn(true);
  }
  // Fire unconditionally once intent is seen: enabled=false captures the
  // "user tried but was gated" failure mode in Datadog.
  logEvent('tengu_brief_mode_enabled', {
    enabled: entitled,
    gated: !entitled,
    source: (briefEnv ? 'env' : 'flag') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
}
function resetCursor() {
  const terminal = process.stderr.isTTY ? process.stderr : process.stdout.isTTY ? process.stdout : undefined;
  terminal?.write(SHOW_CURSOR);
}
type TeammateOptions = {
  agentId?: string;
  agentName?: string;
  teamName?: string;
  agentColor?: string;
  planModeRequired?: boolean;
  parentSessionId?: string;
  teammateMode?: 'auto' | 'tmux' | 'in-process';
  agentType?: string;
};
function extractTeammateOptions(options: unknown): TeammateOptions {
  if (typeof options !== 'object' || options === null) {
    return {};
  }
  const opts = options as Record<string, unknown>;
  const teammateMode = opts.teammateMode;
  return {
    agentId: typeof opts.agentId === 'string' ? opts.agentId : undefined,
    agentName: typeof opts.agentName === 'string' ? opts.agentName : undefined,
    teamName: typeof opts.teamName === 'string' ? opts.teamName : undefined,
    agentColor: typeof opts.agentColor === 'string' ? opts.agentColor : undefined,
    planModeRequired: typeof opts.planModeRequired === 'boolean' ? opts.planModeRequired : undefined,
    parentSessionId: typeof opts.parentSessionId === 'string' ? opts.parentSessionId : undefined,
    teammateMode: teammateMode === 'auto' || teammateMode === 'tmux' || teammateMode === 'in-process' ? teammateMode : undefined,
    agentType: typeof opts.agentType === 'string' ? opts.agentType : undefined
  };
}
