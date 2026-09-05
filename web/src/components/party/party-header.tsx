"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { PartyResponse } from "@/lib/api/types";

export function PartyHeader({ party }: { party: PartyResponse }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] leading-4 text-muted-foreground">Party</p>
        <h1 className="truncate text-xl leading-[26px] font-semibold tracking-[-0.015em] md:text-[26px] md:leading-8 md:tracking-[-0.02em]">
          {party.name}
        </h1>
      </div>
      <ShareCode code={party.joinCode} />
    </div>
  );
}

type CopyState = "idle" | "copied" | "selected";

/**
 * Copies the join code in one press.
 *
 * `navigator.clipboard` needs a secure context, and players commonly reach this app over plain
 * HTTP on a LAN, where it is undefined. There the code is selected instead so it can be copied by
 * hand, and nothing claims a copy that did not happen.
 */
function ShareCode({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const codeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  function selectCode() {
    const node = codeRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        setState("copied");
        return;
      } catch {
        // Permission refused, or a context that only looks secure. Fall through to selecting.
      }
    }
    selectCode();
    setState("selected");
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 items-center gap-1.5 rounded-4xl border border-border px-3 transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8"
      >
        <span className="text-xs text-muted-foreground">Share code:</span>
        <span ref={codeRef} className="font-mono text-xs font-medium select-all">
          {code}
        </span>
        {state === "copied" ? (
          <Check className="size-3.5 text-muted-foreground" />
        ) : (
          <Copy className="size-3.5 text-muted-foreground" />
        )}
      </button>
      <p aria-live="polite" className="mt-0.5 h-4 text-[11px] text-muted-foreground">
        {state === "copied" && "Copied"}
        {state === "selected" && "Selected — copy it by hand"}
      </p>
    </div>
  );
}
