"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { pendingWebsite, rememberWebsite, type Account } from "@/lib/auth";
import accountStyles from "./Account.module.css";
import type { AuditResult, AppState, FixStep } from "@/lib/types";
import AppShell from "@/components/AppShell";
import WorkspaceHome from "@/components/WorkspaceHome";
import HeroSection from "@/components/HeroSection";
import LoadingState, {
  InterruptedReviewActivity,
} from "@/components/LoadingState";
import ReportHeader from "@/components/ReportHeader";
import TabPanel from "@/components/TabPanel";
import PrintReport from "@/components/PrintReport";
import AuditEvidence from "@/components/AuditEvidence";
import DashboardOverview from "@/components/DashboardOverview";
import Icon from "@/components/Icon";
import reviewStyles from "@/components/ReviewWorkspace.module.css";
import { REPORT_NAV, type ReportSection } from "@/components/navigation";
import {
  applySecurityRefresh,
  type SecurityRefresh,
} from "@/lib/security-refresh";
import {
  applyAccessibilityRefresh,
  type AccessibilityRefresh,
} from "@/lib/accessibility-refresh";
import type { PageSpeedReport } from "@/lib/pagespeed";
import {
  applyReviewEvent,
  REVIEW_STREAM,
  reviewClock,
  type ReviewProgress,
} from "@/lib/review-progress";
import { readReviewResponse, ReviewResponseError } from "@/lib/review-response";

