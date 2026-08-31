import { supabase } from "@/integrations/supabase/client";

/**
 * App-wide handling for "the session died while the parent was already on a page".
 *
 * `_authenticated/route.tsx`'s beforeLoad only runs on a cold navigation into the
 * subtree, and supabase-js only emits SIGNED_OUT when it actually *attempts* a token
 * refresh. A token that is revoked (or expires) while a page sits mounted therefore
 * produces nothing but failing queries — which every page renders as "couldn't load
 * this section". This module turns that into a clean redirect to /auth.
 *
 * Measured shapes (Playwright, real Cloud project — do not re-derive from docs):
 *  - query with a dead JWT: HTTP 401, code "PGRST301",
 *    message "No suitable key or wrong key type",
 *    details "None of the keys was able to decode the JWT".
 *  - offline query: code "", message "TypeError: Failed to fetch".
 *  - offline getUser(): AuthRetryableFetchError, status 0, message "Failed to fetch".
 *  - dead refresh token getUser(): AuthSessionMissingError, status 400.
 *
 * The whole point of the split below is that a wifi blip must NEVER sign a parent out:
 * a forced logout on a flaky connection is a worse bug than the one being fixed, and
 * looks identical from the parent's side.
 */

type LooseError = {
  name?: string;
  message?: string;
  code?: string | number | null;
  status?: number | null;
  details?: string | null;
  __isAuthError?: boolean;
};

function asLoose(error: unknown): LooseError {
  if (error && typeof error === "object") return error as LooseError;
  return { message: String(error ?? "") };
}

/** True for "I could not reach the server" — the case that must never redirect. */
export function isTransientNetworkError(error: unknown): boolean {
  const e = asLoose(error);
  const text = `${e.name ?? ""} ${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.name === "AuthRetryableFetchError" ||
    e.status === 0 ||
    /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|timeout|aborted/i.test(
      text,
    )
  );
}

/**
 * True when the error *shape* says the JWT was rejected. Never treated as proof on its
 * own — it only triggers the re-validation in `confirmSessionLost()`.
 */
export function isSessionLossError(error: unknown): boolean {
  if (!error) return false;
  if (isTransientNetworkError(error)) return false;
  const e = asLoose(error);
  const code = String(e.code ?? "");
  const text = `${e.message ?? ""} ${e.details ?? ""}`;
  if (code === "PGRST301" || code === "PGRST302" || code === "401") return true;
  if (e.status === 401) return true;
  if (e.name === "AuthSessionMissingError") return true;
  return /jwt expired|jwt is expired|invalid jwt|jwt.*malformed|no suitable key|able to decode the jwt|invalid claim|token is expired|refresh token not found|invalid refresh token/i.test(
    text,
  );
}

export type SessionCheck = "valid" | "lost" | "unreachable";

/**
 * Re-validates against the auth server. Three outcomes, deliberately not two:
 *  - "lost": the server responded and there is no valid user  -> safe to redirect.
 *  - "unreachable": the request never got an answer            -> MUST NOT redirect.
 *  - "valid": the session is fine, the query failed for some other reason.
 */
export async function checkSession(): Promise<SessionCheck> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Offline / DNS / timeout: getUser() cannot tell us anything. Assume nothing.
      if (isTransientNetworkError(error)) return "unreachable";
      /*
        Only the shapes actually measured for a dead session count as a verdict:
        AuthSessionMissingError, or an explicit 400/401 from the auth server. A 429, 500,
        502 or 503 means "the auth server failed to answer the question", NOT "there is no
        user" — treating those as a verdict would sign every parent out during a rate
        limit or an upstream hiccup, the same failure the offline path avoids.
      */
      const status = Number((error as { status?: number | null }).status ?? 0);
      const isVerdict =
        (error as { name?: string }).name === "AuthSessionMissingError" ||
        status === 400 ||
        status === 401;
      return isVerdict ? "lost" : "unreachable";
    }
    return data?.user ? "valid" : "lost";
  } catch (error) {
    // A throw here is a fetch-layer failure, not a verdict from the server.
    if (isTransientNetworkError(error)) return "unreachable";
    return "unreachable";
  }
}

/** Convenience wrapper: true ONLY for the confirmed "server said no user" case. */
export async function confirmSessionLost(): Promise<boolean> {
  return (await checkSession()) === "lost";
}

/*
  supabase-js emits SIGNED_OUT for BOTH an explicit sign-out and a refresh token that
  the server rejected (measured — identical event, identical payload). So the deliberate
  case marks itself, and anything unmarked is treated as a candidate session loss.
*/
const INTENT_KEY = "tigersden:intentional-signout";
const EXPIRED_KEY = "tigersden:session-expired";

/*
  The explanation is flagged in sessionStorage rather than relying on ?expired=1 alone:
  the beforeLoad gate can fire its own bare redirect to /auth a beat behind ours (via the
  root's router.invalidate on SIGNED_OUT) and strip the query string.
*/
export function markSessionExpired() {
  try {
    sessionStorage.setItem(EXPIRED_KEY, String(Date.now()));
  } catch {
    /* fall back to the ?expired=1 search param */
  }
}

/*
  Read, don't consume: the sign-in page can mount more than once during the redirect
  (our navigation, then the gate's own). Consuming on first mount lost the notice on the
  remount. The flag is cleared once the parent is signed in again.
*/
export function hasSessionExpiredNotice(): boolean {
  try {
    const at = Number(sessionStorage.getItem(EXPIRED_KEY) ?? 0);
    return at > 0 && Date.now() - at < 10 * 60 * 1000;
  } catch {
    return false;
  }
}

export function clearSessionExpiredNotice() {
  try {
    sessionStorage.removeItem(EXPIRED_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function markIntentionalSignOut() {
  try {
    sessionStorage.setItem(INTENT_KEY, String(Date.now()));
  } catch {
    /* private mode: worst case the parent sees an extra explanation */
  }
}

export function wasIntentionalSignOut(): boolean {
  try {
    const at = Number(sessionStorage.getItem(INTENT_KEY) ?? 0);
    return at > 0 && Date.now() - at < 15000;
  } catch {
    return false;
  }
}

/*
  The redirect itself lives in router.tsx (it owns the QueryClient and the router) and
  registers itself here, so both entry points — a failing query and a SIGNED_OUT event —
  go through one implementation.
*/
let redirectImpl: (() => Promise<void>) | null = null;

export function setSessionLossRedirect(fn: () => Promise<void>) {
  redirectImpl = fn;
}

/** Re-validates, then redirects only on a confirmed "server says no user". */
export async function redirectIfSessionLost(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if ((await checkSession()) !== "lost") return false;
  if (redirectImpl) await redirectImpl();
  return true;
}

let inFlight: Promise<boolean> | null = null;

/**
 * Single-flight: a burst of failing queries on one page must produce one getUser()
 * check and one redirect, not one per query.
 */
export async function handleMaybeSessionLoss(error: unknown): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isSessionLossError(error)) return false;
  return runOnce();
}

/** Same single-flight path, entered from the SIGNED_OUT auth event. */
export async function handleSignedOutEvent(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (wasIntentionalSignOut()) return false;
  return runOnce();
}

function runOnce(): Promise<boolean> {
  if (!inFlight) {
    inFlight = redirectIfSessionLost().finally(() => {
      // Allow a later, genuine loss to be handled again.
      setTimeout(() => {
        inFlight = null;
      }, 2000);
    });
  }
  return inFlight;
}
