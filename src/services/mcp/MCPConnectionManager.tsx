import { c as _c } from "react-compiler-runtime";
import React, { createContext, type ReactNode, useContext } from 'react';
import type { Command } from '../../commands.js';
import { useAppStateMaybeOutsideOfProvider } from '../../state/AppState.js';
import type { Tool } from '../../Tool.js';
import { isBrowserRuntime } from '../../utils/imports.js';
import type { MCPServerConnection, ScopedMcpServerConfig, ServerResource } from './types.js';
import { useManageMCPConnections } from './useManageMCPConnections.js';
interface MCPConnectionContextValue {
  reconnectMcpServer: (serverName: string) => Promise<{
    client: MCPServerConnection;
    tools: Tool[];
    commands: Command[];
    resources?: ServerResource[];
  }>;
  toggleMcpServer: (serverName: string) => Promise<void>;
}
const MCPConnectionContext = createContext<MCPConnectionContextValue | null>(null);
export function useMcpReconnect() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error("useMcpReconnect must be used within MCPConnectionManager");
  }
  return context.reconnectMcpServer;
}
export function useMcpToggleEnabled() {
  const context = useContext(MCPConnectionContext);
  if (!context) {
    throw new Error("useMcpToggleEnabled must be used within MCPConnectionManager");
  }
  return context.toggleMcpServer;
}
interface MCPConnectionManagerProps {
  children: ReactNode;
  dynamicMcpConfig: Record<string, ScopedMcpServerConfig> | undefined;
  isStrictMcpConfig: boolean;
}

// TODO (ollie): We may be able to get rid of this context by putting these function on app state
export function MCPConnectionManager(t0) {
  const $ = _c(7);
  const {
    children,
    dynamicMcpConfig,
    isStrictMcpConfig
  } = t0;
  const {
    reconnectMcpServer,
    toggleMcpServer
  } = useManageMCPConnections(dynamicMcpConfig, isStrictMcpConfig);
  const mcpState = useAppStateMaybeOutsideOfProvider(s => s.mcp);
  let t1;
  if ($[0] !== reconnectMcpServer || $[1] !== toggleMcpServer) {
    t1 = {
      reconnectMcpServer,
      toggleMcpServer
    };
    $[0] = reconnectMcpServer;
    $[1] = toggleMcpServer;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  const value = t1;
  const configuredCount = Object.keys(dynamicMcpConfig ?? {}).length;
  const connectedCount = mcpState?.clients.filter(client => client.type === 'connected').length ?? 0;
  const failedCount = mcpState?.clients.filter(client => client.type === 'failed').length ?? 0;
  const toolCount = mcpState?.tools.length ?? 0;
  const resourceCount = mcpState ? Object.values(mcpState.resources).reduce((total, resources) => total + resources.length, 0) : 0;
  const browserPanel =
    isBrowserRuntime() && failedCount > 0
      ? <WebMcpConnectionPanel configuredCount={configuredCount} connectedCount={connectedCount} failedCount={failedCount} toolCount={toolCount} resourceCount={resourceCount} strict={isStrictMcpConfig} />
      : null;
  let t2;
  if ($[3] !== browserPanel || $[4] !== children || $[5] !== value) {
    t2 = <MCPConnectionContext.Provider value={value}>{browserPanel}{children}</MCPConnectionContext.Provider>;
    $[3] = browserPanel;
    $[4] = children;
    $[5] = value;
    $[6] = t2;
  } else {
    t2 = $[6];
  }
  return t2;
}

function WebMcpConnectionPanel({
  configuredCount,
  connectedCount,
  failedCount,
  toolCount,
  resourceCount,
  strict,
}: {
  configuredCount: number;
  connectedCount: number;
  failedCount: number;
  toolCount: number;
  resourceCount: number;
  strict: boolean;
}) {
  const status = failedCount > 0 ? 'degraded' : connectedCount > 0 ? 'connected' : configuredCount > 0 ? 'connecting' : 'idle';
  const statusLabel =
    status === 'degraded'
      ? `${failedCount} server${failedCount === 1 ? '' : 's'} need attention`
      : status === 'connected'
        ? `${connectedCount} server${connectedCount === 1 ? '' : 's'} online`
        : status === 'connecting'
          ? 'Preparing MCP servers'
          : 'No MCP servers configured';

  return (
    <section className="repl-mcpStatusPanel" data-status={status} aria-label="MCP connection status">
      <div className="repl-mcpStatusAura" />
      <div className="repl-mcpStatusHeader">
        <span className="repl-mcpStatusKicker">MCP mesh</span>
        <strong>{statusLabel}</strong>
      </div>
      <div className="repl-mcpStatusGrid">
        <McpMetric label="Configured" value={configuredCount} />
        <McpMetric label="Connected" value={connectedCount} />
        <McpMetric label="Tools" value={toolCount} />
        <McpMetric label="Resources" value={resourceCount} />
      </div>
      <div className="repl-mcpStatusFooter">
        <span>{strict ? 'Strict config' : 'Merged config'}</span>
        <span>{failedCount > 0 ? 'Review /mcp' : 'Ready for tool routing'}</span>
      </div>
    </section>
  );
}

function McpMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="repl-mcpMetric">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}
