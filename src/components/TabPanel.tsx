"use client";

import { useMemo, useState } from "react";
import { dashboardModel } from "@/lib/dashboard";
import { AuditResult, FixStep } from "@/lib/types";
import QuickWinsSection from "./QuickWinsSection";
import AccessibilitySection from "./AccessibilitySection";
import Icon from "./Icon";
import AdCreativeStudio from "./AdCreativeStudio";
import CreativeComparison from "./CreativeComparison";
import MessagingSection from "./MessagingSection";
import UXSection from "./UXSection";
import SEOSection from "./SEOSection";
import ConversionSection from "./ConversionSection";
import AIVisibilitySection from "./AIVisibilitySection";
import SecuritySection from "./SecuritySection";
import PageSpeedSection from "./PageSpeedSection";
import type { PageSpeedReport } from "@/lib/pagespeed";
import type { SecurityRefresh } from "@/lib/security-refresh";
import type { AccessibilityRefresh } from "@/lib/accessibility-refresh";

import type { ReportSection as TabKey } from "./navigation";

interface TabPanelProps {
  activeTab: TabKey;
  onPageSpeedUpdated?: (report: PageSpeedReport, reportId: string) => void;
  result: AuditResult;
  generatedFixSteps: Record<string, FixStep[]>;
  onFixStepsLoaded: (title: string, steps: FixStep[]) => void;
  onNavigate?: (section: TabKey) => void;
  onSecurityUpdated?: (update: SecurityRefresh, reportId: string) => void;
  onAccessibilityUpdated?: (
    update: AccessibilityRefresh,
    reportId: string,
  ) => void;
}

interface BattlecardsState {
  competitors: Array<{
    name: string;
    url: string;
    positioning: string;
    advantage: string;
  }>;
}

