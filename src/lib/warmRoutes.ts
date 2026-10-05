import type { AnyRouter } from "@tanstack/react-router";

const signInDestinations = ["/home", "/modules", "/vet", "/patients"] as const;

/** Load the screens a PIN can open, so the fifth digit does not wait on them. */
export function warmSignInDestinations(router: AnyRouter) {
  for (const to of signInDestinations) {
    void router.preloadRoute({ to }).catch(() => undefined);
  }
}
