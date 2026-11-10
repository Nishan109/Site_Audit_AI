"use client";
import { useEffect, useRef, useState } from "react";
import {
  importLighthouseReport,
  MAX_LIGHTHOUSE_FILE_SIZE,
} from "@/lib/lighthouse-import";
import {
  PAGE_SPEED_KEY_CHANNEL,
  hasPageSpeedMeasurements,
  pageSpeedResultSchema,
  validatedPageSpeedReports,
  type PageSpeedDevice,
  type PageSpeedReport,
} from "@/lib/pagespeed";
export interface PageSpeedFailure {
  message: string;
  code: string;
  keyConfigured?: boolean;
}
export function usePageSpeedResults(
  url: string,
  supplied?: Partial<Record<PageSpeedDevice, PageSpeedReport>>,
  onUpdated?: (report: PageSpeedReport) => void,
) {
  const [device, setDevice] = useState<PageSpeedDevice>("mobile");
  const [reports, setReports] = useState<
    Partial<Record<PageSpeedDevice, PageSpeedReport>>
  >(() =>
    Object.fromEntries(
      validatedPageSpeedReports(supplied, url).map((report) => [
        report.strategy,
        report,
      ]),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<PageSpeedFailure | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const retryUntil = useRef(0);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      typeof window.BroadcastChannel !== "function"
    )
      return;
    const channel = new BroadcastChannel(PAGE_SPEED_KEY_CHANNEL);
    channel.onmessage = (event) => {
      if (event.data !== "saved") return;
      retryUntil.current = 0;
      setRetryIn(0);
      setFailure((previous) =>
        previous?.code === "PAGESPEED_QUOTA" ||
        previous?.code === "PAGESPEED_CONFIGURATION"
          ? null
          : previous,
      );
    };
    return () => channel.close();
  }, []);
  useEffect(() => {
    if (!retryIn) return;
    const timer = setTimeout(
      () =>
        setRetryIn(
          Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearTimeout(timer);
  }, [retryIn]);
  const request = useRef<AbortController | null>(null);
  const updated = useRef(onUpdated);
  useEffect(() => {
    updated.current = onUpdated;
  }, [onUpdated]);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  const select = (value: PageSpeedDevice) => {
    if (value === device) return;
    request.current?.abort();
    request.current = null;
    setDevice(value);
    setLoading(false);
    setImporting(false);
    setImportError("");
    setNotice("");
    setFailure((previous) =>
      previous?.code === "PAGESPEED_QUOTA" ? previous : null,
    );
  };
  const saveReport = (report: PageSpeedReport) => {
    setReports((previous) => ({ ...previous, [report.strategy]: report }));
    updated.current?.(report);
  };
  const importFile = async (file: File) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setImporting(true);
    setImportError("");
    setNotice("");
    try {
      if (file.size > MAX_LIGHTHOUSE_FILE_SIZE)
        throw new Error("Choose a Lighthouse JSON file up to 10 MB.");
      const text = await file.text();
      if (request.current !== controller) return;
      saveReport(importLighthouseReport(text, url, device));
      setFailure(null);
      setNotice("Lighthouse lab measurements imported.");
    } catch (error) {
      if (request.current === controller)
        setImportError(
          error instanceof Error
            ? error.message
            : "The Lighthouse report could not be read.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setImporting(false);
      }
    }
  };
  const run = async () => {
    if (request.current || Date.now() < retryUntil.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailure(null);
    setImportError("");
    setNotice("");
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(90_000),
    ]);
    try {
      const response = await fetch("/api/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategy: device }),
        cache: "no-store",
        signal,
      });
      const body = await response.json().catch(() => null);
      if (controller.signal.aborted || request.current !== controller) return;
      signal.throwIfAborted();
      if (!response.ok) {
        const delay =
          body?.retryAfterSeconds ??
          Number(response.headers.get("Retry-After"));
        const retry =
          typeof delay === "number" && Number.isFinite(delay) && delay > 0
            ? Math.min(Math.ceil(delay), 86400)
            : 0;
        if (retry) {
          retryUntil.current = Date.now() + retry * 1000;
          setRetryIn(retry);
        }
        setFailure({
          message:
            typeof body?.error === "string"
              ? body.error
              : "Google could not complete the performance test. Try again.",
          code:
            typeof body?.code === "string"
              ? body.code
              : "PAGESPEED_UNAVAILABLE",
          keyConfigured:
            typeof body?.keyConfigured === "boolean"
              ? body.keyConfigured
              : undefined,
        });
        return;
      }
      const parsed = pageSpeedResultSchema.safeParse(body);
      if (
        !parsed.success ||
        parsed.data.method !== "google-pagespeed-v2" ||
        parsed.data.url !== url ||
        parsed.data.strategy !== device ||
        !hasPageSpeedMeasurements(parsed.data)
      )
        throw new Error(
          "The measurement response was incomplete or did not match this page and device. Please try again.",
        );
      saveReport(parsed.data);
      setNotice(
        `${device === "mobile" ? "Mobile" : "Desktop"} results collected.`,
      );
    } catch (error) {
      if (controller.signal.aborted || request.current !== controller) return;
      setFailure({
        code:
          error instanceof Error && error.name === "TimeoutError"
            ? "PAGESPEED_TIMEOUT"
            : "PAGESPEED_UNAVAILABLE",
        message:
          error instanceof Error && error.name === "TimeoutError"
            ? "The performance test took longer than expected. Try again or open Google's report."
            : error instanceof Error
              ? error.message
              : "The performance test could not be completed.",
      });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  };
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setLoading(false);
    setFailure(null);
    setNotice("Test cancelled.");
  };
  return {
    device,
    reports,
    report: reports[device],
    loading,
    importing,
    importError,
    notice,
    failure,
    retryIn,
    select,
    importFile,
    dismissImportError: () => setImportError(""),
    run,
    cancel,
  };
}
