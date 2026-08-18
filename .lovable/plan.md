# Round 16 — CSP nonce for SSR hydration (published host)

## Diagnosis (confirmed in the installed framework, not assumed)

TanStack Router 1.169 already supports a per-request CSP nonce end to end:

- `router.options.ssr.nonce` is stamped onto every inline SSR script it emits
  (`router-core/dist/esm/ssr/ssr-server.js`: `<script nonce='…'>`, and the buffered
  `$tsr` script barrier tag).
- `HeadContent` emits `<meta property="csp-nonce" content="…">`, and the client
  (`ssr-client.js`) reads that meta back so client-inserted scripts inherit the nonce.

So option 1 from the request is achievable — no build-time hashes, no `unsafe-inline`.

## The fix

1. New module `src/lib/csp-nonce.ts`: an `AsyncLocalStorage` holding the current
   request's nonce, plus `runWithNonce(nonce, fn)` and `getRequestNonce()`.
   (`node:async_hooks` is supported in the Worker runtime with nodejs_compat.)
2. `src/server.ts`: generate a fresh base64 nonce per request with
   `crypto.getRandomValues` (inside `fetch`, never at module scope), run the whole
   handler call inside `runWithNonce(...)`, and inject `'nonce-<value>'` into the
   `script-src` directive of the strict policy for that response only.
   Host gating is unchanged — published and custom-domain hosts keep the strict set,
   HSTS and `X-Frame-Options: DENY`. Nothing is added to `PREVIEW_HOST_PATTERNS`.
3. `src/router.tsx`: pass `ssr: { nonce: getRequestNonce() }` to `createRouter`
   (undefined on the client and in dev, where the header isn't applied).

Notes:
- `script-src` becomes `'self' 'nonce-…'`. A nonce does not disable `'self'`, so the
  hashed external bundle files keep loading normally.
- Host-agnostic by construction: the nonce is derived per request, so
  `portal.tigersdenmartialarts.com` behaves identically.
- No hard-coded hashes anywhere; no CSP relaxation.

## Verification (against the published host, not preview)

- `curl -sI https://tigersdenmartialartsparentportal.lovable.app/` — report the real
  `Content-Security-Policy`, confirm a `nonce-` value is present and that two
  successive requests return different nonces.
- Playwright against the published URL: `/`, `/auth`, `/reset-password`,
  `/privacy-policy`, `/terms`, `/media-release` — collect console output, confirm zero
  CSP violations and zero `Invariant failed`, and confirm the page is interactive
  (sidebar toggle / auth form responds).
- Confirm the Supabase XHR to `https://dddsnppompvmzopufhnq.supabase.co` is allowed by
  `connect-src https://*.supabase.co` (observed in the network log, not assumed).
- Confirm `frame-src https://www.youtube-nocookie.com` still present so curriculum
  videos play.

Publishing is required before the published host can be re-tested, so the last step is
a publish followed by the checks above.
