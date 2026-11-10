import Link from "next/link";
export default function NotFound() {
  return (
    <main className="app-main">
      <h1>Report unavailable</h1>
      <p>This saved report could not be found in your account.</p>
      <Link className="button button-secondary" href="/workspace">
        Back to audit history
      </Link>
    </main>
  );
}
