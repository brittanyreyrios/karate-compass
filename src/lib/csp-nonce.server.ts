/*
  Per-request CSP nonce storage — server only.

  The nonce is produced in the response path (src/server.ts) but consumed inside
  `getRouter()` during SSR, so it travels through an AsyncLocalStorage store
  scoped to the request rather than a module-level global (which would be shared
  by concurrent requests).

  node:async_hooks is available in the deployed Worker via nodejs_compat. If the
  store ever fails, `getRequestCspNonce()` returns undefined and src/server.ts
  serves the page without a CSP header plus an `X-CSP-Fallback: 1` marker, rather
  than returning a 500.
*/
import { AsyncLocalStorage } from "node:async_hooks";
import { setCspNonceGetter } from "./csp-nonce";

const store = new AsyncLocalStorage<string>();

/** Base64 nonce with 128 bits of entropy, fresh per request. */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Runs `fn` with `nonce` readable by `getCspNonce()` anywhere inside it. */
export function runWithCspNonce<T>(nonce: string, fn: () => T): T {
  return store.run(nonce, fn);
}

export function getRequestCspNonce(): string | undefined {
  try {
    return store.getStore();
  } catch {
    return undefined;
  }
}

setCspNonceGetter(getRequestCspNonce);
