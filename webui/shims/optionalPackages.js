const unavailable = name => {
  throw new Error(`${name} is not available in the browser web UI`)
}

export function plot() {
  return ''
}

class OptionalCommand {
  constructor(input = {}) {
    this.input = input
  }
}

class OptionalClient {
  constructor(config = {}) {
    this.config = config
  }

  async send() {
    unavailable('optional Node provider client')
  }
}

export class STSClient extends OptionalClient {}
export class GetCallerIdentityCommand extends OptionalCommand {}

export class BedrockClient extends OptionalClient {}
export class BedrockRuntimeClient extends OptionalClient {}
export class ListInferenceProfilesCommand extends OptionalCommand {}
export class GetInferenceProfileCommand extends OptionalCommand {}
export class CountTokensCommand extends OptionalCommand {}

export function fromIni() {
  return async () => {
    unavailable('@aws-sdk/credential-providers.fromIni')
  }
}

export function fromLoginCredentials() {
  return async () => {
    unavailable('@aws-sdk/credential-provider-login.fromLoginCredentials')
  }
}

export function defaultProvider() {
  return async () => {
    unavailable('@aws-sdk/credential-provider-node.defaultProvider')
  }
}

export class NodeHttpHandler {}
export class NoAuthSigner {}

export const BROWSER_TOOLS = []

export function createClaudeForChromeMcpServer() {
  return {
    async connect() {
      unavailable('@ant/claude-for-chrome-mcp')
    },
    async close() {},
  }
}

export const McpbManifestSchema = {
  safeParse(input) {
    if (input && typeof input === 'object' && typeof input.name === 'string') {
      return { success: true, data: input }
    }
    return {
      success: false,
      error: {
        flatten: () => ({
          fieldErrors: {},
          formErrors: ['MCPB manifests are not available in the browser web UI'],
        }),
      },
    }
  },
}

export async function getMcpConfigForManifest() {
  unavailable('@anthropic-ai/mcpb.getMcpConfigForManifest')
}

export class StreamMessageReader {
  constructor(stream) {
    this.stream = stream
  }
}

export class StreamMessageWriter {
  constructor(stream) {
    this.stream = stream
  }
}

export const Trace = {
  Off: 'off',
  Messages: 'messages',
  Verbose: 'verbose',
}

export function createMessageConnection() {
  return {
    listen() {},
    dispose() {},
    onError() {},
    onClose() {},
    onNotification() {},
    onRequest() {},
    trace: async () => {},
    sendRequest: async () => unavailable('vscode-jsonrpc.sendRequest'),
    sendNotification: async () => {},
  }
}

export default {
  BROWSER_TOOLS,
  BedrockClient,
  BedrockRuntimeClient,
  CountTokensCommand,
  GetCallerIdentityCommand,
  GetInferenceProfileCommand,
  ListInferenceProfilesCommand,
  McpbManifestSchema,
  NoAuthSigner,
  NodeHttpHandler,
  STSClient,
  StreamMessageReader,
  StreamMessageWriter,
  Trace,
  createClaudeForChromeMcpServer,
  createMessageConnection,
  defaultProvider,
  fromIni,
  fromLoginCredentials,
  getMcpConfigForManifest,
  plot,
}
