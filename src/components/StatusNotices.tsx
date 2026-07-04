import * as React from 'react';
import { Box } from '../ink.js';
import { useAppState } from '../state/AppState.js';
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir.js';
import type { MemoryFileInfo } from '../utils/claudemd.js';
import { getMemoryFiles } from '../utils/claudemd.js';
import { getGlobalConfig } from '../utils/config.js';
import { getActiveNotices, type StatusNoticeContext } from '../utils/statusNoticeDefinitions.js';
import { assembleToolPool } from '../tools.js';
import { checkLocalModelContextLoad, isActiveProviderLocalModel, type LocalModelContextWarning } from '../utils/statusNoticeLocalModel.js';
import { isBrowserRuntime } from '../utils/runtime.js';
import { isDefaultMode, permissionModeTitle } from '../utils/permissions/PermissionMode.js';
type Props = {
  agentDefinitions?: AgentDefinitionsResult;
};

let cachedMemoryFiles: MemoryFileInfo[] = [];
let memoryFilesPromise: Promise<void> | null = null;

async function loadMemoryFiles(): Promise<void> {
  if (memoryFilesPromise) {
    return memoryFilesPromise;
  }
  const promise = getMemoryFiles().then(files => {
    cachedMemoryFiles = files;
  }).finally(() => {
    memoryFilesPromise = null;
  });
  memoryFilesPromise = promise;
  return promise;
}

/**
 * StatusNotices contains the information displayed to users at startup. We have
 * moved neutral or positive status to src/components/Status.tsx instead, which
 * users can access through /status.
 */
export function StatusNotices({
  agentDefinitions,
}: Props = {}) {
  const mcpTools = useAppState(s => s.mcp.tools);
  const toolPermissionContext = useAppState(s => s.toolPermissionContext);
  const tools = React.useMemo(() => assembleToolPool(toolPermissionContext, mcpTools), [toolPermissionContext, mcpTools]);
  const [memoryFiles, setMemoryFiles] = React.useState(cachedMemoryFiles);
  const [localModelContextLoad, setLocalModelContextLoad] = React.useState<LocalModelContextWarning | null | undefined>(undefined);
  const isLocalModel = isActiveProviderLocalModel();
  const mainLoopModel = useAppState(s => s.mainLoopModel);
  React.useEffect(() => {
    if (cachedMemoryFiles.length > 0) {
      setMemoryFiles(cachedMemoryFiles);
      return;
    }
    void loadMemoryFiles().then(() => {
      setMemoryFiles(cachedMemoryFiles);
    });
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    if (!isLocalModel) {
      setLocalModelContextLoad(null);
      return;
    }
    void checkLocalModelContextLoad(
      tools,
      agentDefinitions,
      memoryFiles,
      async () => toolPermissionContext,
      undefined,
      mainLoopModel ?? undefined,
    ).then(warning => {
      if (!cancelled) {
        setLocalModelContextLoad(warning);
      }
    }).catch(() => {
      if (!cancelled) {
        setLocalModelContextLoad(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [agentDefinitions, isLocalModel, mainLoopModel, memoryFiles, toolPermissionContext, tools]);
  const t2 = getGlobalConfig();
  const permissionMode = useAppState(s => s.toolPermissionContext.mode);
  const context: StatusNoticeContext = {
    config: t2,
    agentDefinitions,
    memoryFiles,
    isLocalModel,
    localModelContextLoad,
    permissionMode,
    mainLoopModel: mainLoopModel ?? undefined,
  };
  const activeNotices = getActiveNotices(context);
  if (activeNotices.length === 0) {
    return null;
  }

  if (isBrowserRuntime()) {
    const browserSuppressedNoticeIds = new Set([
      'third-party-permissive-mode',
    ]);
    const visibleNotices = activeNotices.filter(notice => !browserSuppressedNoticeIds.has(notice.id));
    if (visibleNotices.length === 0) {
      return null;
    }

    const noticeCount = visibleNotices.length;
    const hasWarning = visibleNotices.some(notice => notice.type === 'warning');
    const permissionMode = context.permissionMode;
    const modeLabel = permissionMode && !isDefaultMode(permissionMode)
      ? permissionModeTitle(permissionMode)
      : 'Default';
    const detail = noticeCount === 1
        ? 'Session notice'
        : `${noticeCount} session notices`;

    return (
      <div className="oc-statusNoticeDock" data-warning={hasWarning ? 'true' : undefined}>
        <span className="oc-statusNoticeDot" />
        <span className="oc-statusNoticeMode">{modeLabel}</span>
        <span className="oc-statusNoticeDetail">{detail}</span>
      </div>
    );
  }

  return <Box flexDirection="column" paddingLeft={1}>
      {activeNotices.map(notice => <React.Fragment key={notice.id}>{notice.render(context)}</React.Fragment>)}
    </Box>;
}
