import createClient from "openapi-fetch";
import { getActorName } from "@/lib/remembered-parties";
import { ACTOR_NAME_HEADER } from "./config";
import type { paths } from "./schema";

const PARTY_PATH = /^\/api\/parties\/([^/]+)(?:\/|$)/;

function partyIdFromPath(pathname: string): string | undefined {
  return PARTY_PATH.exec(pathname)?.[1];
}

/**
 * Create a typed API client for the given base URL.
 *
 * In the browser the base URL is empty (same-origin) so requests go through the
 * Next.js BFF proxy at /api/*. The real .NET API base URL lives only on the
 * server, in the proxy route handler.
 */
export function createApiClient(baseUrl: string) {
  const client = createClient<paths>({ baseUrl });

  // Attach the actor name once, here, rather than at each call site: a new mutation then cannot
  // forget it. The name is per party, so it is looked up from the path being called.
  client.use({
    onRequest({ request }) {
      if (request.method === "GET" || request.method === "HEAD") {
        return request;
      }

      const partyId = partyIdFromPath(new URL(request.url).pathname);
      const actorName = partyId ? getActorName(partyId) : undefined;
      if (actorName) {
        request.headers.set(ACTOR_NAME_HEADER, actorName);
      }

      return request;
    },
  });

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
