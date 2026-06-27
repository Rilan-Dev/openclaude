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

class BrowserServiceException extends Error {
  constructor(opts = {}) {
    super(opts.message ?? 'AWS service exception')
    this.name = new.target?.name ?? 'BrowserServiceException'
    Object.assign(this, opts)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class BedrockRuntimeServiceException extends BrowserServiceException {}
export class InternalServerException extends BrowserServiceException {}
export class ModelStreamErrorException extends BrowserServiceException {}
export class ThrottlingException extends BrowserServiceException {}
export class ValidationException extends BrowserServiceException {}

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

export async function streamCollector() {
  return new Uint8Array()
}

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
  BedrockRuntimeServiceException,
  CountTokensCommand,
  GetCallerIdentityCommand,
  GetInferenceProfileCommand,
  InternalServerException,
  ListInferenceProfilesCommand,
  McpbManifestSchema,
  ModelStreamErrorException,
  NoAuthSigner,
  NodeHttpHandler,
  STSClient,
  StreamMessageReader,
  StreamMessageWriter,
  Trace,
  ThrottlingException,
  ValidationException,
  createClaudeForChromeMcpServer,
  createMessageConnection,
  defaultProvider,
  fromIni,
  fromLoginCredentials,
  getMcpConfigForManifest,
  plot,
  streamCollector,
}
