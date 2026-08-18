/*
  Per-request CSP nonce.

  TanStack Start emits inline <script> tags during SSR (the router dehydration
  payload and ScriptOnce calls). A strict `script-src 'self'` blocks them, which
  means the published site renders but never hydrates. The router accepts a
  nonce via `ssr.nonce`; the same value has to end up in the CSP header we set
  in src/server.ts. The two are produced in different places — the response path
  and `getRouter()` — so the value travels through an AsyncLocalStorage store
  keyed to the request.

  node:async_hooks is available in the deployed Worker via nodejs_compat. If the
  import or the store ever fails we degrade to a served page rather than a 500:
  see `runWithCspNonce` returning `undefined` and the X-CSP-Fallback marker in
  src/server.ts.
*/
import { AsyncLocalStorage } from "node:async_hooks";

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

/** The current request's nonce, or undefined outside a request / on the client. */
export function getCspNonce(): string | undefined {
  try {
    return store.getStore();
  } catch {
    return undefined;
  }
}
