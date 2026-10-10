import "./lib/sessionScope";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { warmSignInDestinations } from "./lib/warmRoutes";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingMs: 120,
    defaultPendingMinMs: 200,
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    queueMicrotask(() => warmSignInDestinations(router));
  }

  return router;
};
