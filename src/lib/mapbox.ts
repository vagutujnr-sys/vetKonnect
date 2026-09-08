export function getMapboxToken(): string {
  return (
    (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) ||
    (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ||
    (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
    ""
  );
}
