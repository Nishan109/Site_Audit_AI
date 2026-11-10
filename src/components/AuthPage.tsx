import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm, { type AuthMode } from "./AuthForm";
import Icon from "./Icon";
import { currentAccount } from "@/lib/server/auth";
import styles from "./Account.module.css";

const copy = {
  signup: [
    "Create your SiteAudit AI account",
    "Save your website reviews and pick up where you left off.",
  ],
  login: [
    "Welcome back",
    "Your evidence, findings, and next steps are ready when you are.",
  ],
  forgot: [
    "Reset your password",
    "Enter your email and we’ll send a recovery link.",
  ],
  reset: [
    "Choose a new password",
    "Set a password for your SiteAudit AI account.",
  ],
};

export default async function AuthPage({
  mode,
  notice,
}: {
  mode: AuthMode;
  notice?: string;
}) {
  const account = await currentAccount();
  if (account && (mode === "login" || mode === "signup"))
    redirect("/workspace");
  if (!account && mode === "reset") redirect("/forgot-password?notice=expired");
  const [title, detail] = copy[mode];
  const minLength = Math.max(
    6,
    Number(process.env.SUPABASE_PASSWORD_MIN_LENGTH) || 6,
  );
  return (
    <div className={styles.page}>
      <a href="#account-main" className="skip-link">
        Skip to content
      </a>
      <header className={styles.header}>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Icon name="chart" />
          </span>
          SiteAudit<span className="brand-ai">AI</span>
        </Link>
        <Link href="/">
          Back to website <Icon name="arrow" width="15" height="15" />
        </Link>
      </header>
      <main className={styles.authMain} id="account-main">
        <section className={styles.authCard} aria-labelledby="account-title">
          <span className={styles.eyebrow}>Your website, in perspective</span>
          <h1 id="account-title">{title}</h1>
          <p className={styles.intro}>{detail}</p>
          <AuthForm mode={mode} minLength={minLength} notice={notice} />
        </section>
        <aside className={styles.story}>
          <span className={styles.eyebrow}>A review you can return to</span>
          <h2>From a finding to your next improvement.</h2>
          <p>
            Keep the evidence and the action together. Reopen your original
            review whenever you need it.
          </p>
          <div className={styles.example}>
            <span className={styles.exampleLabel}>
              Illustrative report · example.com/pricing
            </span>
            <h3>Make the primary action more specific</h3>
            <span className={styles.exampleLabel}>Page evidence</span>
            <blockquote>“Learn more”</blockquote>
            <span className={styles.exampleLabel}>Suggested next step</span>
            <p>
              Use a label that explains what visitors will find next, then
              verify its destination.
            </p>
            <div className={styles.exampleFooter}>
              <Icon name="check" width="16" height="16" /> Finding, evidence,
              action
            </div>
          </div>
          <p className={styles.hint}>
            The example demonstrates the report format. Your review uses your
            collected page evidence.
          </p>
        </aside>
      </main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} SiteAudit AI · AI-assisted reviews with
        page evidence
      </footer>
    </div>
  );
}
