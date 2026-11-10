import type { QuickWin } from "@/lib/types";
import { CopyEvidence } from "./MessagingEvidence";
import { HTMLObservations } from "./UXEvidence";
import { SEOObservations } from "./SEOEvidence";
import { ConversionObservations } from "./ConversionEvidence";
import Icon from "./Icon";
import shared from "./UXReview.module.css";
import styles from "./QuickWinsSection.module.css";

export function QuickWinObservations({ win }: { win: QuickWin }) {
  if (win.messagingEvidence?.length)
    return <CopyEvidence sources={win.messagingEvidence} />;
  if (win.uxEvidence?.length)
    return <HTMLObservations sources={win.uxEvidence} />;
  if (win.seoEvidence?.length)
    return <SEOObservations sources={win.seoEvidence} />;
  if (win.conversionEvidence?.length)
    return <ConversionObservations sources={win.conversionEvidence} />;
  return (
    <div className={styles.savedEvidence}>
      <p>
        Saved evidence · its type and linked finding were not recorded. Run a
        fresh audit for the verified shortlist.
      </p>
      <pre>
        {win.evidence || "No evidence was recorded in this saved report."}
      </pre>
      {win.pageUrl && (
        <a href={win.pageUrl} target="_blank" rel="noopener noreferrer">
          Open saved source
          <Icon name="external" width="12" height="12" />
        </a>
      )}
    </div>
  );
}
export default function QuickWinEvidence({ win }: { win: QuickWin }) {
  return (
    <details className={shared.sourceDetails}>
      <summary>
        <Icon name="link" width="13" height="13" />
        Why this suggestion was included
        <Icon name="down" width="12" height="12" />
      </summary>
      <QuickWinObservations win={win} />
    </details>
  );
}
