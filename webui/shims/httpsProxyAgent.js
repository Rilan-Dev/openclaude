export class HttpsProxyAgent {
  constructor(proxy, options = {}) {
    this.proxy = proxy
    this.options = options
  }
}

export default HttpsProxyAgent
