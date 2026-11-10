import AuthPage from "@/components/AuthPage";
export const metadata = { title: "Create account · SiteAudit AI" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <AuthPage mode="signup" notice={(await searchParams).notice} />;
}
