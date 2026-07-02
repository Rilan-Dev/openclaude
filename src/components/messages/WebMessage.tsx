import type { ReactNode } from 'react'
import { isBrowserRuntime } from '../../utils/runtime.js'

export type WebMessageRole =
  | 'assistant'
  | 'user'
  | 'tool'
  | 'system'
  | 'attachment'

type WebMessageBoundaryProps = {
  children: ReactNode
  role: WebMessageRole
  continuation?: boolean
  streaming?: boolean
  plain?: boolean
}

export function shouldRenderWebMessage(): boolean {
  return isBrowserRuntime()
}

export function WebMessageBoundary({
  children,
  role,
  continuation = false,
  streaming = false,
  plain = false,
}: WebMessageBoundaryProps): ReactNode {
  if (!shouldRenderWebMessage()) {
    return children
  }

  return (
    <div
      className="repl-messageRow oc-messageRow oc-webMessageBoundary"
      data-continuation={continuation ? 'true' : undefined}
      data-message-role={role}
      data-plain={plain ? 'true' : undefined}
      data-streaming={streaming ? 'true' : undefined}
    >
      <div className="repl-messageBubble oc-messageBubble">
        <div className={`oc-webMessageContent oc-webMessageContent--${role}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
