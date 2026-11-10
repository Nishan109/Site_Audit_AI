import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { localPageSpeedSetup } from "@/lib/server/pagespeed-key";
import PageSpeedKeyDialog from "./PageSpeedKeyDialog";
import styles from "./settings.module.css";

export default async function PageSpeedSettings() {
  if (!localPageSpeedSetup((await headers()).get("host"))) notFound();
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.home}>
        SiteAudit AI
      </Link>
      <h1>PageSpeed settings</h1>
      <p>
        Connect your Google Cloud project to run PageSpeed tests from SiteAudit.
      </p>
      <PageSpeedKeyDialog />
    </main>
  );
}
