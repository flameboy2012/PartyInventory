import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Create a typed API client for the given base URL.
 *
 * In the browser the base URL is empty (same-origin) so requests go through the
 * Next.js BFF proxy at /api/*. The real .NET API base URL lives only on the
 * server, in the proxy route handler.
 */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
