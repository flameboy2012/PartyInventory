import { useEffect, useRef } from "react";
import { HttpTransportType, HubConnectionBuilder } from "@microsoft/signalr";

/**
 * Subscribes to real-time "party changed" pings for a party and runs `onChanged`
 * (typically a revalidate) when one arrives.
 *
 * Uses long-polling so the connection goes through the same-origin BFF proxy
 * (/api/hubs/party) rather than a direct WebSocket to the API.
 */
export function usePartyRealtime(partyId: string, onChanged: () => void) {
  // Keep the latest callback without re-establishing the connection each render.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl("/api/hubs/party", { transport: HttpTransportType.LongPolling })
      .withAutomaticReconnect()
      .build();

    connection.on("partyChanged", () => onChangedRef.current());
    connection.onreconnected(() => {
      connection.invoke("JoinParty", partyId).catch(() => {});
    });

    let active = true;
    connection
      .start()
      .then(() => (active ? connection.invoke("JoinParty", partyId) : undefined))
      .catch(() => {
        // Realtime is best-effort; the app still works without it.
      });

    return () => {
      active = false;
      void connection.stop();
    };
  }, [partyId]);
}
