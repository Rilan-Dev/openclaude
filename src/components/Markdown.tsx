import { c as _c } from "react-compiler-runtime";
import { marked, type Token, type Tokens } from 'marked';
import React, { Suspense, use, useMemo, useRef } from 'react';
import { useSettings } from '../hooks/useSettings.js';
import { Ansi, Box, useTheme } from '../ink.js';
import { type CliHighlight, getCliHighlightPromise } from '../utils/cliHighlight.js';
import { hashContent } from '../utils/hash.js';
import { configureMarked, formatToken } from '../utils/markdown.js';
import { stripPromptXMLTags } from '../utils/messages.js';
import { isBrowserRuntime } from '../utils/runtime.js';
import { MarkdownTable } from './MarkdownTable.js';
type Props = {
  children: string;
  /** When true, render all text content as dim */
  dimColor?: boolean;
};

// Module-level token cache — marked.lexer is the hot cost on virtual-scroll
// remounts (~3ms per message). useMemo doesn't survive unmount→remount, so
// scrolling back to a previously-visible message re-parses. Messages are
// immutable in history; same content → same tokens. Keyed by hash to avoid
// retaining full content strings (turn50→turn99 RSS regression, #24180).
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map<string, Token[]>();

// Characters that indicate markdown syntax. If none are present, skip the
// ~3ms marked.lexer call entirely — render as a single paragraph. Covers
// the majority of short assistant responses and user prompts that are
// plain sentences. Checked via indexOf (not regex) for speed.
// Single regex: matches any MD marker or ordered-list start (N. at line start).
// One pass instead of 10× includes scans.
const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;
function hasMarkdownSyntax(s: string): boolean {
  // Sample first 500 chars — if markdown exists it's usually early (headers,
  // code fence, list). Long tool outputs are mostly plain text tails.
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s);
}
function cachedLexer(content: string): Token[] {
  // Fast path: plain text with no markdown syntax → single paragraph token.
  // Skips marked.lexer's full GFM parse (~3ms on long content). Not cached —
  // reconstruction is a single object allocation, and caching would retain
  // 4× content in raw/text fields plus the hash key for zero benefit.
  if (!hasMarkdownSyntax(content)) {
    return [{
      type: 'paragraph',
      raw: content,
      text: content,
      tokens: [{
        type: 'text',
        raw: content,
        text: content
      }]
    } as Token];
  }
  const key = hashContent(content);
  const hit = tokenCache.get(key);
  if (hit) {
    // Promote to MRU — without this the eviction is FIFO (scrolling back to
    // an early message evicts the very item you're looking at).
    tokenCache.delete(key);
    tokenCache.set(key, hit);
    return hit;
  }
  const tokens = marked.lexer(content);
  if (tokenCache.size >= TOKEN_CACHE_MAX) {
    // LRU-ish: drop oldest. Map preserves insertion order.
    const first = tokenCache.keys().next().value;
    if (first !== undefined) tokenCache.delete(first);
  }
  tokenCache.set(key, tokens);
  return tokens;
}

/**
 * Renders markdown content using a hybrid approach:
 * - Tables are rendered as React components with proper flexbox layout
 * - Other content is rendered as ANSI strings via formatToken
 */
