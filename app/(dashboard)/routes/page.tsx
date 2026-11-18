import { RoutesClient } from "./routes-client";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ route?: string | string[]; vacancy?: string | string[] }>;
}) {
  const { route, vacancy } = await searchParams;
  return (
    <RoutesClient
      initialRouteId={typeof route === "string" ? route : null}
      initialVacancy={vacancy === "vacant" || vacancy === "assigned" ? vacancy : null}
    />
  );
}
