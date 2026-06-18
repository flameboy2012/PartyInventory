"use client";

import { createContext, useContext, useMemo } from "react";
import { SWRConfig } from "swr";
import { createApiClient, type ApiClient } from "@/lib/api/client";

type ApiContextValue = { baseUrl: string; client: ApiClient };

const ApiContext = createContext<ApiContextValue | null>(null);

/**
 * Provides the API base URL (resolved at request time on the server) to client
 * components, along with a typed API client and a default SWR fetcher.
 */
export function ApiProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}) {
  const value = useMemo<ApiContextValue>(
    () => ({ baseUrl, client: createApiClient(baseUrl) }),
    [baseUrl],
  );

  const fetcher = useMemo(
    () => async (path: string) => {
      const res = await fetch(`${baseUrl}${path}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Request to ${path} failed (${res.status})`);
      }
      return res.json();
    },
    [baseUrl],
  );

  return (
    <ApiContext.Provider value={value}>
      <SWRConfig value={{ fetcher }}>{children}</SWRConfig>
    </ApiContext.Provider>
  );
}

function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("useApi/useApiBaseUrl must be used within <ApiProvider>");
  }
  return ctx;
}

/** The typed API client (openapi-fetch) bound to the runtime base URL. */
export const useApi = (): ApiClient => useApiContext().client;

/** The runtime API base URL. */
export const useApiBaseUrl = (): string => useApiContext().baseUrl;
