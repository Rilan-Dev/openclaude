import { c as _c } from "react-compiler-runtime";
import { feature } from 'bun:bundle';
import * as React from 'react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type Notification, useNotifications } from 'src/context/notifications.js';
import { logEvent } from 'src/services/analytics/index.js';
import { useAppState } from 'src/state/AppState.js';
import { useVoiceState } from '../../context/voice.js';
import type { VerificationStatus } from '../../hooks/useApiKeyVerification.js';
import { useIdeConnectionStatus } from '../../hooks/useIdeConnectionStatus.js';
import type { IDESelection } from '../../hooks/useIdeSelection.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { useVoiceEnabled } from '../../hooks/useVoiceEnabled.js';
import { Box, Text } from '../../ink.js';
import { useClaudeAiLimits } from '../../services/claudeAiLimitsHook.js';
import { calculateTokenWarningState } from '../../services/compact/autoCompact.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import type { Message } from '../../types/message.js';
import { getApiKeyHelperElapsedMs, getConfiguredApiKeyHelper, getSubscriptionType } from '../../utils/auth.js';
import type { AutoUpdaterResult } from '../../utils/autoUpdater.js';
import { getExternalEditor } from '../../utils/editor.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { formatDuration } from '../../utils/format.js';
import { setEnvHookNotifier } from '../../utils/hooks/fileChangedWatcher.js';
import { toIDEDisplayName } from '../../utils/ide.js';
import { isBrowserRuntime } from '../../utils/imports.js';
import { getMessagesAfterCompactBoundary } from '../../utils/messages.js';
import { tokenCountFromLastAPIResponse } from '../../utils/tokens.js';
import { AutoUpdaterWrapper } from '../AutoUpdaterWrapper.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { IdeStatusIndicator } from '../IdeStatusIndicator.js';
import { MemoryUsageIndicator } from '../MemoryUsageIndicator.js';
import { SentryErrorBoundary } from '../SentryErrorBoundary.js';
import { TokenWarning } from '../TokenWarning.js';
import { SandboxPromptFooterHint } from './SandboxPromptFooterHint.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const hasNodeRequire = typeof require === 'function';
const VoiceIndicator: typeof import('./VoiceIndicator.js').VoiceIndicator = feature('VOICE_MODE') && hasNodeRequire ? require('./VoiceIndicator.js').VoiceIndicator : () => null;
/* eslint-enable @typescript-eslint/no-require-imports */

export const FOOTER_TEMPORARY_STATUS_TIMEOUT = 5000;
type Props = {
  apiKeyStatus: VerificationStatus;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  debug: boolean;
  verbose: boolean;
  messages: Message[];
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  isInputWrapped?: boolean;
  isNarrow?: boolean;
};

type WebNotificationTone = 'default' | 'info' | 'success' | 'warning' | 'error';

type WebNotificationItem = {
  key: string;
  label: string;
  detail?: string;
  tone?: WebNotificationTone;
};

function jsxToPlainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(jsxToPlainText).join('');
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: ReactNode; description?: string };
    return jsxToPlainText(props.children) || props.description || '';
  }
  return '';
}

function notificationToWebItem(notification: Notification): WebNotificationItem {
  const text = 'jsx' in notification
    ? jsxToPlainText(notification.jsx)
    : notification.text;
  const fallback = notification.key === 'external-editor-hint'
    ? 'External editor available'
    : 'Notification';
  let tone: WebNotificationTone = 'default';
  if ('text' in notification && notification.color) {
    tone = notification.color === 'error'
      ? 'error'
      : notification.color === 'warning'
        ? 'warning'
        : 'info';
  }

  return {
    key: notification.key,
    label: text.trim() || fallback,
    tone,
  };
}

function ideSelectionLabel(ideSelection: IDESelection | undefined): WebNotificationItem | null {
  if (!ideSelection) return null;
  if (ideSelection.text && ideSelection.lineCount > 0) {
    const suffix = ideSelection.lineCount === 1 ? 'line selected' : 'lines selected';
    return {
      key: 'ide-selection',
      label: `${ideSelection.lineCount} ${suffix}`,
      detail: 'IDE context',
      tone: 'info',
    };
  }
  if (ideSelection.filePath) {
    const fileName = ideSelection.filePath.split(/[\\/]/).pop() || ideSelection.filePath;
    return {
      key: 'ide-file',
      label: `In ${fileName}`,
      detail: 'IDE context',
      tone: 'info',
    };
  }
  return null;
}