export function Markdown(props) {
  const $ = _c(4);
  const settings = useSettings();
  if (settings.syntaxHighlightingDisabled) {
    let t0;
    if ($[0] !== props) {
      t0 = <MarkdownBody {...props} highlight={null} />;
      $[0] = props;
      $[1] = t0;
    } else {
      t0 = $[1];
    }
    return t0;
  }
  let t0;
  if ($[2] !== props) {
    t0 = <Suspense fallback={<MarkdownBody {...props} highlight={null} />}><MarkdownWithHighlight {...props} /></Suspense>;
    $[2] = props;
    $[3] = t0;
  } else {
    t0 = $[3];
  }
  return t0;
}
function MarkdownWithHighlight(props) {
  const $ = _c(4);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = getCliHighlightPromise();
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  const highlight = use(t0);
  let t1;
  if ($[1] !== highlight || $[2] !== props) {
    t1 = <MarkdownBody {...props} highlight={highlight} />;
    $[1] = highlight;
    $[2] = props;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  return t1;
}
type MarkdownBodyProps = Props & {
  highlight: CliHighlight | null;
};
function MarkdownBody({
  children,
  dimColor,
  highlight
}: MarkdownBodyProps) {
  configureMarked();

  const tokens = cachedLexer(stripPromptXMLTags(children));
  if (isBrowserRuntime()) {
    return <BrowserMarkdown tokens={tokens} dimColor={dimColor} />;
  }

  const [theme] = useTheme();
  const elements: React.ReactNode[] = [];
  let nonTableContent = '';

  const flushNonTableContent = () => {
    if (!nonTableContent) {
      return;
    }
    elements.push(<Ansi key={elements.length} dimColor={dimColor}>{nonTableContent.trim()}</Ansi>);
    nonTableContent = '';
  };

  for (const token of tokens) {
    if (token.type === 'table') {
      flushNonTableContent();
      elements.push(<MarkdownTable key={elements.length} token={token as Tokens.Table} highlight={highlight} />);
    } else {
      nonTableContent += formatToken(token, theme, 0, null, null, highlight);
    }
  }

  flushNonTableContent();
  return <Box flexDirection="column" gap={1}>{elements}</Box>;
}

type BrowserMarkdownProps = {
  tokens: Token[];
  dimColor?: boolean;
};

function BrowserMarkdown({
  tokens,
  dimColor
}: BrowserMarkdownProps): React.ReactNode {
  return (
    <div className="oc-markdown" data-dim={dimColor ? 'true' : undefined}>
      {tokens.map((token, index) => renderBrowserBlock(token, `block-${index}`))}
    </div>
  );
}

function renderBrowserBlocks(tokens: Token[] | undefined, keyPrefix: string): React.ReactNode[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  return tokens.map((token, index) => renderBrowserBlock(token, `${keyPrefix}-${index}`));
}

function renderBrowserBlock(token: Token, key: React.Key): React.ReactNode {
  switch (token.type) {
    case 'space':
      return null;
    case 'heading': {
      const heading = token as Tokens.Heading;
      const tagName = `h${Math.min(Math.max(heading.depth, 1), 6)}`;
      return React.createElement(
        tagName,
        { className: 'oc-markdownHeading', key },
        renderBrowserInline(heading.tokens, heading.text, `${key}-inline`),
      );
    }
    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph;
      return (
        <p key={key}>
          {renderBrowserInline(paragraph.tokens, paragraph.text, `${key}-inline`)}
        </p>
      );
    }
    case 'text': {
      const text = token as Tokens.Text;
      return (
        <p key={key}>
          {renderBrowserInline(text.tokens, text.text, `${key}-inline`)}
        </p>
      );
    }
    case 'list': {
      const list = token as Tokens.List;
      const Tag = list.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key} start={list.start || undefined}>
          {list.items.map((item, index) => renderBrowserListItem(item, `${key}-item-${index}`))}
        </Tag>
      );
    }
    case 'code': {
      const code = token as Tokens.Code;
      return (
        <pre key={key} className={code.lang ? `language-${code.lang}` : undefined}>
          <code>{code.text}</code>
        </pre>
      );
    }
    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      return (
        <blockquote key={key}>
          {renderBrowserBlocks(quote.tokens, `${key}-quote`)}
        </blockquote>
      );
    }
    case 'hr':
      return <hr key={key} />;
    case 'table':
      return renderBrowserTable(token as Tokens.Table, key);
    case 'html': {
      const html = token as Tokens.HTML;
      return (
        <pre key={key} className="oc-markdownRawHtml">
          <code>{html.text || html.raw}</code>
        </pre>
      );
    }
    default: {
      const fallback = token as Tokens.Generic;
      const text = typeof fallback.text === 'string' ? fallback.text : fallback.raw;
      return text ? <p key={key}>{text}</p> : null;
    }
  }
}

function renderBrowserListItem(item: Tokens.ListItem, key: React.Key): React.ReactNode {
  const blocks = renderBrowserBlocks(item.tokens, `${key}-block`);
  return (
    <li key={key}>
      {blocks.length > 0
        ? blocks
        : renderBrowserInline(item.tokens, item.text, `${key}-inline`)}
    </li>
  );
}

