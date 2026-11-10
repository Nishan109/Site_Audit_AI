"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SecurityAudit } from "@/lib/types";
import {
  securityRefreshSchema,
  validatedSecurityAudit,
  type SecurityRefresh,
} from "@/lib/security-refresh";
import { sourceURL } from "@/lib/source-url";

export function useSecurityResults(
  url: string,
  supplied: SecurityAudit | undefined,
  onUpdated?: (update: SecurityRefresh) => void,
  active = true,
) {
  const saved = useMemo(
    () => validatedSecurityAudit(supplied, url),
    [supplied, url],
  );
  const [state, setState] = useState<{
    url: string;
    pending?: AbortSignal;
    data?: SecurityRefresh;
    error: string;
  }>({ url, error: "" });
  const request = useRef<AbortController | null>(null);
  const updated = useRef(onUpdated);
  useEffect(() => {
    updated.current = onUpdated;
  }, [onUpdated]);
  const refresh = useCallback(async () => {
    if (!active || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(60_000),
    ]);
    setState((previous) => ({
      url,
      pending: controller.signal,
      data: previous.url === url ? previous.data : undefined,
      error: "",
    }));
    try {
      const response = await fetch("/api/security-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        cache: "no-store",
        signal,
      });
      const body = await response.json().catch(() => null);
      signal.throwIfAborted();
      if (!response.ok)
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Security results could not be collected. Try again.",
        );
      const parsed = securityRefreshSchema.safeParse(body);
      if (
        !parsed.success ||
        sourceURL(parsed.data.requestedUrl) !== sourceURL(url)
      )
        throw new Error(
          "The security response was incomplete or did not match this website. Try again.",
        );
      if (controller.signal.aborted || request.current !== controller) return;
      setState({ url, data: parsed.data, error: "" });
      updated.current?.(parsed.data);
    } catch (error) {
      if (controller.signal.aborted || request.current !== controller) return;
      setState((previous) => ({
        url,
        data: previous.url === url ? previous.data : undefined,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "Security checks took longer than expected. Try again."
            : error instanceof Error
              ? error.message
              : "Security results could not be collected. Try again.",
      }));
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [active, url]);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [active, url],
  );

  const current = state.url === url ? state : undefined;
  const audit = current?.data?.audit ?? saved;
  const error = current?.error ?? "";
  const needsInitialCollection = !audit && !error;
  useEffect(() => {
    if (!active || !needsInitialCollection) return;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void refresh();
    });
    return () => {
      disposed = true;
    };
  }, [active, needsInitialCollection, refresh]);
  return {
    audit,
    loading:
      active &&
      (needsInitialCollection ||
        (!!current?.pending && !current.pending.aborted)),
    error,
    refresh,
  };
}
