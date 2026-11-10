import AuthPage from "@/components/AuthPage";
export const metadata = { title: "Password recovery · SiteAudit AI" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <AuthPage mode="forgot" notice={(await searchParams).notice} />;
}
