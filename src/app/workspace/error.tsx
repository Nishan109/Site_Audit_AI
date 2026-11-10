"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="app-main">
      <h1>Your workspace couldn’t load</h1>
      <p>Please try again. Your saved reports remain in your account.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
      <Link className="button button-secondary" href="/login">
        Log in again
      </Link>
    </main>
  );
}
