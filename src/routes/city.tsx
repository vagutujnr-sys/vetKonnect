import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/city")({
  beforeLoad: () => {
    throw redirect({ to: "/council" });
  },
  component: () => null,
});
