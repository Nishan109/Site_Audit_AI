# Account and audit history setup

SiteAudit AI uses Supabase Auth for email accounts and `public.audit_reports` for completed, immutable reports. The public landing page and example remain available before sign-in.

## Environment

Keep the existing variables in `.env.local`. Add `SUPABASE_SECRET_KEY` using a server secret from the project's Settings > API Keys. The secret is used only by the server report writer. Session-scoped clients read and delete reports through owner-only Row Level Security. Keep the secret in deployment environment settings when hosting the app.

Set `NEXT_PUBLIC_APP_URL` to the exact origin you run, including the port. For the current local server this is `http://127.0.0.1:3001`. In production use the deployed HTTPS origin. Restart the app after changing these settings. Set `SUPABASE_PASSWORD_MIN_LENGTH` to the minimum configured under Authentication > Security and Protection. The default is six, and Supabase enforces all additional password requirements.

## Email confirmation and password recovery

In Supabase Authentication > URL Configuration, set the Site URL to your production origin when available. Add these exact development redirects and the equivalent URLs for each production origin you actually use.

```
http://127.0.0.1:3001/auth/confirm
http://127.0.0.1:3001/auth/confirm?flow=recovery
```

If you also run localhost or port 3000, add their exact URLs separately. Match `NEXT_PUBLIC_APP_URL` to the origin users open.

For confirmation links that also work on another device, set Authentication > Email Templates > Confirm signup to link to the application callback using the token hash.

```html
<h2>Confirm your SiteAudit AI email</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Confirm email</a></p>
```

For Reset password, the request already supplies `?flow=recovery`, so append parameters with `&`.

```html
<h2>Reset your SiteAudit AI password</h2>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
```

The callback exchanges the token for cookies and redirects to a clean workspace or password page. It also accepts a PKCE code from default email templates for same-browser completion. With default templates, a different device may not have the original verifier and will need another link.

Use custom SMTP for public signup. Supabase's default delivery service has recipient restrictions and low rate limits. Configure your email provider in Authentication > Email > SMTP Settings and verify actual delivery before launch. Keep email tracking off for authentication links.

## Database and reports

The migration `supabase/migrations/20261110131115_private_audit_reports.sql` creates the private report table. It grants owners SELECT and DELETE, while the server credential has INSERT and SELECT. Authenticated browsers cannot insert, alter, or reassign canonical reports. History uses an owner/date/UUID index and cursor pagination.

The audit endpoint validates the session before collection. The existing analysis runs, then saving has a separate six-second deadline. Failure to save still returns the report for export. Reopening a saved report reads its snapshot without calling AI. Later optional checks, research refreshes, manual progress, copy edits, and creative drafts stay in the current session. Export the updated view to keep those changes.

The pending website address stays in the same tab's session storage for thirty minutes. It is excluded from authentication redirect URLs and emails. Source URLs containing credential-like parameters make the report ineligible for durable storage, while its current-session report remains exportable.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Test two separate accounts for history isolation, direct report URLs and deletion. Test signup confirmation and recovery in an actual mailbox after SMTP and redirects are configured. Sign out, sign back in and reopen a completed report, then verify scores, evidence and exports. A failed save should leave the result visible and clearly identify that history persistence was not confirmed.

For a real development-project check, run `node scripts/run-with-ca.mjs --env-file=.env.local --conditions=react-server --import tsx scripts/verify-accounts.mts`. It creates two temporary confirmed accounts without sending emails, checks the actual application login, cookies, server persistence, history, report reload, Data API isolation, deletion and logout, then removes the accounts and their reports. It uses isolated fixtures and consumes no AI quota.

The connected project's security advisor reports pre-existing execution grants on the `public.rls_auto_enable()` event-trigger function. The new report table has owner-only RLS. Review the [existing function grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) separately.