export default function TabPanel({
  result,
  activeTab,
  generatedFixSteps,
  onFixStepsLoaded,
  onNavigate,
  onSecurityUpdated,
  onAccessibilityUpdated,
  onPageSpeedUpdated,
}: TabPanelProps) {
  const { pageRecords, collectedPages } = useMemo(() => {
    const pageRecords = dashboardModel(result).pages;
    return { pageRecords, collectedPages: pageRecords.map((page) => page.url) };
  }, [result]);
  const [battlecards, setBattlecards] = useState<BattlecardsState | null>(null);
  const [loadingBattlecards, setLoadingBattlecards] = useState(false);
  const [battlecardsError, setBattlecardsError] = useState<string | null>(null);

  const triggerSpyAgent = async () => {
    setLoadingBattlecards(true);
    setBattlecardsError(null);
    try {
      const res = await fetch("/api/competitor-battlecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "Competitor research could not be completed.",
        );
      setBattlecards(data);
    } catch (err) {
      setBattlecardsError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setLoadingBattlecards(false);
    }
  };

  return (
    <div className="report-content" id="tab-panel">
      <div hidden={activeTab !== "adgenerator"}>
        <AdCreativeStudio key={result.url} url={result.url} />
      </div>
      <div hidden={activeTab !== "comparator"}>
        <CreativeComparison key={result.url} url={result.url} />
      </div>
      <div hidden={activeTab !== "messaging"}>
        <MessagingSection
          key={result.analysisId || result.analyzedAt}
          collectedPages={collectedPages}
          analysis={result.messagingAnalysis}
          issues={result.messaging || []}
          url={result.url}
          generatedFixSteps={generatedFixSteps}
          onFixStepsLoaded={onFixStepsLoaded}
        />
      </div>
      <div hidden={activeTab !== "seo"}>
        <SEOSection
          key={result.analysisId || result.analyzedAt}
          collectedPages={collectedPages}
          analysis={result.seoAnalysis}
          issues={result.seo || []}
          url={result.url}
          generatedFixSteps={generatedFixSteps}
          onFixStepsLoaded={onFixStepsLoaded}
        />
      </div>
      <div hidden={activeTab !== "ux"}>
        <UXSection
          key={result.analysisId || result.analyzedAt}
          collectedPages={collectedPages}
          analysis={result.uxAnalysis}
          issues={result.ux || []}
          url={result.url}
          generatedFixSteps={generatedFixSteps}
          onFixStepsLoaded={onFixStepsLoaded}
        />
      </div>
      <div hidden={activeTab !== "conversion"}>
        <ConversionSection
          key={result.analysisId || result.analyzedAt}
          collectedPages={result.pagesAnalyzed ? collectedPages : undefined}
          analysis={result.conversionAnalysis}
          issues={result.conversion || []}
          url={result.url}
          generatedFixSteps={generatedFixSteps}
          onFixStepsLoaded={onFixStepsLoaded}
        />
      </div>
      <div hidden={activeTab !== "quickwins"}>
        <QuickWinsSection
          key={result.analysisId || result.analyzedAt}
          generatedFixSteps={generatedFixSteps}
          quickWins={result.quickWins || []}
          url={result.url}
          selection={result.quickWinsSelection}
          findingCounts={{
            messaging: result.messaging.length,
            ux: result.ux.length,
            seo: result.seo.length,
            conversion: result.conversion.length,
          }}
          onNavigate={onNavigate}
        />
      </div>
      <div hidden={activeTab !== "performance"}>
        <PageSpeedSection
          key={result.analysisId || result.analyzedAt}
          url={result.url}
          reports={result.pageSpeedReports}
          onUpdated={(report) =>
            onPageSpeedUpdated?.(report, result.analysisId || result.analyzedAt)
          }
        />
      </div>
      <div hidden={activeTab !== "aeo"}>
        <AIVisibilitySection
          key={result.analysisId || result.analyzedAt}
          analysis={result.aeoAnalysis}
          collectedPages={result.pagesAnalyzed ? pageRecords : undefined}
          url={result.url}
          generatedFixSteps={generatedFixSteps}
          onFixStepsLoaded={onFixStepsLoaded}
        />
      </div>
      <div hidden={activeTab !== "security"}>
        <SecuritySection
          key={result.analysisId || result.analyzedAt}
          active={activeTab === "security"}
          audit={result.securityAudit}
          onSecurityUpdated={(update) =>
            onSecurityUpdated?.(update, result.analysisId || result.analyzedAt)
          }
          url={result.url}
          generatedFixSteps={generatedFixSteps}
        />
      </div>
      <div hidden={activeTab !== "accessibility"}>
        <AccessibilitySection
          key={result.analysisId || result.analyzedAt}
          active={activeTab === "accessibility"}
          audit={result.accessibilityAudit}
          url={result.url}
          onAccessibilityUpdated={(update) =>
            onAccessibilityUpdated?.(update, result.analysisId || result.analyzedAt)
          }
        />
      </div>
      {/* Tab Content */}
      <div className="section-panel" key={activeTab}>
        {activeTab === "battlecards" && (
          <div className="space-y-6">
            {/* SWOT Analysis Matrix */}
            {result.swotAnalysis && (
              <div
                className="rounded-2xl p-6 space-y-4 border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                  Your strategic perspective
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{
                      background: "rgba(34, 197, 94, 0.02)",
                      borderColor: "rgba(34, 197, 94, 0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <h5 className="text-[11px] font-bold uppercase tracking-widest text-green-400">
                        Strengths
                      </h5>
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-[var(--muted)] font-light leading-relaxed">
                      {result.swotAnalysis.strengths.map((item, idx) => (
                        <li key={idx}>{item.text}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{
                      background: "rgba(239, 68, 68, 0.02)",
                      borderColor: "rgba(239, 68, 68, 0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <h5 className="text-[11px] font-bold uppercase tracking-widest text-red-400">
                        Weaknesses
                      </h5>
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-[var(--muted)] font-light leading-relaxed">
                      {result.swotAnalysis.weaknesses.map((item, idx) => (
                        <li key={idx}>{item.text}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Opportunities */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{
                      background: "rgba(245, 158, 11, 0.02)",
                      borderColor: "rgba(245, 158, 11, 0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <h5 className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                        Opportunities
                      </h5>
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-[var(--muted)] font-light leading-relaxed">
                      {result.swotAnalysis.opportunities.map((item, idx) => (
                        <li key={idx}>{item.text}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Threats */}
                  <div
                    className="rounded-xl p-4 border"
                    style={{
                      background: "rgba(139, 92, 246, 0.02)",
                      borderColor: "rgba(139, 92, 246, 0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <h5 className="text-[11px] font-bold uppercase tracking-widest text-purple-400">
                        Threats
                      </h5>
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 text-xs text-[var(--muted)] font-light leading-relaxed">
                      {result.swotAnalysis.threats.map((item, idx) => (
                        <li key={idx}>{item.text}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-dashed"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <div>
                <h4
                  className="text-sm font-medium tracking-wide mb-1"
                  style={{ color: "var(--text)" }}
                >
                  Competitor research
                </h4>
                <p
                  className="text-xs font-light"
                  style={{ color: "var(--muted)" }}
                >
                  Find relevant alternatives, compare positioning, and explore
                  evidence-based strategic opportunities.
                </p>
              </div>
              {!battlecards && (
                <button
                  onClick={triggerSpyAgent}
                  disabled={loadingBattlecards}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-medium tracking-[0.2em] uppercase text-white cursor-pointer transition-all hover:brightness-110 disabled:opacity-40"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--indigo), var(--indigo-light))",
                    boxShadow: "0 4px 20px var(--indigo-glow)",
                  }}
                >
                  {loadingBattlecards
                    ? "Researching competitors…"
                    : "Find competitors →"}
                </button>
              )}
            </div>

            {battlecardsError && (
              <div
                role="alert"
                className="p-4 rounded-xl border border-red-500/20 text-xs font-light"
                style={{
                  background: "rgba(239, 68, 68, 0.05)",
                  color: "var(--red)",
                }}
              >
                {battlecardsError}
              </div>
            )}

            {battlecards && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                {battlecards.competitors.map((card, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-6 space-y-4"
                    style={{
                      background: "rgba(255,255,255,0.01)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <h5 className="text-sm font-medium text-[var(--text)]">
                        {card.name}
                      </h5>
                      <a
                        href={card.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="competitor-source-link"
                      >
                        Visit website
                        <Icon name="external" width="12" height="12" />
                      </a>
                    </div>
                    <div>
                      <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--dim)] block mb-1">
                        Competitor Positioning
                      </span>
                      <p className="text-xs font-light text-[var(--muted)] leading-relaxed">
                        {card.positioning}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-emerald-400/80 block mb-1">
                        Our Advantage & Strategy
                      </span>
                      <p className="text-xs font-light text-[var(--muted)] leading-relaxed">
                        {card.advantage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
