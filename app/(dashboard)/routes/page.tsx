import { RoutesClient } from "./routes-client";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string | string[] }>;
}) {
  const { route } = await searchParams;
  return <RoutesClient initialRouteId={typeof route === "string" ? route : null} />;
}
