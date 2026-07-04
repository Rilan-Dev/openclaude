import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import * as React from 'react';
import { extractTag } from 'src/utils/messages.js';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js';
import { FilePathLink } from '../../components/FilePathLink.js';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import { FILE_NOT_FOUND_CWD_NOTE, getDisplayPath } from '../../utils/file.js';
import { formatFileSize } from '../../utils/format.js';
import { getPlansDirectory } from '../../utils/plans.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import { getTaskOutputDir } from '../../utils/task/diskOutput.js';
import type { Input, Output } from './FileReadTool.js';

const BROWSER_READ_PREVIEW_CHAR_LIMIT = 120_000;

function formatReadPreviewContent(content: string, startLine: number): {
  content: string;
  isTruncated: boolean;
} {
  const visibleContent = content.length > BROWSER_READ_PREVIEW_CHAR_LIMIT ? content.slice(0, BROWSER_READ_PREVIEW_CHAR_LIMIT) : content;
  const lineCount = visibleContent.split('\n').length;
  const lineNumberWidth = String(startLine + Math.max(lineCount - 1, 0)).length;
  const numberedContent = visibleContent.split('\n').map((line, index) => {
    const lineNumber = String(startLine + index).padStart(lineNumberWidth, ' ');
    return `${lineNumber}  ${line}`;
  }).join('\n');

  return {
    content: numberedContent,
    isTruncated: visibleContent.length < content.length,
  };
}

