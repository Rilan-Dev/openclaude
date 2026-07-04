import React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js';
import { Box, Text } from '../../ink.js';
import type { ToolProgressData } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import { formatFileSize, truncate } from '../../utils/format.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { Output } from './WebFetchTool.js';
export function renderToolUseMessage({
  url,
  prompt
}: Partial<{
  url: string;
  prompt: string;
}>, {
  verbose
}: {
  theme?: string;
  verbose: boolean;
}): React.ReactNode {
  if (!url) {
    return null;
  }
  if (verbose) {
    return `url: "${url}"${verbose && prompt ? `, prompt: "${prompt}"` : ''}`;
  }
  return url;
}
export function renderToolUseProgressMessage(): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <details className="oc-toolDisclosure oc-toolDisclosure--fetch" data-tool-state="running" open>
        <summary className="oc-toolDisclosureSummary">
          <span className="oc-toolDisclosureStatus" />
          <span className="oc-toolDisclosureTitle">Fetching page</span>
          <span className="oc-toolDisclosureMeta">Waiting for response</span>
        </summary>
      </details>
    );
  }
  return <MessageResponse height={1}>
      <Text dimColor>Fetching…</Text>
    </MessageResponse>;
}
export function renderToolResultMessage({
  bytes,
  code,
  codeText,
  result,
  url
}: Output, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  const formattedSize = formatFileSize(bytes);
  const status = `${code} ${codeText}`;
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : 'page';
  if (isBrowserRuntime()) {
    return (
      <details className="oc-toolDisclosure oc-toolDisclosure--fetch">
        <summary className="oc-toolDisclosureSummary">
          <span className="oc-toolDisclosureStatus" />
          <span className="oc-toolDisclosureTitle">Fetched {host}</span>
          <span className="oc-toolDisclosureMeta">{formattedSize} · HTTP {status}</span>
        </summary>
        <div className="oc-toolDisclosureBody">
          <div className="oc-toolFetchReceipt">
            <span>Received content from</span>
            <strong>{host}</strong>
            <strong>{formattedSize}</strong>
            <span>HTTP {status}</span>
          </div>
          {verbose ? (
            <div className="oc-toolResultPreview oc-toolResultPreview--fetch">
              <div className="oc-toolResultPreviewBody">
                <pre>{result}</pre>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    );
  }
  if (verbose) {
    return <Box flexDirection="column">
        <MessageResponse height={1}>
          <Text>
            Received <Text bold>{formattedSize}</Text> ({code} {codeText})
          </Text>
        </MessageResponse>
        <Box flexDirection="column">
          <Text>{result}</Text>
        </Box>
      </Box>;
  }
  return <MessageResponse height={1}>
      <Text>
        Received <Text bold>{formattedSize}</Text> ({code} {codeText})
      </Text>
    </MessageResponse>;
}
export function getToolUseSummary(input: Partial<{
  url: string;
  prompt: string;
}> | undefined): string | null {
  if (!input?.url) {
    return null;
  }
  return truncate(input.url, TOOL_SUMMARY_MAX_LENGTH);
}
