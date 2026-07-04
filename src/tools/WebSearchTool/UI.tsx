import React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js';
import { Box, Text } from '../../ink.js';
import type { ProgressMessage } from '../../types/message.js';
import { truncate } from '../../utils/format.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { Output, SearchResult, WebSearchProgress } from './WebSearchTool.js';
function getSearchSummary(results: (SearchResult | string | null | undefined)[]): {
  searchCount: number;
  totalResultCount: number;
} {
  let searchCount = 0;
  let totalResultCount = 0;
  for (const result of results) {
    if (result != null && typeof result !== 'string') {
      searchCount++;
      totalResultCount += result.content?.length ?? 0;
    }
  }
  return {
    searchCount,
    totalResultCount
  };
}

function BrowserSearchProgress({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}): React.ReactNode {
  return (
    <details className="oc-toolDisclosure oc-toolDisclosure--search" data-tool-state="running" open>
      <summary className="oc-toolDisclosureSummary">
        <span className="oc-toolDisclosureStatus" />
        <span className="oc-toolDisclosureTitle">{title}</span>
        {detail ? <span className="oc-toolDisclosureMeta">{detail}</span> : null}
      </summary>
    </details>
  );
}

function BrowserSearchResult({
  output,
}: {
  output: Output;
}): React.ReactNode {
  const { searchCount, totalResultCount } = getSearchSummary(output.results ?? []);
  const timeDisplay = output.durationSeconds >= 1 ? `${Math.round(output.durationSeconds)}s` : `${Math.round(output.durationSeconds * 1000)}ms`;
  const resultGroups = (output.results ?? []).filter((result): result is SearchResult => result != null && typeof result !== 'string');
  const textResults = (output.results ?? []).filter((result): result is string => typeof result === 'string' && result.trim().length > 0);
  const query = output.query?.trim() || 'Web search';

  return (
    <details className="oc-toolDisclosure oc-toolDisclosure--search">
      <summary className="oc-toolDisclosureSummary">
        <span className="oc-toolDisclosureStatus" />
        <span className="oc-toolDisclosureTitle">Searched the web</span>
        <span className="oc-toolDisclosureMeta">
          {query} · {searchCount} {searchCount === 1 ? 'search' : 'searches'} · {totalResultCount} results · {timeDisplay}
        </span>
      </summary>
      <div className="oc-toolDisclosureBody">
        {resultGroups.length > 0 ? (
          <div className="oc-webSearchGroups">
            {resultGroups.map((result, groupIndex) => (
              <div className="oc-webSearchGroup" key={`search-${groupIndex}`}>
                <div className="oc-webSearchQuery">
                  <span>{groupIndex === 0 ? query : `Follow-up search ${groupIndex + 1}`}</span>
                  <span>{result.content?.length ?? 0} results</span>
                </div>
                <div className="oc-webSearchHits">
                  {(result.content ?? []).map((item, itemIndex) => (
                    <a className="oc-webSearchHit" href={item.url} key={`${item.url}-${itemIndex}`} rel="noreferrer" target="_blank">
                      <span className="oc-webSearchHitTitle">{item.title || item.url}</span>
                      <span className="oc-webSearchHitUrl">{item.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {textResults.length > 0 ? (
          <div className="oc-webSearchTextResults">
            {textResults.map((result, index) => (
              <pre key={`text-${index}`}>{result}</pre>
            ))}
          </div>
        ) : null}
        {resultGroups.length === 0 && textResults.length === 0 ? (
          <div className="oc-toolResultPreviewEmpty">No web results returned.</div>
        ) : null}
      </div>
    </details>
  );
}
export function renderToolUseMessage({
  query,
  allowed_domains,
  blocked_domains
}: Partial<{
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}>, {
  verbose
}: {
  verbose: boolean;
}): React.ReactNode {
  if (!query) {
    return null;
  }
  let message = '';
  if (query) {
    message += `"${query}"`;
  }
  if (verbose) {
    if (allowed_domains && allowed_domains.length > 0) {
      message += `, only allowing domains: ${allowed_domains.join(', ')}`;
    }
    if (blocked_domains && blocked_domains.length > 0) {
      message += `, blocking domains: ${blocked_domains.join(', ')}`;
    }
  }
  return message;
}
export function renderToolUseProgressMessage(progressMessages: ProgressMessage<WebSearchProgress>[]): React.ReactNode {
  if (progressMessages.length === 0) {
    return null;
  }
  const lastProgress = progressMessages[progressMessages.length - 1];
  if (!lastProgress?.data) {
    return null;
  }
  const data = lastProgress.data;
  switch (data.type) {
    case 'query_update':
      if (isBrowserRuntime()) {
        return <BrowserSearchProgress title="Searching the web" detail={data.query} />;
      }
      return <MessageResponse>
          <Text dimColor>Searching: {data.query}</Text>
        </MessageResponse>;
    case 'search_results_received':
      if (isBrowserRuntime()) {
        return <BrowserSearchProgress title="Found search results" detail={`${data.resultCount} results for "${data.query}"`} />;
      }
      return <MessageResponse>
          <Text dimColor>
            Found {data.resultCount} results for &quot;{data.query}&quot;
          </Text>
        </MessageResponse>;
    default:
      return null;
  }
}
export function renderToolResultMessage(output: Output): React.ReactNode {
  if (isBrowserRuntime()) {
    return <BrowserSearchResult output={output} />;
  }
  const {
    searchCount
  } = getSearchSummary(output.results ?? []);
  const timeDisplay = output.durationSeconds >= 1 ? `${Math.round(output.durationSeconds)}s` : `${Math.round(output.durationSeconds * 1000)}ms`;
  return <Box justifyContent="space-between" width="100%">
      <MessageResponse height={1}>
        <Text>
          Did {searchCount} search
          {searchCount !== 1 ? 'es' : ''} in {timeDisplay}
        </Text>
      </MessageResponse>
    </Box>;
}
export function getToolUseSummary(input: Partial<{
  query: string;
}> | undefined): string | null {
  if (!input?.query) {
    return null;
  }
  return truncate(input.query, TOOL_SUMMARY_MAX_LENGTH);
}
