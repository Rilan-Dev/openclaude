import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { SuggestionItem } from '../components/PromptInput/PromptInputFooterSuggestions.js';

export type PromptOverlayData = {
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  maxColumnWidth?: number;
};

type Setter<T> = (d: T | null) => void;
type UiMode = 'auto' | 'tui' | 'web';

type PromptOverlayProviderProps = {
  children: ReactNode;

  /**
   * tui  = existing Ink/TUI behavior only
   * web  = render floating overlay into document.body
   * auto = use Web mode when .repl-shell or [data-openclaude-ui="web"] exists
   */
  uiMode?: UiMode;
};

const DataContext = createContext<PromptOverlayData | null>(null);
const SetContext = createContext<Setter<PromptOverlayData> | null>(null);

const DialogContext = createContext<ReactNode>(null);
const SetDialogContext = createContext<Setter<ReactNode> | null>(null);

export function PromptOverlayProvider({
  children,
  uiMode = 'auto',
}: PromptOverlayProviderProps) {
  const [data, setData] = useState<PromptOverlayData | null>(null);
  const [dialog, setDialog] = useState<ReactNode>(null);

  const resolvedUiMode = useResolvedUiMode(uiMode);

  return (
    <SetContext.Provider value={setData}>
      <SetDialogContext.Provider value={setDialog}>
        <DataContext.Provider value={data}>
          <DialogContext.Provider value={dialog}>
            {children}

            {resolvedUiMode === 'web' && (
              <WebPromptOverlayPortal data={data} dialog={dialog} />
            )}
          </DialogContext.Provider>
        </DataContext.Provider>
      </SetDialogContext.Provider>
    </SetContext.Provider>
  );
}

export function usePromptOverlay() {
  return useContext(DataContext);
}

export function usePromptOverlayDialog() {
  return useContext(DialogContext);
}

/**
 * Register suggestion data for the floating overlay. Clears on unmount.
 * No-op outside the provider, so existing non-fullscreen/TUI behavior survives.
 */
export function useSetPromptOverlay(data: PromptOverlayData | null) {
  const set = useContext(SetContext);

  useEffect(() => {
    if (!set) return;
    set(data);
  }, [set, data]);

  useEffect(() => {
    if (!set) return;
    return () => set(null);
  }, [set]);
}

/**
 * Register a dialog node to float above the prompt. Clears on unmount.
 * No-op outside the provider, so existing non-fullscreen/TUI behavior survives.
 */
export function useSetPromptOverlayDialog(node: ReactNode) {
  const set = useContext(SetDialogContext);

  useEffect(() => {
    if (!set) return;
    set(node);
  }, [set, node]);

  useEffect(() => {
    if (!set) return;
    return () => set(null);
  }, [set]);
}

function useResolvedUiMode(uiMode: UiMode): 'tui' | 'web' {
  const [resolved, setResolved] = useState<'tui' | 'web'>(() => {
    if (uiMode === 'web') return 'web';
    return 'tui';
  });

  useEffect(() => {
    if (uiMode === 'web' || uiMode === 'tui') {
      setResolved(uiMode);
      return;
    }

    if (typeof document === 'undefined') {
      setResolved('tui');
      return;
    }

    const detect = () => {
      const hasWebShell =
        document.documentElement.dataset.openclaudeUi === 'web' ||
        document.body.dataset.openclaudeUi === 'web' ||
        Boolean(document.querySelector('.repl-shell, [data-openclaude-ui="web"]'));

      setResolved(hasWebShell ? 'web' : 'tui');
    };

    detect();

    if (typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(detect);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-openclaude-ui'],
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-openclaude-ui'],
    });

    return () => observer.disconnect();
  }, [uiMode]);

  return resolved;
}

function WebPromptOverlayPortal({
  data,
  dialog,
}: {
  data: PromptOverlayData | null;
  dialog: ReactNode;
}) {
  const root = usePromptOverlayRoot();

  if (!root) return null;
  if (!data && !dialog) return null;

  return createPortal(
    <div className="repl-promptOverlayRoot" aria-live="polite">
      <div className="repl-promptOverlayDock">
        {dialog ? (
          <div className="repl-commandSurface">{dialog}</div>
        ) : null}

        {data?.suggestions?.length ? (
          <WebPromptSuggestions data={data} />
        ) : null}
      </div>
    </div>,
    root,
  );
}

function usePromptOverlayRoot() {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let element = document.getElementById('openclaude-prompt-overlay-root');

    if (!element) {
      element = document.createElement('div');
      element.id = 'openclaude-prompt-overlay-root';
      document.body.appendChild(element);
    }

    setRoot(element);
  }, []);

  return root;
}

function WebPromptSuggestions({ data }: { data: PromptOverlayData }) {
  const style = useMemo<React.CSSProperties | undefined>(() => {
    if (!data.maxColumnWidth) return undefined;

    return {
      maxWidth: data.maxColumnWidth,
    };
  }, [data.maxColumnWidth]);

  return (
    <div
      className="repl-commandSurface repl-promptFooterSuggestions"
      role="listbox"
      aria-label="Prompt suggestions"
      style={style}
    >
      <div className="repl-suggestionDeck">
        {data.suggestions.map((suggestion, index) => (
          <WebSuggestionItem
            key={getSuggestionKey(suggestion, index)}
            suggestion={suggestion}
            selected={index === data.selectedSuggestion}
          />
        ))}
      </div>
    </div>
  );
}

function WebSuggestionItem({
  suggestion,
  selected,
}: {
  suggestion: SuggestionItem;
  selected: boolean;
}) {
  const record = suggestion as Record<string, unknown>;

  const name =
    asText(record.name) ??
    asText(record.title) ??
    asText(record.label) ??
    asText(record.command) ??
    'Suggestion';

  const description =
    asText(record.description) ??
    asText(record.subtitle) ??
    asText(record.detail);

  const tag =
    asText(record.tag) ??
    asText(record.type) ??
    asText(record.category);

  return (
    <div
      className="repl-suggestionItem"
      data-selected={selected ? 'true' : 'false'}
      role="option"
      aria-selected={selected}
    >
      <div className="repl-suggestionItemMain">
        <span className="repl-suggestionIcon">/</span>
        <span className="repl-suggestionName">{name}</span>

        {tag ? (
          <span className="repl-suggestionTag">{tag}</span>
        ) : null}
      </div>

      {description ? (
        <div className="repl-suggestionDescription">{description}</div>
      ) : null}
    </div>
  );
}

function getSuggestionKey(suggestion: SuggestionItem, index: number) {
  const record = suggestion as Record<string, unknown>;

  return (
    asText(record.id) ??
    asText(record.name) ??
    asText(record.title) ??
    asText(record.label) ??
    String(index)
  );
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}
