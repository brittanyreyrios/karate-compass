import * as React from "react";

// Round 48: iPad portrait is 1024px wide. At or below that the sidebar becomes
// a sheet behind the header menu button instead of a persistent 255px rail, so
// tablet portrait gets the full content width. The bound is inclusive on
// purpose — an exclusive 1024 would leave iPad portrait on the desktop rail,
// which is the layout this round exists to remove.
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
