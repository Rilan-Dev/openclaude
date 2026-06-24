import { useEffect } from 'react'
import { logEvent } from 'src/services/analytics/index.js'
import { z } from 'zod/v3'
import type { MCPServerConnection } from '../services/mcp/types.js'
import { getConnectedIdeClient } from '../utils/ide.js'
import { lazySchema } from '../utils/lazySchema.js'

type LogEventNotification = {
  method: 'log_event'
  params: {
    eventName: string
    eventData: Record<string, boolean | number | undefined>
  }
}

const LogEventSchema = lazySchema(() =>
  z.object({
    method: z.literal('log_event'),
    params: z.object({
      eventName: z.string(),
      eventData: z.object({}).passthrough(),
    }),
  }),
)

export function useIdeLogging(mcpClients: MCPServerConnection[]): void {
  useEffect(() => {
    if (!mcpClients.length) {
      return
    }

    const ideClient = getConnectedIdeClient(mcpClients)
    if (!ideClient) {
      return
    }

    const schema = LogEventSchema() as unknown as Parameters<
      typeof ideClient.client.setNotificationHandler
    >[0]

    ideClient.client.setNotificationHandler(schema, notification => {
      const { eventName, eventData } = notification.params as LogEventNotification['params']

      logEvent(`tengu_ide_${eventName}`, eventData)
    })
  }, [mcpClients])
}