export function Notifications(t0) {
  const $ = _c(34);
  const {
    apiKeyStatus,
    autoUpdaterResult,
    debug,
    isAutoUpdating,
    verbose,
    messages,
    onAutoUpdaterResult,
    onChangeIsUpdating,
    ideSelection,
    mcpClients,
    isInputWrapped: t1,
    isNarrow: t2
  } = t0;
  const isInputWrapped = t1 === undefined ? false : t1;
  const isNarrow = t2 === undefined ? false : t2;
  let t3;
  if ($[0] !== messages) {
    const messagesForTokenCount = getMessagesAfterCompactBoundary(messages);
    t3 = tokenCountFromLastAPIResponse(messagesForTokenCount);
    $[0] = messages;
    $[1] = t3;
  } else {
    t3 = $[1];
  }
  const tokenUsage = t3;
  const mainLoopModel = useMainLoopModel();
  let t4;
  if ($[2] !== mainLoopModel || $[3] !== tokenUsage) {
    t4 = calculateTokenWarningState(tokenUsage, mainLoopModel);
    $[2] = mainLoopModel;
    $[3] = tokenUsage;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  const isShowingCompactMessage = t4.isAboveWarningThreshold;
  const {
    status: ideStatus
  } = useIdeConnectionStatus(mcpClients);
  const notifications = useAppState(_temp);
  const {
    addNotification,
    removeNotification
  } = useNotifications();
  const claudeAiLimits = useClaudeAiLimits();
  let t5;
  let t6;
  if ($[5] !== addNotification) {
    t5 = () => {
      setEnvHookNotifier((text, isError) => {
        addNotification({
          key: "env-hook",
          text,
          color: isError ? "error" : undefined,
          priority: isError ? "medium" : "low",
          timeoutMs: isError ? 8000 : 5000
        });
      });
      return _temp2;
    };
    t6 = [addNotification];
    $[5] = addNotification;
    $[6] = t5;
    $[7] = t6;
  } else {
    t5 = $[6];
    t6 = $[7];
  }
  useEffect(t5, t6);
  const shouldShowIdeSelection = ideStatus === "connected" && (ideSelection?.filePath || ideSelection?.text && ideSelection.lineCount > 0);
  const shouldShowAutoUpdater = !shouldShowIdeSelection || isAutoUpdating || autoUpdaterResult?.status !== "success";
  const isInOverageMode = claudeAiLimits.isUsingOverage;
  let t7;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = getSubscriptionType();
    $[8] = t7;
  } else {
    t7 = $[8];
  }
  const subscriptionType = t7;
  const isTeamOrEnterprise = subscriptionType === "team" || subscriptionType === "enterprise";
  let t8;
  if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = getExternalEditor();
    $[9] = t8;
  } else {
    t8 = $[9];
  }
  const editor = t8;
  const shouldShowExternalEditorHint = isInputWrapped && !isShowingCompactMessage && apiKeyStatus !== "invalid" && apiKeyStatus !== "missing" && editor !== undefined;
  let t10;
  let t9;
  if ($[10] !== addNotification || $[11] !== removeNotification || $[12] !== shouldShowExternalEditorHint) {
    t9 = () => {
      if (shouldShowExternalEditorHint && editor) {
        logEvent("tengu_external_editor_hint_shown", {});
        addNotification({
          key: "external-editor-hint",
          jsx: <Text dimColor={true}><ConfigurableShortcutHint action="chat:externalEditor" context="Chat" fallback="ctrl+g" description={`edit in ${toIDEDisplayName(editor)}`} /></Text>,
          priority: "immediate",
          timeoutMs: 5000
        });
      } else {
        removeNotification("external-editor-hint");
      }
    };
    t10 = [shouldShowExternalEditorHint, editor, addNotification, removeNotification];
    $[10] = addNotification;
    $[11] = removeNotification;
    $[12] = shouldShowExternalEditorHint;
    $[13] = t10;
    $[14] = t9;
  } else {
    t10 = $[13];
    t9 = $[14];
  }
  useEffect(t9, t10);
  const t11 = isNarrow ? "flex-start" : "flex-end";
  const t12 = isInOverageMode ?? false;
  let t13;
  if ($[15] !== apiKeyStatus || $[16] !== autoUpdaterResult || $[17] !== debug || $[18] !== ideSelection || $[19] !== isAutoUpdating || $[20] !== isShowingCompactMessage || $[21] !== mainLoopModel || $[22] !== mcpClients || $[23] !== notifications || $[24] !== onAutoUpdaterResult || $[25] !== onChangeIsUpdating || $[26] !== shouldShowAutoUpdater || $[27] !== t12 || $[28] !== tokenUsage || $[29] !== verbose) {
    t13 = <NotificationContent ideSelection={ideSelection} mcpClients={mcpClients} notifications={notifications} isInOverageMode={t12} isTeamOrEnterprise={isTeamOrEnterprise} apiKeyStatus={apiKeyStatus} debug={debug} verbose={verbose} tokenUsage={tokenUsage} mainLoopModel={mainLoopModel} shouldShowAutoUpdater={shouldShowAutoUpdater} autoUpdaterResult={autoUpdaterResult} isAutoUpdating={isAutoUpdating} isShowingCompactMessage={isShowingCompactMessage} onAutoUpdaterResult={onAutoUpdaterResult} onChangeIsUpdating={onChangeIsUpdating} />;
    $[15] = apiKeyStatus;
    $[16] = autoUpdaterResult;
    $[17] = debug;
    $[18] = ideSelection;
    $[19] = isAutoUpdating;
    $[20] = isShowingCompactMessage;
    $[21] = mainLoopModel;
    $[22] = mcpClients;
    $[23] = notifications;
    $[24] = onAutoUpdaterResult;
    $[25] = onChangeIsUpdating;
    $[26] = shouldShowAutoUpdater;
    $[27] = t12;
    $[28] = tokenUsage;
    $[29] = verbose;
    $[30] = t13;
  } else {
    t13 = $[30];
  }
  let t14;
  if ($[31] !== t11 || $[32] !== t13) {
    t14 = <SentryErrorBoundary><Box flexDirection="column" alignItems={t11} flexShrink={0} overflowX="hidden">{t13}</Box></SentryErrorBoundary>;
    $[31] = t11;
    $[32] = t13;
    $[33] = t14;
  } else {
    t14 = $[33];
  }
  return t14;
}
function _temp2() {
  return setEnvHookNotifier(null);
}
function _temp(s) {
  return s.notifications;
}
function NotificationContent({
  ideSelection,
  mcpClients,
  notifications,
  isInOverageMode,
  isTeamOrEnterprise,
  apiKeyStatus,
  debug,
  verbose,
  tokenUsage,
  mainLoopModel,
  shouldShowAutoUpdater,
  autoUpdaterResult,
  isAutoUpdating,
  isShowingCompactMessage,
  onAutoUpdaterResult,
  onChangeIsUpdating
}: {
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  notifications: {
    current: Notification | null;
    queue: Notification[];
  };
  isInOverageMode: boolean;
  isTeamOrEnterprise: boolean;
  apiKeyStatus: VerificationStatus;
  debug: boolean;
  verbose: boolean;
  tokenUsage: number;
  mainLoopModel: string;
  shouldShowAutoUpdater: boolean;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  isShowingCompactMessage: boolean;
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
}): ReactNode {
  // Poll apiKeyHelper inflight state to show slow-helper notice.
  // Gated on configuration — most users never set apiKeyHelper, so the
  // effect is a no-op for them (no interval allocated).
  const [apiKeyHelperSlow, setApiKeyHelperSlow] = useState<string | null>(null);
  useEffect(() => {
    if (!getConfiguredApiKeyHelper()) return;
    const interval = setInterval((setSlow: React.Dispatch<React.SetStateAction<string | null>>) => {
      const ms = getApiKeyHelperElapsedMs();
      const next = ms >= 10_000 ? formatDuration(ms) : null;
      setSlow(prev => next === prev ? prev : next);
    }, 1000, setApiKeyHelperSlow);
    return () => clearInterval(interval);
  }, []);

  // Voice state (VOICE_MODE builds only, runtime-gated by GrowthBook)
  const voiceState = feature('VOICE_MODE') ?
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useVoiceState(s => s.voiceState) : 'idle' as const;
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false;
  const voiceError = feature('VOICE_MODE') ?
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useVoiceState(s_0 => s_0.voiceError) : null;
  const isBriefOnly = feature('KAIROS') || feature('KAIROS_BRIEF') ?
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useAppState(s_1 => s_1.isBriefOnly) : false;

  // When voice is actively recording or processing, replace all
  // notifications with just the voice indicator.
  if (feature('VOICE_MODE') && voiceEnabled && (voiceState === 'recording' || voiceState === 'processing')) {
    return <VoiceIndicator voiceState={voiceState} />;
  }

  if (isBrowserRuntime()) {
    return <WebNotificationContent
      ideSelection={ideSelection}
      notifications={notifications}
      isInOverageMode={isInOverageMode}
      isTeamOrEnterprise={isTeamOrEnterprise}
      apiKeyStatus={apiKeyStatus}
      debug={debug}
      verbose={verbose}
      tokenUsage={tokenUsage}
      mainLoopModel={mainLoopModel}
      shouldShowAutoUpdater={shouldShowAutoUpdater}
      autoUpdaterResult={autoUpdaterResult}
      isAutoUpdating={isAutoUpdating}
      apiKeyHelperSlow={apiKeyHelperSlow}
      voiceError={feature('VOICE_MODE') ? voiceError : null}
      isBriefOnly={isBriefOnly}
    />;
  }

  return <>
    <IdeStatusIndicator ideSelection={ideSelection} mcpClients={mcpClients} />
    {notifications.current && ('jsx' in notifications.current ? <Text wrap="truncate" key={notifications.current.key}>
      {notifications.current.jsx}
    </Text> : <Text color={notifications.current.color} dimColor={!notifications.current.color} wrap="truncate">
      {notifications.current.text}
    </Text>)}
    {isInOverageMode && !isTeamOrEnterprise && <Box>
      <Text dimColor wrap="truncate">
        Now using extra usage
      </Text>
    </Box>}
    {apiKeyHelperSlow && <Box>
      <Text color="warning" wrap="truncate">
        apiKeyHelper is taking a while{' '}
      </Text>
      <Text dimColor wrap="truncate">
        ({apiKeyHelperSlow})
      </Text>
    </Box>}
    {(apiKeyStatus === 'invalid' || apiKeyStatus === 'missing') && <Box>
      <Text color="error" wrap="truncate">
        {isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) ? 'Authentication error · Try again' : 'Not logged in · Run /login'}
      </Text>
    </Box>}
    {debug && <Box>
      <Text color="warning" wrap="truncate">
        Debug mode
      </Text>
    </Box>}
    {apiKeyStatus !== 'invalid' && apiKeyStatus !== 'missing' && verbose && <Box>
      <Text dimColor wrap="truncate">
        {tokenUsage} tokens
      </Text>
    </Box>}
    {!isBriefOnly && <TokenWarning tokenUsage={tokenUsage} model={mainLoopModel} />}
    {shouldShowAutoUpdater && <AutoUpdaterWrapper verbose={verbose} onAutoUpdaterResult={onAutoUpdaterResult} autoUpdaterResult={autoUpdaterResult} isUpdating={isAutoUpdating} onChangeIsUpdating={onChangeIsUpdating} showSuccessMessage={!isShowingCompactMessage} />}
    {feature('VOICE_MODE') ? voiceEnabled && voiceError && <Box>
      <Text color="error" wrap="truncate">
        {voiceError}
      </Text>
    </Box> : null}
    <MemoryUsageIndicator />
    <SandboxPromptFooterHint />
  </>;
}