export default function ReviewWorkspace({
  account,
  initialReport,
  history,
  publicLanding = false,
}: {
  account: Account | null;
  initialReport?: AuditResult;
  history?: ReactNode;
  publicLanding?: boolean;
}) {
  const [appState, setAppState] = useState<AppState>(
    initialReport ? "results" : "idle",
  );
  const [result, setResult] = useState<AuditResult | null>(
    initialReport || null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [progress, setProgress] = useState<ReviewProgress>({
    startedAt: 0,
    serverElapsedMs: 0,
    stages: {},
  });
  const [stoppedAfter, setStoppedAfter] = useState<number>();
  const [reviewNotice, setReviewNotice] = useState("");
  const [generatedFixSteps, setGeneratedFixSteps] = useState<
    Record<string, FixStep[]>
  >({});
  const [section, setSection] = useState<ReportSection>("overview");
  const navigateToSection = useCallback((next: ReportSection) => {
    setSection(next);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, []);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  useEffect(() => {
    if (appState === "results")
      document.getElementById("report-title")?.focus({ preventScroll: true });
    if (appState === "idle" && reviewNotice)
      document.getElementById("url-input")?.focus();
  }, [appState, reviewNotice]);
  useEffect(() => {
    // Restore browser-only storage after hydration, before enabling submission.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (account) setSubmittedUrl(pendingWebsite());
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!account) return;
    const identityCheck = new AbortController();
    const checkAccount = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/account", {
          cache: "no-store",
          signal: AbortSignal.any([
            identityCheck.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        if (response.status !== 401 && !response.ok) return;
        const current = response.ok ? await response.json() : null;
        if (identityCheck.signal.aborted || current?.id === account.id) return;
        request.current?.abort();
        request.current = null;
        setResult(null);
        setGeneratedFixSteps({});
        window.location.replace("/login");
      } catch {
        /* Keep the current view during a temporary connection failure. */
      }
    };
    window.addEventListener("focus", checkAccount);
    document.addEventListener("visibilitychange", checkAccount);
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        (event === "SIGNED_IN" && session?.user.id !== account.id)
      ) {
        request.current?.abort();
        request.current = null;
        setResult(null);
        setGeneratedFixSteps({});
        window.location.replace("/login");
      }
    });
    return () => {
      identityCheck.abort();
      window.removeEventListener("focus", checkAccount);
      document.removeEventListener("visibilitychange", checkAccount);
      data.subscription.unsubscribe();
    };
  }, [account]);
  const handleAnalyze = useCallback(
    async (url: string) => {
      url = url.trim();
      if (!account) {
        rememberWebsite(url);
        window.location.assign("/signup?notice=review");
        return;
      }
      if (publicLanding) {
        rememberWebsite(url);
        window.location.assign("/workspace");
        return;
      }
      request.current?.abort();
      const controller = new AbortController();
      const deadline = AbortSignal.timeout(175_000);
      const signal = AbortSignal.any([controller.signal, deadline]);
      const startedAt = performance.now();
      request.current = controller;
      setAppState("loading");
      setSubmittedUrl(url);
      setResult(null);
      setErrorMessage("");
      setErrorCode("");
      setReviewNotice("");
      setStoppedAfter(undefined);
      setProgress({ startedAt, serverElapsedMs: 0, stages: {} });
      setGeneratedFixSteps({});
      setSection("overview");
      window.scrollTo({ top: 0, behavior: "instant" });
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: REVIEW_STREAM,
          },
          body: JSON.stringify({ url }),
          cache: "no-store",
          signal,
        });
        const data = await readReviewResponse(response, signal, (event) => {
          if (signal.aborted || request.current !== controller) return;
          const receivedAt = performance.now();
          setProgress((current) =>
            current.startedAt === startedAt
              ? applyReviewEvent(current, event, receivedAt)
              : current,
          );
        });
        signal.throwIfAborted();
        if (request.current !== controller) return;
        const identity = await fetch("/api/account", {
          cache: "no-store",
          signal,
        });
        const current = identity.ok ? await identity.json() : null;
        signal.throwIfAborted();
        if (request.current !== controller) return;
        if (current?.id !== account.id) {
          setResult(null);
          window.location.replace("/login");
          return;
        }
        if (initialReport && data.storage?.status === "saved") {
          window.location.assign("/workspace/audits/" + data.storage.reportId);
          return;
        }
        setResult(data);
        setReviewNotice(
          `Review complete. Time elapsed ${reviewClock(performance.now() - startedAt)}.`,
        );
        setAppState("results");
      } catch (error) {
        if (controller.signal.aborted || request.current !== controller) return;
        const failure = deadline.aborted
          ? new ReviewResponseError(
              "This review took longer than expected. You can retry the same page.",
              "ANALYSIS_TIMEOUT",
            )
          : error instanceof ReviewResponseError
            ? error
            : new ReviewResponseError(
                "The connection ended before the report arrived. You can retry the same page.",
                "REVIEW_CONNECTION_LOST",
              );
        setStoppedAfter(performance.now() - startedAt);
        setErrorCode(failure.code);
        setErrorMessage(failure.message);
        setAppState("error");
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [account, initialReport, publicLanding],
  );
  const newAudit = useCallback(() => {
    if (initialReport) {
      window.location.assign("/workspace");
      return;
    }
    setReviewNotice(
      request.current
        ? "Review canceled. Your website address is ready to review again."
        : "",
    );
    request.current?.abort();
    request.current = null;
    setAppState("idle");
    setResult(null);
    setErrorMessage("");
    setErrorCode("");
    setStoppedAfter(undefined);
    setGeneratedFixSteps({});
    setSection("overview");
  }, [initialReport]);
  const onFixStepsLoaded = useCallback(
    (title: string, steps: FixStep[]) =>
      setGeneratedFixSteps((previous) => ({ ...previous, [title]: steps })),
    [],
  );
  const onResearchUpdated = useCallback(
    (research: NonNullable<AuditResult["research"]>) =>
      setResult((previous) =>
        previous
          ? {
              ...previous,
              research,
              searchQueries: [
                ...new Set([...previous.searchQueries, ...research.queries]),
              ],
              sources: [...new Set([...previous.sources, ...research.sources])],
              warnings: previous.warnings?.filter(
                (warning) =>
                  !warning.startsWith("Web research was unavailable"),
              ),
              agentSteps: previous.agentSteps.map((step) =>
                step.name === "Research Agent"
                  ? {
                      ...step,
                      status: "completed",
                      detail: `${research.provider}: ${research.queries.length} search queries and ${research.sources.length} sources, synthesized by ${research.modelUsed}. Refreshed ${new Date(research.searchedAt).toLocaleString()}; content findings retained.`,
                    }
                  : step,
              ),
            }
          : previous,
      ),
    [],
  );
  const onSecurityUpdated = useCallback(
    (update: SecurityRefresh, reportId: string) => {
      setResult((previous) => applySecurityRefresh(previous, update, reportId));
    },
    [],
  );
  const onAccessibilityUpdated = useCallback(
    (update: AccessibilityRefresh, reportId: string) => {
      setResult((previous) =>
        applyAccessibilityRefresh(previous, update, reportId),
      );
    },
    [],
  );
  const onPageSpeedUpdated = useCallback(
    (report: PageSpeedReport, reportId: string) => {
      setResult((previous) =>
        previous &&
        previous.url === report.url &&
        (previous.analysisId || previous.analyzedAt) === reportId
          ? {
              ...previous,
              pageSpeedReports: {
                ...previous.pageSpeedReports,
                [report.strategy]: report,
              },
            }
          : previous,
      );
    },
    [],
  );
  const domain = result
    ? new URL(result.url).hostname.replace(/^www\./, "")
    : undefined;
  const current = REPORT_NAV.find((item) => item.key === section)!;
  const isSpecialistWorkspace = [
    "messaging",
    "ux",
    "seo",
    "conversion",
    "quickwins",
    "aeo",
    "security",
    "accessibility",
    "performance",
  ].includes(section);
  const counts: Partial<Record<ReportSection, number>> = result
    ? {
        overview: result.topIssues.length,
        messaging: result.messaging.length,
        ux: result.ux.length,
        seo: result.seo.length,
        conversion: result.conversion.length,
        quickwins: result.quickWins.length,
      }
    : {};
  return (
    <>
      <AppShell
        hasResult={!!result}
        isLoading={appState === "loading"}
        section={section}
        onSectionChange={setSection}
        onNewAudit={newAudit}
        domain={domain}
        account={account}
        publicLanding={publicLanding}
      >
        <p role="status" className="sr-only">
          {reviewNotice}
        </p>
        {appState === "loading" ? (
          <LoadingState
            url={submittedUrl}
            progress={progress}
            onCancel={newAudit}
          />
        ) : appState !== "results" ? (
          <>
            {errorMessage && (
              <div className="error-banner" role="alert">
                <Icon name="info" />
                <div>
                  <strong>We couldn’t finish that audit.</strong>
                  <p>{errorMessage}</p>
                  {stoppedAfter !== undefined && (
                    <p>Time elapsed · {reviewClock(stoppedAfter)}</p>
                  )}
                  <div
                    className={reviewStyles.actions}
                    style={{ marginTop: 10 }}
                  >
                    {errorCode !== "INVALID_URL" &&
                      errorCode !== "INSUFFICIENT_EVIDENCE" && (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => void handleAnalyze(submittedUrl)}
                        >
                          <Icon name="refresh" width="14" height="14" />
                          Retry this page
                        </button>
                      )}
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() =>
                        document.getElementById("url-input")?.focus()
                      }
                    >
                      Edit website address
                    </button>
                  </div>
                  <InterruptedReviewActivity progress={progress} />
                </div>
                <button
                  className="icon-button"
                  onClick={() => setErrorMessage("")}
                  aria-label="Dismiss error"
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            {account && !publicLanding ? (
              <WorkspaceHome
                url={submittedUrl}
                onUrlChange={setSubmittedUrl}
                onSubmit={(url) => void handleAnalyze(url)}
                ready={draftReady}
                history={history}
              />
            ) : (
              <HeroSection
                onSubmit={handleAnalyze}
                isLoading={false}
                initialUrl={submittedUrl}
              />
            )}
          </>
        ) : (
          result && (
            <div className="report-page">
              {account && (
                <div className={accountStyles.saved} role="status">
                  {initialReport
                    ? "Saved audit · recorded snapshot"
                    : result.storage?.status === "saved"
                      ? "Saved to your audit history."
                      : result.storage?.status === "unavailable"
                        ? result.storage.reason
                        : "This review is available in the current session."}
                  {!initialReport && result.storage?.status === "saved" && (
                    <Link href={"/workspace/audits/" + result.storage.reportId}>
                      Open saved report
                    </Link>
                  )}
                  <span>
                    Later edits and optional checks stay in this session. Export
                    your updated view to keep them.
                  </span>
                </div>
              )}
              <ReportHeader
                key={result.analysisId || result.analyzedAt}
                result={result}
                onRerun={() => void handleAnalyze(result.url)}
              />
              <div className="mobile-section-select">
                <label htmlFor="report-section">Explore your report</label>
                <select
                  id="report-section"
                  value={section}
                  onChange={(event) =>
                    setSection(event.target.value as ReportSection)
                  }
                >
                  {["Your report", "Deeper insights", "Growth tools"].map(
                    (group) => (
                      <optgroup label={group} key={group}>
                        {REPORT_NAV.filter((item) => item.group === group).map(
                          (item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ),
                        )}
                      </optgroup>
                    ),
                  )}
                </select>
                <Icon name="down" width="16" height="16" />
              </div>
              <div hidden={section !== "overview"}>
                <DashboardOverview
                  key={result.analysisId || result.analyzedAt}
                  result={result}
                  onNavigate={navigateToSection}
                />
              </div>
              {section !== "overview" && (
                <div
                  className={`report-section-heading ${isSpecialistWorkspace ? reviewStyles.sectionHeader : ""}`}
                >
                  <div>
                    {!isSpecialistWorkspace && (
                      <span className="section-kicker">{current.group}</span>
                    )}
                    <h2>
                      {current.label}
                      {!isSpecialistWorkspace &&
                        counts[section] !== undefined && (
                          <span className="count-badge">{counts[section]}</span>
                        )}
                    </h2>
                    {!isSpecialistWorkspace && <p>{current.description}</p>}
                  </div>
                  <button
                    className="button button-quiet back-to-overview"
                    onClick={() => setSection("overview")}
                  >
                    <Icon name="grid" width="15" height="15" />
                    All findings
                  </button>
                </div>
              )}
              <TabPanel
                result={result}
                activeTab={section}
                generatedFixSteps={generatedFixSteps}
                onFixStepsLoaded={onFixStepsLoaded}
                onNavigate={navigateToSection}
                onSecurityUpdated={onSecurityUpdated}
                onAccessibilityUpdated={onAccessibilityUpdated}
                onPageSpeedUpdated={onPageSpeedUpdated}
              />
              <div className="report-transparency">
                <AuditEvidence
                  key={result.analysisId || result.analyzedAt}
                  result={result}
                  onResearchUpdated={onResearchUpdated}
                />
              </div>
            </div>
          )
        )}
      </AppShell>
      {result && (
        <PrintReport result={result} generatedFixSteps={generatedFixSteps} />
      )}
    </>
  );
}
