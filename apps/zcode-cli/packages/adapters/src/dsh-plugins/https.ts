import { createNodeHttpClientAdapter } from "@zcode/adapters/http";
import type { HttpClientPort } from "@zcode/contracts";
import type { DshHttpsRequest } from "./contract.js";
import { DshPackageError } from "./errors.js";

export function dshPublicHttpsUrl(input: string): string {
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/.test(url.hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(url.hostname)
    )
      throw new Error("Not public HTTPS");
    return url.href;
  } catch (error) {
    throw new DshPackageError(
      "DSH_INVALID_SOURCE",
      "Source requires a public credential-free HTTPS URL",
      { cause: error },
    );
  }
}

export interface DshHttpsRequestOptions {
  httpClient?: HttpClientPort;
}

export function createDshHttpsRequest(options: DshHttpsRequestOptions = {}): DshHttpsRequest {
  // 文本 IP 黑名单无法识别私有 DNS 或重绑定；复用在预检和建连两次验证地址的公网端口。
  const http = options.httpClient ?? createNodeHttpClientAdapter({ env: {} });
  return {
    async request(input, requestOptions) {
      const url = dshPublicHttpsUrl(input);
      try {
        const response = await http.request(
          {
            url,
            egressPolicy: "public",
            redirect: "manual",
            timeoutMs: requestOptions.timeoutMs,
            maxResponseBytes: requestOptions.maxBytes,
            headers: { accept: "application/json, application/octet-stream" },
          },
          { signal: requestOptions.signal },
        );
        if (response.status < 200 || response.status >= 300)
          throw new Error("HTTP source request failed or attempted redirection");
        if (response.body.byteLength > requestOptions.maxBytes)
          throw new Error("HTTP source exceeds byte limit");
        return { bytes: response.body };
      } catch (error) {
        throw new DshPackageError(
          "DSH_HTTP_FAILED",
          requestOptions.signal?.aborted
            ? "HTTPS source request cancelled or timed out"
            : "HTTPS source request failed",
          { cause: error },
        );
      }
    },
  };
}
