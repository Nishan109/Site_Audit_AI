import AuthPage from "@/components/AuthPage";
export const metadata = { title: "Log in · SiteAudit AI" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <AuthPage mode="login" notice={(await searchParams).notice} />;
}
