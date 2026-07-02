export const SandboxRuntimeConfigSchema = {
  safeParse(input) {
    return { success: true, data: input }
  },
}

export class SandboxViolationStore {
  constructor() {
    this.events = []
  }

  add(event) {
    this.events.push(event)
  }

  getEvents() {
    return this.events
  }

  clear() {
    this.events = []
  }
}

export class SandboxManager {
  static checkDependencies() {
    return {
      available: false,
      missing: ['browser'],
      errors: ['Sandboxing is not available in the browser WebUI runtime.'],
      warnings: [],
    }
  }

  static isSupportedPlatform() {
    return false
  }

  static wrapWithSandbox(command) {
    return command
  }

  static async initialize() {}
  static updateConfig() {}
  static reset() {}
  static getFsReadConfig() {
    return undefined
  }
  static getFsWriteConfig() {
    return undefined
  }
  static getNetworkRestrictionConfig() {
    return undefined
  }
  static getIgnoreViolations() {
    return undefined
  }
  static getAllowUnixSockets() {
    return false
  }
  static getAllowLocalBinding() {
    return false
  }
  static getEnableWeakerNestedSandbox() {
    return false
  }
  static getProxyPort() {
    return undefined
  }
  static getSocksProxyPort() {
    return undefined
  }
  static getLinuxHttpSocketPath() {
    return undefined
  }
  static getLinuxSocksSocketPath() {
    return undefined
  }
  static async waitForNetworkInitialization() {}
  static getSandboxViolationStore() {
    return new SandboxViolationStore()
  }
  static annotateStderrWithSandboxFailures(stderr) {
    return stderr
  }
  static cleanupAfterCommand() {}
}

export default {
  SandboxManager,
  SandboxRuntimeConfigSchema,
  SandboxViolationStore,
}
