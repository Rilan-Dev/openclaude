import * as React from 'react';

export function isDisclosureElement(node: React.ReactNode): boolean {
  return React.isValidElement(node) && node.type === 'details';
}

export function BrowserToolResultDisclosure({
  title,
  detail,
  state = 'done',
  defaultOpen,
  children,
}: {
  title: string;
  detail?: string;
  state?: 'done' | 'error' | 'running' | 'queued';
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.ReactNode {
  const shouldOpen = defaultOpen ?? (state === 'running' || state === 'queued');

  return (
    <details className="oc-toolDisclosure oc-toolDisclosure--result" data-tool-state={state} open={shouldOpen}>
      <summary className="oc-toolDisclosureSummary">
        <span className="oc-toolDisclosureStatus" />
        <span className="oc-toolDisclosureTitle">{title}</span>
        {detail ? <span className="oc-toolDisclosureMeta">{detail}</span> : null}
      </summary>
      <div className="oc-toolDisclosureBody">{children}</div>
    </details>
  );
}
