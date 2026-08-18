/*
  Per-request CSP nonce — client-safe accessor.

  TanStack Start emits inline <script> tags during SSR (the router dehydration
  payload and ScriptOnce calls). A strict `script-src 'self'` blocks them, which
  means the published site renders but never hydrates. The router accepts a
  nonce via `ssr.nonce`; the same value must end up in the CSP header set in
  src/server.ts.

  src/router.tsx is part of the client bundle, so it must not import
  node:async_hooks. Instead the server registers a getter here at startup
  (see csp-nonce.server.ts, imported only from src/server.ts) and the router
  calls `getCspNonce()`, which returns undefined in the browser.
*/

type NonceGetter = () => string | undefined;

let nonceGetter: NonceGetter | undefined;

export function setCspNonceGetter(getter: NonceGetter): void {
  nonceGetter = getter;
}

/** The current request's nonce, or undefined on the client / outside a request. */
export function getCspNonce(): string | undefined {
  try {
    return nonceGetter?.();
  } catch {
    return undefined;
  }
}
