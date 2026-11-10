import React from "react";
import { issueSteps } from "@/lib/review-workspace";
import type { Issue } from "@/lib/types";
import { AuditResult, FixStep } from "@/lib/types";
import { quickWinEvidenceLines } from "@/lib/quick-wins-presentation";
import { QUICK_WIN_AREAS } from "@/lib/quick-wins";
import { aiVisibilityPlan } from "@/lib/ai-visibility-presentation";
import { securityPlan } from "@/lib/security-presentation";
import { accessibilityPlan } from "@/lib/accessibility-presentation";
import { pageSpeedPlan } from "@/lib/pagespeed-presentation";
import { validatedPageSpeedReports } from "@/lib/pagespeed";
import { dashboardModel, dashboardPlan } from "@/lib/dashboard";
import { uxActionPlan } from "@/lib/ux-presentation";
import { seoPlan } from "@/lib/seo-presentation";
import { conversionPlan } from "@/lib/conversion-presentation";

interface PrintReportProps {
  result: AuditResult;
  generatedFixSteps: Record<string, FixStep[]>;
}

export default function PrintReport({ result, generatedFixSteps }: PrintReportProps) {
  const dashboard = dashboardModel(result);
  const performance = validatedPageSpeedReports(result.pageSpeedReports, result.url);
  const overallScore = dashboard.overallScore;
  // Helper to render fix steps block ONLY if it exists in the active state
  const renderFixStepsBlock = (issue: Issue) => {
    const steps = issueSteps(issue, generatedFixSteps);
    if (!steps || steps.length === 0) return null;

    return (
      <div className="mt-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/15 space-y-3" style={{ pageBreakInside: "avoid" }}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Implementation Action Plan (Fix Steps)
        </div>
        <div className="grid grid-cols-1 gap-3 pl-1">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 items-start text-[11px]">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">{idx + 1}</span>
              <div className="leading-normal">
                <span className="font-bold text-slate-800">{step.title}</span>
                <p className="text-slate-500 font-light mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="hidden print:block bg-white p-8 font-sans w-full max-w-4xl mx-auto text-left"
      id="siteaudit-print-root"
      style={{ color: "#1e293b" }}
    >
      {/* Cover Page */}
      <div className="py-10 border-b-2 border-slate-200 print-page flex flex-col justify-between" style={{ minHeight: "94vh" }}>
        <div className="space-y-6">
          {/* Colorful Branding strip */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="text-indigo-600 font-extrabold text-2xl tracking-wider font-sans">SITEAUDIT<span className="text-cyan-500">.AI</span></div>
            <span className="px-3 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest border border-indigo-100">AI AUDIT REPORT</span>
          </div>

          <div className="pt-4 space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
              Website Evidence & Content Review
            </h1>
            <p className="text-md text-slate-500 font-light leading-relaxed">
              Content and initial-HTML review prepared for: <br />
              <span className="font-semibold text-indigo-600 break-all text-sm">{result.url}</span>
            </p>
          </div>

          {/* Overall Performance score badge */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-center">
            {/* Score Ring container */}
            <div className="p-6 rounded-2xl border bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 border-indigo-100 flex flex-col items-center justify-center text-center col-span-1">
              <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-2">Content & clarity assessment</div>
              <div className="relative flex items-center justify-center">
                <span className="text-4xl font-extrabold text-indigo-600 leading-none">{overallScore ?? "Not assessed"}</span>
                {overallScore !== null && <span className="text-slate-400 text-xs font-semibold mt-2.5">/100</span>}
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-light">Qualitative AI assessment · {dashboard.assessed}/5 categories assessed. Equal average; unassessed categories excluded.</span>
            </div>

            {/* Core Dimensions Breakdown right on the Cover Page */}
            <div className="grid grid-cols-2 gap-4 col-span-2">
              {dashboard.categories.map(({ key: name, label, score }) => {
                const colorClass =
                  name === "messaging" ? "border-l-indigo-500" :
                  name === "ux" ? "border-l-cyan-500" :
                  name === "seo" ? "border-l-amber-500" :
                  "border-l-emerald-500";
                const bgClass =
                  name === "messaging" ? "bg-indigo-50/30" :
                  name === "ux" ? "bg-cyan-50/30" :
                  name === "seo" ? "bg-amber-50/30" :
                  "bg-emerald-50/30";
                return (
                  <div key={name} className={`p-4 rounded-xl border border-slate-200 border-l-4 ${colorClass} ${bgClass} text-left`}>
                    <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-0.5">{label}</div>
                    <div className="text-lg font-bold text-slate-800">{typeof score === "number" ? <>{score}<span className="text-[10px] text-slate-400 font-light">/100</span></> : "Not assessed"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Metadata & Disclaimer */}
        <div className="pt-8 mt-12">
          <div className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-6">
            <div>
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Audit Timestamp</div>
              <div className="text-slate-700 font-medium text-xs">
                {new Date(result.analyzedAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Report ID</div>
              <div className="text-slate-600 font-mono text-[10px]">
                {result.analysisId || result.analyzedAt}
              </div>
            </div>
          </div>
          <div className="text-[9px] text-slate-400 font-light mt-6 text-center leading-relaxed">
            Live HTML evidence with AI marketing assessments. Rendered layout, security vulnerabilities, WCAG compliance and conversion performance have not been verified.
          </div>
        </div>
      </div>

      {/* Assessment Overview */}
      <div className="py-8 border-b border-slate-200 print-page space-y-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-indigo-600 pl-3 leading-none">Audit Overview</h2>

        <div className="p-4 bg-indigo-50/20 rounded-xl border border-indigo-100">
          <div className="font-bold text-indigo-700 text-xs uppercase tracking-wider mb-1.5">Messaging review perspective</div>
          <p className="text-xs text-slate-600 leading-relaxed font-light">{result.messagingAnalysis?.summary || "No current source-backed messaging summary is available in this report."}</p>
        </div>

        <div className="space-y-2">
          <div className="font-bold text-slate-700 text-xs uppercase tracking-wider">Detailed Assessment</div>
          <p className="text-xs text-slate-600 leading-relaxed font-light">{result.overview}</p>
          <div className="text-[10px] text-slate-500 space-y-2">
            <p className="font-semibold">Pages actually collected</p>
            {result.pagesAnalyzed?.map(page=><p key={page.url} className="break-all">{page.url} · {page.fetchedAt} · SHA-256: {page.contentHash}</p>)}
            {result.pagesAnalyzed?.filter(page=>page.collectionNote).map(page=><p key={`collection-${page.url}`}>{page.url} · {page.collectionNote}</p>)}
            {result.warnings?.map(warning=><p key={warning}>{warning}</p>)}
            {result.limitations?.map(limit=><p key={limit}>{limit}</p>)}
          </div>
        </div>
      </div>

      {/* Critical Priority Issues WITH Fix Steps */}
      <div className="py-8 border-b border-slate-200 print-page space-y-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-indigo-400 pl-3 leading-none">Priority finding shortlist</h2>
        <p className="text-xs text-slate-500">Up to four of {dashboard.findings.length} distinct supported findings, ordered by qualitative priority. This is not measured business impact.</p>

        <div className="space-y-5">
          {dashboard.findings.slice(0, 4).map(({ issue }, idx) => (
            <div key={idx} className="p-5 rounded-xl border border-l-4 border-slate-200 border-l-red-500 bg-white space-y-2 shadow-sm" style={{ pageBreakInside: "avoid" }}>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[8px] font-bold uppercase tracking-wider">
                  {issue.priority} Priority
                </span>
                <span className="font-bold text-slate-800 text-xs">{issue.title}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-light leading-relaxed">{issue.detail}</p>

              {/* Actual Fix Steps rendered ONLY if user generated them */}
              {renderFixStepsBlock(issue)}
            </div>
          ))}
        </div>
      </div>

      <section className="py-8 border-b border-slate-200 print-page space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Complete dashboard overview & coverage</h2>
        <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words font-sans">{dashboardPlan(result, dashboard)}</pre>
      </section>

      {result.aeoAnalysis && (
        <section className="py-8 border-b border-slate-200 space-y-4" style={{ breakAfter: "page" }}>
          <h2 className="text-lg font-bold text-slate-800">AI visibility · content readiness</h2>
          <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{aiVisibilityPlan(result.aeoAnalysis.review, result.aeoAnalysis.issues, result.url, generatedFixSteps, result.pagesAnalyzed ? dashboard.pages : undefined)}</pre>
        </section>
      )}
      <section className="py-8 border-b border-slate-200 space-y-4" style={{ breakAfter: "page" }}>
        <h2 className="text-lg font-bold text-slate-800">Security checks · observed signals</h2>
        <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{securityPlan(result.securityAudit, result.url, generatedFixSteps)}</pre>
      </section>
      <section className="px-6 py-8 border-b border-slate-200 space-y-4" style={{ breakAfter: "page" }}>
        <h2 className="text-lg font-bold text-slate-800">Accessibility checks · HTML evidence</h2>
        <pre className="text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{accessibilityPlan(result.accessibilityAudit, result.url)}</pre>
      </section>
      {performance.length > 0 && (
        <section className="px-6 py-8 border-b border-slate-200 space-y-4" style={{ breakAfter: "page" }}>
          <h2 className="text-lg font-bold text-slate-800">Page speed · Performance measurements</h2>
          <pre className="text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans" style={{ overflowWrap: "anywhere" }}>{pageSpeedPlan(performance)}</pre>
        </section>
      )}
      {/* Category Breakdowns WITH Fix Steps */}
      <div className="py-8 border-b border-slate-200 print-page space-y-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-cyan-500 pl-3 leading-none">Category Breakdowns</h2>

        <div className="space-y-8">
          {[
            { key: "messaging", label: "Messaging & Copy", issues: result.messaging },
            { key: "ux", label: "UX & Design", issues: result.ux },
            { key: "seo", label: "SEO", issues: result.seo },
            { key: "conversion", label: "Conversion Clarity", issues: result.conversion },
          ].map(({ key, label, issues }) => {
            if (!issues?.length && !(key === "seo" && result.seoAnalysis) && !(key === "conversion" && result.conversionAnalysis)) return null;
            const headingColor =
              key === "messaging" ? "text-indigo-600 border-indigo-100" :
              key === "ux" ? "text-cyan-600 border-cyan-100" :
              key === "seo" ? "text-amber-600 border-amber-100" :
              key === "conversion" ? "text-emerald-600 border-emerald-100" :
              key === "aeo" ? "text-cyan-700 border-cyan-100" :
              key === "security" ? "text-red-600 border-red-100" :
              "text-violet-600 border-violet-100";
            return (
              <div key={key} className="space-y-4 mb-6" style={{ pageBreakInside: key === "seo" || key === "conversion" ? "auto" : "avoid" }}>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${headingColor} border-b pb-1.5`}>
                  {label} Assessment
                </h3>
                {key === "ux" && <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words font-sans">{uxActionPlan(result.uxAnalysis, result.ux, result.url, generatedFixSteps, dashboard.pages.map((page) => page.url))}</pre>}
                {key === "seo" && <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words font-sans">{seoPlan(result.seoAnalysis, result.seo || [], result.url, generatedFixSteps, dashboard.pages.map((page) => page.url))}</pre>}
                {key === "conversion" && <pre className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words font-sans">{conversionPlan(result.conversionAnalysis, result.conversion || [], result.url, generatedFixSteps, result.pagesAnalyzed ? dashboard.pages.map((page) => page.url) : undefined)}</pre>}
                <div className="space-y-4">
                  {key !== "ux" && key !== "seo" && key !== "conversion" && issues?.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 last:mb-0" style={{ pageBreakInside: "avoid" }}>
                      <div className="flex gap-3 text-xs justify-between items-start">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 text-xs">{item.title}</div>
                          <div className="text-[10px] text-slate-500 font-light leading-relaxed">{item.detail}</div>
                          {item.evidence && <p className="text-[10px] text-slate-500 break-all">{item.evidenceType === "conversion-observation" ? `Conversion observation: ${item.evidence}` : item.evidenceType === "seo-observation" ? `SEO observation: ${item.evidence}` : item.evidenceType === "html-observation" ? `HTML observation: ${item.evidence}` : `Evidence: “${item.evidence}”`} · {item.pageUrl}</p>}
                          {item.supportingEvidence?.map((source) => <p key={source.id} className="text-[10px] text-slate-500">Supporting copy: “{source.quote}” · {source.pageUrl}</p>)}
                          {item.copySuggestion && <div className="mt-3 border-l-2 border-indigo-200 pl-3 text-[11px] leading-relaxed space-y-1">
                            <p className="font-semibold text-slate-700">Suggested wording · review before publishing</p>
                            <p><strong>Current:</strong> {item.copySuggestion.original}</p>
                            <p><strong>Suggested:</strong> {item.copySuggestion.replacement}</p>
                            {item.copySuggestion.sources.map((source) => <p key={source.id} className="text-[10px] text-slate-500">Source: “{source.quote}” · {source.pageUrl}</p>)}
                          </div>}
                        </div>
                        <span className={`font-bold uppercase text-[8px] px-2 py-0.5 rounded shrink-0 ${
                          item.priority === "High" ? "bg-red-100 text-red-700" : item.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        }`}>
                          {item.priority}
                        </span>
                      </div>

                      {/* Actual Fix Steps rendered ONLY if user generated them */}
                      {renderFixStepsBlock(item)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Wins & Roadmap */}
      <div className="py-8 print-page space-y-6">
        <h2 className="text-lg font-bold text-slate-800 border-l-4 border-emerald-500 pl-3 leading-none">Quick Wins Roadmap</h2>
        <p className="text-[10px] text-slate-500 leading-relaxed">Effort is a qualitative estimate, not a measured duration. Expected benefits are hypotheses, not measured uplift. Manual task progress is available in the text shortlist export and does not change audit scores.</p>
        {!result.quickWins.length && <p className="text-xs text-slate-500">No smaller-effort quick wins were supported in this sample.</p>}

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-3 font-semibold text-slate-700">Action Plan</th>
                <th className="p-3 font-semibold text-slate-700">Expected benefit · hypothesis</th>
                <th className="p-3 font-semibold text-slate-700">Implementation Effort</th>
              </tr>
            </thead>
            <tbody>
              {result.quickWins.map((win, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0" style={{ pageBreakInside: "avoid" }}>
                  <td className="p-3 text-slate-800"><strong>{win.action}</strong><p className="mt-2 text-[10px] text-slate-500">{QUICK_WIN_AREAS.find(area => area.key === win.category)?.label || "Saved suggestion"}</p>{win.relatedIssue && <p className="mt-2 text-[10px] text-slate-500">Related finding: {win.relatedIssue.title} · {win.relatedIssue.priority} priority</p>}{win.relatedIssue && renderFixStepsBlock(win.relatedIssue)}<div className="mt-3 text-[9px] font-normal text-slate-500 space-y-1 break-words">{quickWinEvidenceLines(win).map((line, index) => <p key={index}>{line}</p>)}</div></td>
                  <td className="p-3 text-slate-600 font-light">{win.impact}</td>
                  <td className="p-3 text-slate-600 font-light">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      win.effort === "Low" ? "bg-emerald-100 text-emerald-700" : win.effort === "Medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}>
                      {win.effort}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
