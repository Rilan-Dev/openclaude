import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import React from 'react';
import { CtrlOToExpand } from '../../components/CtrlOToExpand.js';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js';
import { Box, Text } from '../../ink.js';
import type { ToolProgressData } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import { FILE_NOT_FOUND_CWD_NOTE, getDisplayPath } from '../../utils/file.js';
import { truncate } from '../../utils/format.js';
import { extractTag } from '../../utils/messages.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

const BROWSER_SEARCH_PREVIEW_CHAR_LIMIT = 120_000;

function formatResultLabel(count: number, label: string): string {
  return count === 1 ? label.slice(0, -1) : label;
}

function getPreviewContent(content: string | undefined): {
  content: string;
  isTruncated: boolean;
} {
  if (!content) {
    return { content: '', isTruncated: false };
  }
  const visibleContent = content.length > BROWSER_SEARCH_PREVIEW_CHAR_LIMIT ? content.slice(0, BROWSER_SEARCH_PREVIEW_CHAR_LIMIT) : content;
  return {
    content: visibleContent,
    isTruncated: visibleContent.length < content.length,
  };
}

function SearchResultSummary({
  count,
  countLabel,
  secondaryCount,
  secondaryLabel,
  content,
  verbose,
}: {
  count: number;
  countLabel: string;
  secondaryCount?: number;
  secondaryLabel?: string;
  content?: string;
  verbose: boolean;
}) {
  const primarySummary = `Found ${count} ${formatResultLabel(count, countLabel)}`;
  const secondarySummary = secondaryCount !== undefined && secondaryLabel
    ? ` across ${secondaryCount} ${formatResultLabel(secondaryCount, secondaryLabel)}`
    : '';

  if (isBrowserRuntime()) {
    const preview = getPreviewContent(content);
    return (
      <MessageResponse>
        <div className="oc-toolResultPreview oc-toolResultPreview--search" data-empty={count === 0 ? 'true' : undefined}>
          <div className="oc-toolResultPreviewHeader">
            <div>
              <div className="oc-toolResultPreviewKicker">Search</div>
              <div className="oc-toolResultPreviewTitle">{primarySummary}{secondarySummary}</div>
            </div>
          </div>
          <div className="oc-toolResultPreviewBody">
            {preview.content ? (
              <pre>{preview.content}</pre>
            ) : (
              <div className="oc-toolResultPreviewEmpty">No matching content returned for this search.</div>
            )}
          </div>
          {preview.isTruncated ? (
            <div className="oc-toolResultPreviewTruncated">Preview truncated for browser performance. Refine the search or open transcript mode for more context.</div>
          ) : null}
        </div>
      </MessageResponse>
    );
  }

  if (verbose) {
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text>
            <Text dimColor>  └  </Text>
            <Text>{primarySummary}</Text>
            <Text>{secondarySummary}</Text>
          </Text>
        </Box>
        <Box marginLeft={5}>
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <MessageResponse height={1}>
      <Text>{primarySummary}{secondarySummary} {count > 0 ? <CtrlOToExpand /> : null}</Text>
    </MessageResponse>
  );
}
type Output = {
  mode?: 'content' | 'files_with_matches' | 'count';
  numFiles: number;
  filenames: string[];
  content?: string;
  numLines?: number; // For content mode
  numMatches?: number; // For count mode
};
export function renderToolUseMessage({
  pattern,
  path
}: Partial<{
  pattern: string;
  path?: string;
}>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!pattern) {
    return null;
  }
  const parts = [`pattern: "${pattern}"`];
  if (path) {
    parts.push(`path: "${verbose ? path : getDisplayPath(path)}"`);
  }
  return parts.join(', ');
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!verbose && typeof result === 'string' && extractTag(result, 'tool_use_error')) {
    const errorMessage = extractTag(result, 'tool_use_error');
    if (errorMessage?.includes(FILE_NOT_FOUND_CWD_NOTE)) {
      return <MessageResponse>
          <Text color="error">File not found</Text>
        </MessageResponse>;
    }
    return <MessageResponse>
        <Text color="error">Error searching files</Text>
      </MessageResponse>;
  }
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
}
export function renderToolResultMessage({
  mode = 'files_with_matches',
  filenames,
  numFiles,
  content,
  numLines,
  numMatches
}: Output, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (mode === 'content') {
    return <SearchResultSummary count={numLines ?? 0} countLabel="lines" content={content} verbose={verbose} />;
  }
  if (mode === 'count') {
    return <SearchResultSummary count={numMatches ?? 0} countLabel="matches" secondaryCount={numFiles} secondaryLabel="files" content={content} verbose={verbose} />;
  }

  // files_with_matches mode
  const fileListContent = filenames.map(filename => filename).join('\n');
  return <SearchResultSummary count={numFiles} countLabel="files" content={fileListContent} verbose={verbose} />;
}
export function getToolUseSummary(input: Partial<{
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  head_limit?: number;
}> | undefined): string | null {
  if (!input?.pattern) {
    return null;
  }
  return truncate(input.pattern, TOOL_SUMMARY_MAX_LENGTH);
}
