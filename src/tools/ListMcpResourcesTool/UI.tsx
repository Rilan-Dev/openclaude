import * as React from 'react';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { OutputLine } from '../../components/shell/OutputLine.js';
import { Text } from '../../ink.js';
import type { ToolProgressData } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import { jsonStringify } from '../../utils/slowOperations.js';
import type { Output } from './ListMcpResourcesTool.js';
export function renderToolUseMessage(input: Partial<{
  server?: string;
}>): React.ReactNode {
  return input.server ? `List MCP resources from server "${input.server}"` : `List all MCP resources`;
}
export function renderToolResultMessage(output: Output, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!output || output.length === 0) {
    if (isBrowserRuntime()) {
      return (
        <BrowserToolResultDisclosure title="Listed MCP resources" detail="No resources found" state="done">
          <div className="oc-toolResultEmpty">No MCP resources are available for this request.</div>
        </BrowserToolResultDisclosure>
      );
    }
    return <MessageResponse height={1}>
        <Text dimColor>(No resources found)</Text>
      </MessageResponse>;
  }

  // eslint-disable-next-line no-restricted-syntax -- human-facing UI, not tool_result
  const formattedOutput = jsonStringify(output, null, 2);
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Listed MCP resources" detail={`${output.length} ${output.length === 1 ? 'resource' : 'resources'}`} state="done">
        <pre className="oc-toolCodeBlock">{formattedOutput}</pre>
      </BrowserToolResultDisclosure>
    );
  }
  return <OutputLine content={formattedOutput} verbose={verbose} />;
}