function BrowserReadPreview({
  filePath,
  content,
  numLines,
  startLine,
  totalLines,
}: {
  filePath: string;
  content: string;
  numLines: number;
  startLine: number;
  totalLines: number;
}): React.ReactNode {
  const preview = formatReadPreviewContent(content, startLine);
  const lineRange = numLines > 0 ? `lines ${startLine}-${startLine + numLines - 1}` : '0 lines';

  return (
    <details className="oc-toolDisclosure oc-toolDisclosure--read" open>
      <summary className="oc-toolDisclosureSummary">
        <span className="oc-toolDisclosureStatus" />
        <span className="oc-toolDisclosureTitle">Read {getDisplayPath(filePath)}</span>
        <span className="oc-toolDisclosureMeta">{lineRange}</span>
      </summary>
      <div className="oc-toolDisclosureBody">
        <div className="oc-toolResultPreview oc-toolResultPreview--read">
          <div className="oc-toolResultPreviewHeader" aria-hidden="true">
            <div className="oc-toolResultPreviewKicker">Read preview</div>
            <div className="oc-toolResultPreviewMeta">
              <span>{lineRange}</span>
              <span>{totalLines} total</span>
            </div>
          </div>
          <div className="oc-toolResultPreviewBody">
            {content ? (
              <pre>{preview.content}</pre>
            ) : (
              <div className="oc-toolResultPreviewEmpty">The file exists, but this range returned no readable content.</div>
            )}
          </div>
          {preview.isTruncated ? (
            <div className="oc-toolResultPreviewTruncated">Preview truncated for browser performance. The full content is still available to the model.</div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function BrowserReadSummary({
  title,
  detail,
  body,
}: {
  title: string;
  detail?: string;
  body?: string;
}): React.ReactNode {
  return (
    <details className="oc-toolDisclosure oc-toolDisclosure--read">
      <summary className="oc-toolDisclosureSummary">
        <span className="oc-toolDisclosureStatus" />
        <span className="oc-toolDisclosureTitle">{title}</span>
        {detail ? <span className="oc-toolDisclosureMeta">{detail}</span> : null}
      </summary>
      <div className="oc-toolDisclosureBody">
        <div className="oc-toolReadReceipt">{body ?? detail ?? title}</div>
      </div>
    </details>
  );
}

/**
 * Check if a file path is an agent output file and extract the task ID.
 * Agent output files follow the pattern: {projectTempDir}/tasks/{taskId}.output
 */
function getAgentOutputTaskId(filePath: string): string | null {
  const prefix = `${getTaskOutputDir()}/`;
  const suffix = '.output';
  if (filePath.startsWith(prefix) && filePath.endsWith(suffix)) {
    const taskId = filePath.slice(prefix.length, -suffix.length);
    // Validate it looks like a task ID (alphanumeric, reasonable length)
    if (taskId.length > 0 && taskId.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(taskId)) {
      return taskId;
    }
  }
  return null;
}
export function renderToolUseMessage({
  file_path,
  offset,
  limit,
  pages
}: Partial<Input>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!file_path) {
    return null;
  }

  // For agent output files, return empty string so no parentheses are shown
  // The task ID is displayed separately by AssistantToolUseMessage
  if (getAgentOutputTaskId(file_path)) {
    return '';
  }
  const displayPath = verbose ? file_path : getDisplayPath(file_path);
  if (pages) {
    return <>
        <FilePathLink filePath={file_path}>{displayPath}</FilePathLink>
        {` · pages ${pages}`}
      </>;
  }
  if (verbose && (offset || limit)) {
    const startLine = offset ?? 1;
    const lineRange = limit ? `lines ${startLine}-${startLine + limit - 1}` : `from line ${startLine}`;
    return <>
        <FilePathLink filePath={file_path}>{displayPath}</FilePathLink>
        {` · ${lineRange}`}
      </>;
  }
  return <FilePathLink filePath={file_path}>{displayPath}</FilePathLink>;
}
export function renderToolUseTag({
  file_path
}: Partial<Input>): React.ReactNode {
  const agentTaskId = file_path ? getAgentOutputTaskId(file_path) : null;

  // Show agent task ID for Read tool when reading agent output
  if (!agentTaskId) {
    return null;
  }
  return <Text dimColor> {agentTaskId}</Text>;
}
export function renderToolResultMessage(output: Output): React.ReactNode {
  // TODO: Render recursively
  switch (output.type) {
    case 'image':
      {
        const {
          originalSize
        } = output.file;
        const formattedSize = formatFileSize(originalSize);
        if (isBrowserRuntime()) {
          return <BrowserReadSummary title="Read image" detail={formattedSize} body={`Image loaded · ${formattedSize}`} />;
        }
        return <MessageResponse height={1}>
          <Text>Read image ({formattedSize})</Text>
        </MessageResponse>;
      }
    case 'notebook':
      {
        const {
          cells
        } = output.file;
        if (!cells || cells.length < 1) {
          return <Text color="error">No cells found in notebook</Text>;
        }
        if (isBrowserRuntime()) {
          return <BrowserReadSummary title={`Read ${cells.length} ${cells.length === 1 ? 'cell' : 'cells'}`} body="Notebook cells loaded" />;
        }
        return <MessageResponse height={1}>
          <Text>
            Read <Text bold>{cells.length}</Text> cells
          </Text>
        </MessageResponse>;
      }
    case 'pdf':
      {
        const {
          originalSize
        } = output.file;
        const formattedSize = formatFileSize(originalSize);
        if (isBrowserRuntime()) {
          return <BrowserReadSummary title="Read PDF" detail={formattedSize} body={`PDF loaded · ${formattedSize}`} />;
        }
        return <MessageResponse height={1}>
          <Text>Read PDF ({formattedSize})</Text>
        </MessageResponse>;
      }
    case 'parts':
      {
        if (isBrowserRuntime()) {
          return <BrowserReadSummary title={`Read ${output.file.count} ${output.file.count === 1 ? 'file' : 'files'}`} detail={formatFileSize(output.file.originalSize)} body="File parts loaded and available to the model" />;
        }
        return <MessageResponse height={1}>
          <Text>
            Read <Text bold>{output.file.count}</Text>{' '}
            {output.file.count === 1 ? 'page' : 'pages'} (
            {formatFileSize(output.file.originalSize)})
          </Text>
        </MessageResponse>;
      }
    case 'text':
      {
        const {
          content,
          filePath,
          numLines,
          startLine,
          totalLines
        } = output.file;
        if (isBrowserRuntime()) {
          return <BrowserReadPreview filePath={filePath} content={content} numLines={numLines} startLine={startLine} totalLines={totalLines} />;
        }
        return <MessageResponse height={1}>
          <Text>
            Read <Text bold>{numLines}</Text>{' '}
            {numLines === 1 ? 'line' : 'lines'}
          </Text>
        </MessageResponse>;
      }
    case 'file_unchanged':
      {
        if (isBrowserRuntime()) {
          return <BrowserReadSummary title="Unchanged since last read" body="No new file content was loaded" />;
        }
        return <MessageResponse height={1}>
          <Text dimColor>Unchanged since last read</Text>
        </MessageResponse>;
      }
  }
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!verbose && typeof result === 'string') {
    // FileReadTool throws from call() so errors lack <tool_use_error> wrapping —
    // check the raw string directly for the cwd note marker.
    if (result.includes(FILE_NOT_FOUND_CWD_NOTE)) {
      if (isBrowserRuntime()) {
        return (
          <BrowserToolResultDisclosure title="Read failed" detail="File not found" state="error" defaultOpen>
            <div className="oc-toolResultError">{result}</div>
          </BrowserToolResultDisclosure>
        );
      }
      return <MessageResponse>
          <Text color="error">File not found</Text>
        </MessageResponse>;
    }
    if (extractTag(result, 'tool_use_error')) {
      if (isBrowserRuntime()) {
        return (
          <BrowserToolResultDisclosure title="Read failed" detail="Unable to read file" state="error" defaultOpen>
            <div className="oc-toolResultError">{extractTag(result, 'tool_use_error') ?? result}</div>
          </BrowserToolResultDisclosure>
        );
      }
      return <MessageResponse>
          <Text color="error">Error reading file</Text>
        </MessageResponse>;
    }
  }
  return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
}
export function userFacingName(input: Partial<Input> | undefined): string {
  if (input?.file_path?.startsWith(getPlansDirectory())) {
    return 'Reading Plan';
  }
  if (input?.file_path && getAgentOutputTaskId(input.file_path)) {
    return 'Read agent output';
  }
  return 'Read';
}
export function getToolUseSummary(input: Partial<Input> | undefined): string | null {
  if (!input?.file_path) {
    return null;
  }
  // For agent output files, just show the task ID
  const agentTaskId = getAgentOutputTaskId(input.file_path);
  if (agentTaskId) {
    return agentTaskId;
  }
  return getDisplayPath(input.file_path);
}
