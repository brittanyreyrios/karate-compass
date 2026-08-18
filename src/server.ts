import "./lib/error-capture";

import { createCspNonce, getRequestCspNonce, runWithCspNonce } from "./lib/csp-nonce.server";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Security headers.
//
// The three baseline headers below are safe everywhere and always applied.
// The strict set (full CSP with `frame-ancestors 'none'`, X-Frame-Options: DENY
// and HSTS) is applied on every HTTPS host except an actual editor preview.
// Published *.lovable.app hosts are intentionally NOT excluded. The editor's
// current editor hosts use `id-preview--`; stable development previews use
// `project--…-dev.lovable.app`. Legacy lovableproject.com previews and local
// development must also remain frameable.
const PREVIEW_HOST_PATTERNS = [/(^|\.)lovableproject\.com$/i];

function isPreviewHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) return true;
  const normalized = hostname.toLowerCase();
  if (normalized.startsWith("id-preview--")) return true;
  if (/^project--.+-dev\.lovable\.app$/.test(normalized)) return true;
  return PREVIEW_HOST_PATTERNS.some((re) => re.test(hostname));
}

function buildContentSecurityPolicy(nonce: string): string {
  return CSP_DIRECTIVES.replace("__SCRIPT_SRC__", `script-src 'self' 'nonce-${nonce}'`);
}

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "__SCRIPT_SRC__",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // Curriculum videos are embedded from YouTube's no-cookie domain only, and only
  // after a family presses play. Thumbnails are already covered by img-src https:.
  "frame-src https://www.youtube-nocookie.com",

  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function withSecurityHeaders(response: Response, request?: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  let strict = false;
  if (request) {
    try {
      const { hostname, protocol } = new URL(request.url);
      strict = protocol === "https:" && !isPreviewHost(hostname);
    } catch {
      strict = false;
    }
  }

  if (strict) {
    // The nonce comes from the AsyncLocalStorage store established for this
    // request. If it is missing, the SSR inline scripts carry no nonce, so
    // sending the strict policy anyway would produce a rendered-but-dead page.
    // Fail open instead: serve without CSP, and mark the response so the
    // condition is discoverable with a single curl rather than only in logs.
    const nonce = getRequestCspNonce();
    if (nonce) {
      headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
      // A nonce-bearing HTML document must never be reused by a shared cache or
      // replayed from the HTTP cache without revalidation, or a stale nonce
      // would be paired with a fresh CSP header (or vice versa).
      //
      // Deliberately NOT `no-store`: that would also disable the browser's
      // back/forward cache, so Back out of the curriculum page would re-fetch
      // and re-render instead of restoring instantly. `private, no-cache,
      // must-revalidate` keeps the document out of CDN/shared caches and forces
      // revalidation before any HTTP-cache reuse, while bfcache restores the
      // live in-memory page whose already-executed scripts match its own nonce.
      if ((headers.get("content-type") ?? "").includes("text/html")) {
        headers.set("Cache-Control", "private, no-cache, must-revalidate");
      }
    } else {
      headers.set("X-CSP-Fallback", "1");
      console.error("CSP nonce unavailable for this request; served without Content-Security-Policy");
    }
    headers.set("X-Frame-Options", "DENY");
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}


export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const nonce = createCspNonce();
      return await runWithCspNonce(nonce, async () => {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request);
      });
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};

