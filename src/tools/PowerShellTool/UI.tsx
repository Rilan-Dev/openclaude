import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import * as React from 'react';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint.js';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { PRODUCT_DISPLAY_NAME } from '../../constants/product.js';
import { OutputLine } from '../../components/shell/OutputLine.js';
import { ShellProgressMessage } from '../../components/shell/ShellProgressMessage.js';
import { ShellTimeDisplay } from '../../components/shell/ShellTimeDisplay.js';
import { Box, Text } from '../../ink.js';
import type { Tool } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import type { PowerShellProgress } from '../../types/tools.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { ThemeName } from '../../utils/theme.js';
import type { Out, PowerShellToolInput } from './PowerShellTool.js';

// Constants for command display
const MAX_COMMAND_DISPLAY_LINES = 2;
const MAX_COMMAND_DISPLAY_CHARS = 160;
export function renderToolUseMessage(input: Partial<PowerShellToolInput>, {
  verbose,
  theme: _theme
}: {
  verbose: boolean;
  theme: ThemeName;
}): React.ReactNode {
  const {
    command
  } = input;
  if (!command) {
    return null;
  }
  const displayCommand = command;
  if (!verbose) {
    const lines = displayCommand.split('\n');
    const needsLineTruncation = lines.length > MAX_COMMAND_DISPLAY_LINES;
    const needsCharTruncation = displayCommand.length > MAX_COMMAND_DISPLAY_CHARS;
    if (needsLineTruncation || needsCharTruncation) {
      let truncated = displayCommand;
      if (needsLineTruncation) {
        truncated = lines.slice(0, MAX_COMMAND_DISPLAY_LINES).join('\n');
      }
      if (truncated.length > MAX_COMMAND_DISPLAY_CHARS) {
        truncated = truncated.slice(0, MAX_COMMAND_DISPLAY_CHARS);
      }
      return <Text>{truncated.trim()}…</Text>;
    }
  }
  return displayCommand;
}
export function renderToolUseProgressMessage(progressMessagesForMessage: ProgressMessage<PowerShellProgress>[], {
  verbose,
  tools: _tools,
  terminalSize: _terminalSize,
  inProgressToolCallCount: _inProgressToolCallCount
}: {
  tools: Tool[];
  verbose: boolean;
  terminalSize?: {
    columns: number;
    rows: number;
  };
  inProgressToolCallCount?: number;
}): React.ReactNode {
  const lastProgress = progressMessagesForMessage.at(-1);
  if (!lastProgress || !lastProgress.data) {
    if (isBrowserRuntime()) {
      return (
        <BrowserToolResultDisclosure title="Running PowerShell command" state="running">
          <div className="oc-agentProgressLine">Starting command execution.</div>
        </BrowserToolResultDisclosure>
      );
    }
    return <MessageResponse height={1}>
        <Text dimColor>Running…</Text>
      </MessageResponse>;
  }
  const data = lastProgress.data;
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure
        title="Running PowerShell command"
        detail={data.totalLines ? `${data.totalLines} lines` : undefined}
        state="running"
      >
        <div className="oc-toolResultPreview oc-toolResultPreview--powershell">
          <div className="oc-toolResultPreviewBody">
            <pre>{data.output || data.fullOutput || 'Waiting for output...'}</pre>
          </div>
        </div>
      </BrowserToolResultDisclosure>
    );
  }
  return <ShellProgressMessage fullOutput={data.fullOutput} output={data.output} elapsedTimeSeconds={data.elapsedTimeSeconds} totalLines={data.totalLines} totalBytes={data.totalBytes} timeoutMs={data.timeoutMs} taskId={data.taskId} verbose={verbose} />;
}
export function renderToolUseQueuedMessage(): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="PowerShell command queued" state="queued">
        <div className="oc-agentProgressLine">Waiting for execution capacity.</div>
      </BrowserToolResultDisclosure>
    );
  }
  return <MessageResponse height={1}>
      <Text dimColor>Waiting…</Text>
    </MessageResponse>;
}
export function renderToolResultMessage(content: Out, progressMessagesForMessage: ProgressMessage<PowerShellProgress>[], {
  verbose,
  theme: _theme,
  tools: _tools,
  style: _style
}: {
  verbose: boolean;
  theme: ThemeName;
  tools: Tool[];
  style?: 'condensed';
}): React.ReactNode {
  const lastProgress = progressMessagesForMessage.at(-1);
  const timeoutMs = lastProgress?.data?.timeoutMs;
  const {
    stdout,
    stderr,
    interrupted,
    returnCodeInterpretation,
    isImage,
    backgroundTaskId
  } = content;
  if (isImage) {
    if (isBrowserRuntime()) {
      return (
        <BrowserToolResultDisclosure title="PowerShell output" detail="Image detected">
          <div className="oc-toolResultPreviewEmpty">Image data was detected and sent to {PRODUCT_DISPLAY_NAME}.</div>
        </BrowserToolResultDisclosure>
      );
    }
    return <MessageResponse height={1}>
        <Text dimColor>[Image data detected and sent to {PRODUCT_DISPLAY_NAME}]</Text>
      </MessageResponse>;
  }
  if (isBrowserRuntime()) {
    const output = [stdout, stderr.trim()].filter(Boolean).join('\n');
    return (
      <BrowserToolResultDisclosure
        title="PowerShell command"
        detail={backgroundTaskId ? 'Running in background' : interrupted ? 'Interrupted' : returnCodeInterpretation || undefined}
        state={backgroundTaskId ? 'running' : 'done'}
      >
        {output ? (
          <div className="oc-toolResultPreview oc-toolResultPreview--powershell">
            <div className="oc-toolResultPreviewBody">
              <pre>{output}</pre>
            </div>
          </div>
        ) : (
          <div className="oc-toolResultPreviewEmpty">
            {backgroundTaskId ? 'The command is running in the background.' : interrupted ? 'Command interrupted.' : returnCodeInterpretation || 'No output returned.'}
          </div>
        )}
        {timeoutMs ? <div className="oc-toolResultPreviewTruncated">Command timed out after {timeoutMs}ms.</div> : null}
      </BrowserToolResultDisclosure>
    );
  }
  return <Box flexDirection="column">
      {stdout !== '' ? <OutputLine content={stdout} verbose={verbose} /> : null}
      {stderr.trim() !== '' ? <OutputLine content={stderr} verbose={verbose} isError /> : null}
      {stdout === '' && stderr.trim() === '' ? <MessageResponse height={1}>
          <Text dimColor>
            {backgroundTaskId ? <>
                Running in the background{' '}
                <KeyboardShortcutHint shortcut="↓" action="manage" parens />
              </> : interrupted ? 'Interrupted' : returnCodeInterpretation || '(No output)'}
          </Text>
        </MessageResponse> : null}
      {timeoutMs ? <MessageResponse>
          <ShellTimeDisplay timeoutMs={timeoutMs} />
        </MessageResponse> : null}
    </Box>;
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  verbose,
  progressMessagesForMessage: _progressMessagesForMessage,
  tools: _tools
}: {
  verbose: boolean;
  progressMessagesForMessage: ProgressMessage<PowerShellProgress>[];
  tools: Tool[];
}): React.ReactNode {
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
}
