# Architecture

## Principles

1. **The database is the source of truth for rules.** Money movement, status transitions, payment gates and permissions are enforced in Postgres (RLS, SECURITY DEFINER functions, constraints and triggers), so no client, including a buggy one, can bypass them.
2. **Balances are derived, never stored.** Everything a user sees as "paid", "outstanding", "held" or "owed" is computed from invoice lines, adjustments, allocations, refunds and journal lines (`supabase/migrations/*_views.sql`).
3. **Append-only finance.** Corrections are reversing records, never edits.
4. **Server-first UI.** Pages are async Server Components that query Supabase with the user's session. Client components exist only where interaction needs them (forms, dialogs, attendance taps, filters).
5. **Honest integrations.** External providers (Daraja, Africa's Talking, Resend, Web Push, eTIMS) sit behind adapters. Without credentials they run in a clearly labelled sandbox and never claim success.

## Code layout

```
src/
  app/                    routes (App Router)
    (auth)/               login, activate, forgot-password
    app/                  student PWA (/app/*)
    staff/                staff application (/staff/*), role-gated per page
    api/mpesa/c2b/*       Daraja callbacks
    api/cron/*            scheduled jobs
    api/documents/[id]    private document download (signed URL)
    api/reports/[slug]    CSV exports
  components/
    ui/                   design-system primitives (button, card, data-table, charts…)
    shell/                staff shell: sidebar, drawer, bottom shortcuts, command search
    student/              PWA navigation, pay instructions, preferences
    staff/                feature dialogs/forms used by staff pages
  features/<domain>/      server actions and queries per domain
  lib/
    finance/              pure calculations (schedule, allocation preview)
    mpesa/                payload parsing, callback service, Daraja client
    notifications/        provider adapters + outbox
    auth/                 session resolution, role helpers
    supabase/             server/browser/admin clients + generated types
    security/             rate limiting, safe redirects
  proxy.ts                session refresh + private-area gate (Next 16 "proxy")
supabase/migrations/      the complete schema
scripts/seed.ts           realistic seed via real business functions
tests/{unit,integration,e2e}
```

## Request flow

- **Read:** a Server Component calls `getSessionUser()` (validated with `auth.getUser()`, cached per request), checks roles with `requireRole()`, then queries Supabase with the user's JWT, so RLS limits rows.
- **Write:** a client form calls a Server Action → Zod validation → an RPC to a SECURITY DEFINER function (or an RLS-checked insert/update) → `friendlyDbError()` maps Postgres errors to plain language → `revalidatePath`.
- **Service role** is used only in: M-Pesa callbacks, cron, user administration (creating auth users), login-identifier resolution, activation, public enquiries and seeding.

## Responsive strategy

- Staff: a collapsible sidebar at `lg+`; a drawer plus four role-specific bottom shortcuts on phones. `DataTable` renders a real table from `md` up and stacked cards below. The schedule is a week grid on desktop and an agenda on phones.
- Students: bottom navigation on phones (Home, Training, Payments, Schedule, Profile), a top tab bar on tablets and desktop. Every screen is designed for a 360px viewport.
- Verified with automated overflow checks at 360, 390, 430, 768, 1024, 1280 and 1440px.

## Performance

- System font stack (no web font download), server-rendered SVG charts (no chart library), minimal client components.
- Pagination on large lists, indexes on common filters (status, location, dates, phone, trigram on names).
- Parallel queries per page (`Promise.all`); dashboards aggregate in a single SQL function call.
- Long-lived caching for hashed static assets in the service worker.