function WebNotificationContent({
  ideSelection,
  notifications,
  isInOverageMode,
  isTeamOrEnterprise,
  apiKeyStatus,
  debug,
  verbose,
  tokenUsage,
  mainLoopModel,
  shouldShowAutoUpdater,
  autoUpdaterResult,
  isAutoUpdating,
  apiKeyHelperSlow,
  voiceError,
  isBriefOnly,
}: {
  ideSelection: IDESelection | undefined;
  notifications: {
    current: Notification | null;
    queue: Notification[];
  };
  isInOverageMode: boolean;
  isTeamOrEnterprise: boolean;
  apiKeyStatus: VerificationStatus;
  debug: boolean;
  verbose: boolean;
  tokenUsage: number;
  mainLoopModel: string;
  shouldShowAutoUpdater: boolean;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  apiKeyHelperSlow: string | null;
  voiceError: string | null;
  isBriefOnly: boolean;
}): ReactNode {
  const items: WebNotificationItem[] = [];
  const ideItem = ideSelectionLabel(ideSelection);

  if (ideItem) items.push(ideItem);
  if (notifications.current) items.push(notificationToWebItem(notifications.current));
  if (isInOverageMode && !isTeamOrEnterprise) {
    items.push({
      key: 'extra-usage',
      label: 'Using extra usage',
      detail: 'Billing',
      tone: 'warning',
    });
  }
  if (apiKeyHelperSlow) {
    items.push({
      key: 'api-key-helper-slow',
      label: `apiKeyHelper is taking a while`,
      detail: apiKeyHelperSlow,
      tone: 'warning',
    });
  }
  if (apiKeyStatus === 'invalid' || apiKeyStatus === 'missing') {
    items.push({
      key: 'auth-error',
      label: isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)
        ? 'Authentication error. Try again'
        : 'Not logged in. Run /login',
      tone: 'error',
    });
  }
  if (debug) {
    items.push({
      key: 'debug-mode',
      label: 'Debug mode',
      tone: 'warning',
    });
  }
  if (apiKeyStatus !== 'invalid' && apiKeyStatus !== 'missing' && verbose) {
    items.push({
      key: 'token-usage',
      label: `${tokenUsage} tokens`,
      detail: mainLoopModel,
      tone: 'default',
    });
  }

  if (!isBriefOnly) {
    const tokenWarning = calculateTokenWarningState(tokenUsage, mainLoopModel);
    if (tokenWarning.isAboveWarningThreshold) {
      items.push({
        key: 'token-warning',
        label: tokenWarning.isAboveErrorThreshold
          ? `Context low: ${tokenWarning.percentLeft}% remaining`
          : `${tokenWarning.percentLeft}% until auto-compact`,
        detail: tokenWarning.isAboveErrorThreshold ? 'Run /compact to continue safely' : undefined,
        tone: tokenWarning.isAboveErrorThreshold ? 'error' : 'warning',
      });
    }
  }

  if (shouldShowAutoUpdater && (isAutoUpdating || autoUpdaterResult)) {
    const status = isAutoUpdating
      ? 'Checking for update'
      : autoUpdaterResult?.status === 'success'
        ? 'OpenClaude is up to date'
        : autoUpdaterResult?.status === 'install_failed' || autoUpdaterResult?.status === 'no_permissions'
          ? 'Update check failed'
          : 'Update status ready';
    items.push({
      key: 'auto-updater',
      label: status,
      tone: autoUpdaterResult?.status === 'install_failed' || autoUpdaterResult?.status === 'no_permissions' ? 'warning' : 'success',
    });
  }

  if (voiceError) {
    items.push({
      key: 'voice-error',
      label: voiceError,
      tone: 'error',
    });
  }

  if (items.length === 0) {
    return null;
  }

  return <div className="repl-webNotifications" role="status" aria-live="polite">
    {items.slice(0, 4).map(item => (
      <div className="repl-webNotification" data-tone={item.tone ?? 'default'} key={item.key}>
        <span className="repl-webNotificationDot" aria-hidden="true" />
        <span className="repl-webNotificationText">
          <span className="repl-webNotificationLabel">{item.label}</span>
          {item.detail ? <span className="repl-webNotificationDetail">{item.detail}</span> : null}
        </span>
      </div>
    ))}
    {items.length > 4 ? (
      <div className="repl-webNotification repl-webNotificationMore" data-tone="default">
        +{items.length - 4}
      </div>
    ) : null}
  </div>;
}