function renderBrowserTable(table: Tokens.Table, key: React.Key): React.ReactNode {
  return (
    <div key={key} className="oc-markdownTableWrap">
      <table className="oc-markdownTable">
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th key={`head-${index}`}>
                {renderBrowserInline(cell.tokens, cell.text, `${key}-head-${index}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>
                  {renderBrowserInline(cell.tokens, cell.text, `${key}-cell-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBrowserInline(
  tokens: Token[] | undefined,
  fallback: string | undefined,
  keyPrefix: string,
): React.ReactNode {
  if (!tokens || tokens.length === 0) {
    return fallback ?? null;
  }

  return tokens.map((token, index) => renderBrowserInlineToken(token, `${keyPrefix}-${index}`));
}

function renderBrowserInlineToken(token: Token, key: React.Key): React.ReactNode {
  switch (token.type) {
    case 'text': {
      const text = token as Tokens.Text;
      return text.tokens
        ? <React.Fragment key={key}>{renderBrowserInline(text.tokens, text.text, `${key}-nested`)}</React.Fragment>
        : <React.Fragment key={key}>{text.text}</React.Fragment>;
    }
    case 'strong': {
      const strong = token as Tokens.Strong;
      return <strong key={key}>{renderBrowserInline(strong.tokens, strong.text, `${key}-strong`)}</strong>;
    }
    case 'em': {
      const emphasis = token as Tokens.Em;
      return <em key={key}>{renderBrowserInline(emphasis.tokens, emphasis.text, `${key}-em`)}</em>;
    }
    case 'codespan': {
      const code = token as Tokens.Codespan;
      return <code key={key}>{code.text}</code>;
    }
    case 'br':
      return <br key={key} />;
    case 'del': {
      const deleted = token as Tokens.Del;
      return <del key={key}>{renderBrowserInline(deleted.tokens, deleted.text, `${key}-del`)}</del>;
    }
    case 'link': {
      const link = token as Tokens.Link;
      return (
        <a key={key} href={link.href} title={link.title || undefined} target="_blank" rel="noreferrer">
          {renderBrowserInline(link.tokens, link.text, `${key}-link`)}
        </a>
      );
    }
    case 'image': {
      const image = token as Tokens.Image;
      return <img key={key} src={image.href} alt={image.text} title={image.title || undefined} />;
    }
    default: {
      const fallback = token as Tokens.Generic;
      return <React.Fragment key={key}>{typeof fallback.text === 'string' ? fallback.text : fallback.raw}</React.Fragment>;
    }
  }
}
type StreamingProps = {
  children: string;
};

/**
 * Renders markdown during streaming by splitting at the last top-level block
 * boundary: everything before is stable (memoized, never re-parsed), only the
 * final block is re-parsed per delta. marked.lexer() correctly handles
 * unclosed code fences as a single token, so block boundaries are always safe.
 *
 * The stable boundary only advances (monotonic), so ref mutation during render
 * is idempotent and safe under StrictMode double-rendering. Component unmounts
 * between turns (streamingText → null), resetting the ref.
 */
export function StreamingMarkdown({
  children
}: StreamingProps): React.ReactNode {
  // React Compiler: this component reads and writes stablePrefixRef.current
  // during render by design. The boundary only advances (monotonic), so
  // the ref mutation is idempotent under StrictMode double-render — but the
  // compiler can't prove that, and memoizing around the ref reads would
  // break the algorithm (stale boundary). Opt out.
  'use no memo';

  configureMarked();

  // Strip before boundary tracking so it matches <Markdown>'s stripping
  // (line 29). When a closing tag arrives, stripped(N+1) is not a prefix
  // of stripped(N), but the startsWith reset below handles that with a
  // one-time re-lex on the smaller stripped string.
  const stripped = stripPromptXMLTags(children);
  const stablePrefixRef = useRef('');

  // Reset if text was replaced (defensive; normally unmount handles this)
  if (!stripped.startsWith(stablePrefixRef.current)) {
    stablePrefixRef.current = '';
  }

  // Lex only from current boundary — O(unstable length), not O(full text)
  const boundary = stablePrefixRef.current.length;
  const tokens = marked.lexer(stripped.substring(boundary));

  // Last non-space token is the growing block; everything before is final
  let lastContentIdx = tokens.length - 1;
  while (lastContentIdx >= 0 && tokens[lastContentIdx]!.type === 'space') {
    lastContentIdx--;
  }
  let advance = 0;
  for (let i = 0; i < lastContentIdx; i++) {
    advance += tokens[i]!.raw.length;
  }
  if (advance > 0) {
    stablePrefixRef.current = stripped.substring(0, boundary + advance);
  }
  const stablePrefix = stablePrefixRef.current;
  const unstableSuffix = stripped.substring(stablePrefix.length);

  // stablePrefix is memoized inside <Markdown> via useMemo([children, ...])
  // so it never re-parses as the unstable suffix grows
  return <Box flexDirection="column" gap={1}>
      {stablePrefix && <Markdown>{stablePrefix}</Markdown>}
      {unstableSuffix && <Markdown>{unstableSuffix}</Markdown>}
    </Box>;
}
