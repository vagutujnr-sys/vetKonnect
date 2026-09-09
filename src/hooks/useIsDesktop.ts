import { useEffect, useState } from "react";

/** Client-only matchMedia helper. */
export function useIsDesktop(minWidthPx = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(min-width: ${minWidthPx}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [minWidthPx]);

  return isDesktop;
}
