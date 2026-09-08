import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "../hooks/useApp";
import { getAppHomePath, isAppReadyUser } from "@/lib/account";
import { getUser, hasActiveSession } from "../services/userService";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const isConfigError =
    error.message.includes("VITE_SUPABASE_URL") || error.message.includes("VITE_SUPABASE_ANON_KEY");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isConfigError
            ? "Supabase environment variables are missing on this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy."
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/register"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go to login
          </a>
        </div>
      </div>
    </div>
  );
}

function PendingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Loading VetKonnect…</p>
    </div>
  );
}

const publicRoutes = new Set(["/", "/register", "/verify", "/modules", "/admin-login", "/admin", "/welcome"]);

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const pathname = location.pathname;

    // Session lives in localStorage — never block SSR on a network round-trip.
    if (typeof window === "undefined") {
      if (pathname === "/" || pathname === "/welcome") {
        throw redirect({ to: "/register" });
      }
      return;
    }

    try {
      if (pathname === "/" || pathname === "/welcome") {
        const session = await hasActiveSession();
        if (session) {
          const user = await getUser();
          throw redirect({ to: getAppHomePath(user) });
        }
        throw redirect({ to: "/register" });
      }

      if (publicRoutes.has(pathname)) {
        return;
      }

      const user = await getUser();
      if (!isAppReadyUser(user)) {
        throw redirect({ to: "/register" });
      }
    } catch (error) {
      // Preserve TanStack redirects / notFound throws.
      if (error != null && typeof error === "object" && ("isRedirect" in error || "to" in error || "statusCode" in error)) {
        throw error;
      }
      console.error("Auth check failed", error);
      if (!publicRoutes.has(pathname) && pathname !== "/") {
        throw redirect({ to: "/register" });
      }
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VetKonnect — Your pet care hub, connected." },
      {
        name: "description",
        content: "A premium digital pet healthcare companion for pet owners.",
      },
      { property: "og:title", content: "VetKonnect — Your pet care hub, connected." },
      { property: "og:description", content: "A premium digital pet healthcare companion for pet owners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VetKonnect — Your pet care hub, connected." },
      { name: "twitter:description", content: "A premium digital pet healthcare companion for pet owners." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  pendingComponent: PendingScreen,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="page-enter min-h-dvh">
      {children}
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <PageTransition>
          <Outlet />
        </PageTransition>
        <Toaster position="top-right" closeButton />
      </AppProvider>
    </QueryClientProvider>
  );
}
