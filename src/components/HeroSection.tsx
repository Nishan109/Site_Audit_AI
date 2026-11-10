"use client";
import { useRef, useState } from "react";
import Icon from "./Icon";
import ReportExample from "./ReportExample";
import { focusReviewForm } from "./landing-navigation";
import styles from "./StartScreen.module.css";
interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  initialUrl?: string;
}
const faqs = [
  {
    question: "Which pages does the review read?",
    answer:
      "We collect the public page you enter and up to two related pages from the same website, when available. Your report lists exactly which pages were read and when the evidence was collected.",
  },
  {
    question: "Does it test my website in a browser?",
    answer:
      "The main review reads collected page content and HTML. It does not interact with your website or submit forms. Rendered layout, keyboard operation, and full security and accessibility testing need separate checks. PageSpeed measurements can be requested separately from your report, subject to provider availability.",
  },
  {
    question: "What do the AI scores mean?",
    answer:
      "Scores summarize qualitative AI assessments of the collected evidence. They do not measure conversion rates, search rankings, or whether AI assistants actually cite your website. Every assessment should be considered alongside its evidence and scope.",
  },
  {
    question: "What if a page or provider cannot be reached?",
    answer:
      "Some websites block automated access or need JavaScript to display their content. If we cannot collect enough usable evidence or complete the review, we explain the limitation so you can retry or use another public page. Sample findings are never substituted into a real audit.",
  },
  {
    question: "Can I export my report?",
    answer:
      "Yes. Use Export report after your review to open the print dialog and save a PDF. Individual review sections also offer their own copy or download actions where available.",
  },
];
export default function HeroSection({
  onSubmit,
  isLoading,
  initialUrl = "",
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const example = useRef<HTMLDialogElement>(null);
  const exampleTrigger = useRef<HTMLButtonElement>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    const value = url.trim();
    try {
      const parsed = new URL(
        /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
      );
      if (
        !value ||
        !/^https?:$/.test(parsed.protocol) ||
        !parsed.hostname.includes(".") ||
        parsed.username ||
        parsed.password ||
        /\s/.test(value)
      )
        throw new Error();
    } catch {
      setError(
        "Enter a website address, such as example.com or https://example.com.",
      );
      input.current?.focus();
      return;
    }
    setError("");
    onSubmit(value);
  };
  const closeExample = () => example.current?.close();
  return (
    <div className={styles.page}>
      <section
        className={styles.hero}
        aria-labelledby="landing-title"
        id="hero-section"
      >
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} /> AI WEBSITE REVIEW
          </span>
          <h1 id="landing-title">
            Know what
            <br className={styles.desktopBreak} /> to improve.
            <br />
            <span>See the evidence.</span>
          </h1>
          <p className={styles.intro}>
            A fresh perspective on your website’s messaging, structure, and
            search foundations. With evidence you can inspect and next steps you
            can use.
          </p>
          <form
            onSubmit={submit}
            noValidate
            className={styles.form}
            aria-label="Start a website review"
          >
            <label htmlFor="url-input">Your website address</label>
            <div className={styles.formRow}>
              <div className={styles.inputWrap} data-invalid={!!error}>
                <Icon name="globe" width="19" height="19" />
                <input
                  ref={input}
                  id="url-input"
                  name="website"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  maxLength={2048}
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setError("");
                  }}
                  placeholder="yourwebsite.com"
                  disabled={isLoading}
                  aria-invalid={!!error}
                  aria-describedby={`url-helper${error ? " url-error" : ""}`}
                />
              </div>
              <button
                id="analyze-button"
                className={styles.primary}
                type="submit"
                disabled={isLoading || !url.trim()}
              >
                {isLoading ? "Reviewing…" : "Review my website"}
                <Icon
                  name={isLoading ? "loader" : "arrow"}
                  className={isLoading ? "spin" : ""}
                  width="17"
                  height="17"
                />
              </button>
            </div>
            {error && (
              <p id="url-error" className={styles.error} role="alert">
                {error}
              </p>
            )}
            <p id="url-helper" className={styles.helper}>
              <Icon name="shield" width="14" height="14" />
              Public websites only. No installation needed.
            </p>
            <p className={styles.timing}>Reviews can take a few minutes.</p>
          </form>
          <button
            ref={exampleTrigger}
            type="button"
            className={styles.exampleAction}
            disabled={isLoading}
            onClick={() => example.current?.showModal()}
          >
            <span>
              <Icon name="eye" width="17" height="17" />
            </span>
            Explore an example report
            <Icon name="arrow" width="15" height="15" />
          </button>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.previewKicker}>
            <span /> A little evidence. A clearer direction.
          </div>
          <ReportExample />
          <p className={styles.previewCaption}>
            From what’s on the page to what you can do next.
          </p>
        </div>
      </section>
      <div className={styles.proofStrip} aria-label="Included in your review">
        <span>
          <Icon name="file" />
          Page evidence included
        </span>
        <span>
          <Icon name="target" />
          Prioritized next steps
        </span>
        <span>
          <Icon name="download" />
          Exportable report
        </span>
      </div>
      <section
        className={styles.outcomeSection}
        id="what-you-get"
        aria-labelledby="outcomes-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>
              LESS GUESSWORK. MORE DIRECTION.
            </span>
            <h2 id="outcomes-title">
              A review you can
              <br />
              actually put to work.
            </h2>
          </div>
          <p>
            Understand the opportunity.
            <br />
            See the context. Make your next move.
          </p>
        </div>
        <div className={styles.outcomes}>
          <article className={styles.leadOutcome}>
            <span className={styles.outcomeIcon}>
              <Icon name="message" width="24" height="24" />
            </span>
            <h3>Clearer messaging.</h3>
            <p>
              See where your words could explain your offer and the next action
              more clearly.
            </p>
            <div
              className={styles.wordExample}
              aria-label="Illustrative wording example"
            >
              <span className={styles.miniLabel}>
                A MORE SPECIFIC NEXT STEP
              </span>
              <span className={styles.oldWording}>Learn more</span>
              <span className={styles.wordConnector}>
                <Icon name="down" width="18" height="18" />
              </span>
              <span className={styles.newWording}>
                Compare plans <Icon name="arrow" width="17" height="17" />
              </span>
              <small>Illustrative wording · from the example report</small>
            </div>
          </article>
          <article className={styles.supportingOutcome}>
            <span className={styles.outcomeIcon}>
              <Icon name="layers" width="23" height="23" />
            </span>
            <div>
              <h3>Better content structure.</h3>
              <p>
                Review navigation, headings, and search foundations through the
                evidence collected from your pages.
              </p>
              <div className={styles.topicLabels}>
                <span>Navigation</span>
                <span>Headings</span>
                <span>Search</span>
              </div>
            </div>
          </article>
          <article className={styles.supportingOutcome}>
            <span className={styles.outcomeIcon}>
              <Icon name="target" width="23" height="23" />
            </span>
            <div>
              <h3>A practical improvement plan.</h3>
              <p>
                Give each finding context, decide what deserves attention, and
                work through suggested next steps.
              </p>
              <p className={styles.smallProcess}>
                <span>Finding</span>
                <Icon name="arrow" width="14" height="14" />
                <span>Evidence</span>
                <Icon name="arrow" width="14" height="14" />
                <span>Action</span>
              </p>
            </div>
          </article>
        </div>
        <details className={styles.moreTools}>
          <summary>
            <span>
              <Icon name="plus" width="17" height="17" />
              More ways to improve your website
            </span>
            <Icon name="down" width="17" height="17" />
          </summary>
          <div className={styles.toolGrid}>
            <div>
              <Icon name="sparkle" />
              <h3>AI content readiness</h3>
              <p>
                Inspect cited content and suggestions for clearer, better
                supported answers.
              </p>
            </div>
            <div>
              <Icon name="shield" />
              <h3>Security & accessibility</h3>
              <p>
                Review limited HTML and header observations, plus what still
                needs manual testing.
              </p>
            </div>
            <div>
              <Icon name="bolt" />
              <h3>PageSpeed insights</h3>
              <p>
                Request a separate Google performance test when the provider is
                available.
              </p>
            </div>
            <div>
              <Icon name="pen" />
              <h3>Creative & research tools</h3>
              <p>
                Draft ads, compare creatives, and explore competitor research
                when available.
              </p>
            </div>
          </div>
        </details>
      </section>
      <section
        className={styles.processSection}
        id="how-it-works"
        aria-labelledby="process-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>A SIMPLE WAY FORWARD</span>
            <h2 id="process-title">
              Your URL. Your evidence.
              <br />
              Your next step.
            </h2>
          </div>
          <p>
            Start with a public page.
            <br />
            Leave with something useful to work on.
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNumber}>01</span>
            <h3>Enter your website.</h3>
            <p>
              Use a homepage or a specific page. We collect it and up to two
              related pages when accessible.
            </p>
          </li>
          <li>
            <span className={styles.stepNumber}>02</span>
            <h3>See what stands out.</h3>
            <p>
              Explore the findings, inspect their source evidence, and
              understand the suggested improvements.
            </p>
          </li>
          <li>
            <span className={styles.stepNumber}>03</span>
            <h3>Choose your next move.</h3>
            <p>
              Prioritize a useful change, work through the next steps, or export
              the report to share with your team.
            </p>
          </li>
        </ol>
      </section>
      <section
        className={styles.faqSection}
        id="faq"
        aria-labelledby="faq-title"
      >
        <div className={styles.faqIntro}>
          <span className={styles.eyebrow}>A FEW USEFUL DETAILS</span>
          <h2 id="faq-title">
            Clarity, before
            <br />
            you begin.
          </h2>
          <p>
            What we review, what the results mean, and what to expect along the
            way.
          </p>
          <span className={styles.scopeNote}>
            <Icon name="info" width="17" height="17" />
            AI assessments, with their scope made clear.
          </span>
        </div>
        <div className={styles.faqList}>
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <Icon name="plus" width="18" height="18" />
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={styles.finalSection} aria-labelledby="final-title">
        <div>
          <span className={styles.finalEyebrow}>
            A FRESH PERSPECTIVE IS A GOOD START.
          </span>
          <h2 id="final-title">
            Your next improvement
            <br />
            starts with a URL.
          </h2>
          <p>Find a clearer direction for your website.</p>
        </div>
        <button
          type="button"
          className={styles.finalAction}
          onClick={focusReviewForm}
          disabled={isLoading}
        >
          Review my website
          <Icon name="arrow" width="19" height="19" />
        </button>
      </section>
      <dialog
        ref={example}
        className={styles.exampleDialog}
        aria-labelledby="example-dialog-title"
        onClose={() => exampleTrigger.current?.focus()}
      >
        <div className={styles.dialogHeader}>
          <div>
            <h2 id="example-dialog-title">Explore the example report</h2>
            <p>A fictional page. A real look at the review format.</p>
          </div>
          <button
            type="button"
            className={styles.closeExample}
            aria-label="Close example report"
            onClick={closeExample}
            autoFocus
          >
            <Icon name="close" />
          </button>
        </div>
        <ReportExample interactive />
        <div className={styles.dialogFooter}>
          <span>This example does not start an analysis.</span>
          <button type="button" onClick={closeExample}>
            Back to your website
            <Icon name="arrow" width="16" height="16" />
          </button>
        </div>
      </dialog>
    </div>
  );
}
