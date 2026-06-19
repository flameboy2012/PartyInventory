"use client";

import { createContext, useContext, useMemo } from "react";
import { SWRConfig } from "swr";
import { createApiClient, type ApiClient } from "@/lib/api/client";

const ApiContext = createContext<ApiClient | null>(null);

/**
 * Default SWR fetcher. Calls are same-origin and go through the Next.js BFF
 * proxy (app/api/[...path]), which forwards to the .NET API server-side.
 */
const fetcher = async (path: string) => {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  return response.json();
};

export function ApiProvider({ children }: { children: React.ReactNode }) {
  // Empty base URL → relative, same-origin requests to the BFF proxy.
  const client = useMemo(() => createApiClient(""), []);

  return (
    <ApiContext.Provider value={client}>
      <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
    </ApiContext.Provider>
  );
}

/** The typed API client (openapi-fetch) that targets the same-origin BFF proxy. */
export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error("useApi must be used within <ApiProvider>");
  }
  return client;
}
