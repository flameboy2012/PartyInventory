/**
 * Fallback .NET API base URL used by the BFF proxy (server-side) when the
 * API_BASE_URL environment variable is unset, e.g. during local development.
 */
export const DEFAULT_API_BASE_URL = "http://localhost:5140";

/**
 * Header the API requires on every write, naming the player who made the change. Lives here so
 * both the browser client and the server-side proxy can use it.
 */
export const ACTOR_NAME_HEADER = "X-Actor-Name";
