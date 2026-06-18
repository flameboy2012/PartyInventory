import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Create a typed API client bound to the given base URL.
 *
 * The base URL is supplied at runtime (read from process.env on the server and
 * passed to the client provider) rather than inlined at build time, so a single
 * build/Docker image can target different API hosts per environment.
 */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
