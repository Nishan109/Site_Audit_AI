import ReviewWorkspace from "@/components/AuditWorkspace";
import { currentAccount } from "@/lib/server/auth";

export default async function Home() {
  return <ReviewWorkspace account={await currentAccount()} publicLanding />;
}
