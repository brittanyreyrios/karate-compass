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
      return "lost";
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

let inFlight: Promise<boolean> | null = null;

/**
 * Single-flight: a burst of failing queries on one page must produce one getUser()
 * check and one redirect, not one per query.
 */
export async function handleMaybeSessionLoss(
  error: unknown,
  onConfirmedLoss: () => void | Promise<void>,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!isSessionLossError(error)) return false;
  if (!inFlight) {
    inFlight = (async () => {
      const result = await checkSession();
      if (result !== "lost") return false;
      await onConfirmedLoss();
      return true;
    })().finally(() => {
      // Allow a later, genuine loss to be handled again.
      setTimeout(() => {
        inFlight = null;
      }, 2000);
    });
  }
  return inFlight;
}
