# Student PWA

## Installability

- `src/app/manifest.ts` → `/manifest.webmanifest`: `display: standalone`, `start_url: /app`, theme `#0e7566`, 192/512 icons plus a **maskable** 512 icon, and shortcuts (Pay fees, My schedule).
- Icons are generated from `public/icons/icon.svg` / `maskable.svg`.
- `InstallPrompt` captures `beforeinstallprompt` on Android Chrome and shows a dismissible banner (remembered per device).
- `apple-touch-icon` and `appleWebApp` metadata cover iOS "Add to Home Screen".

## Service worker (`public/sw.js`)

Registered only in production builds (`components/pwa/service-worker.tsx`).

| Request | Strategy |
| --- | --- |
| `/_next/static/*`, `/icons/*` | Cache-first (hashed, immutable) |
| Student pages `/app`, `/app/schedule`, `/app/training`, `/app/payments`, `/app/profile`, `/app/receipts/*` (HTML and RSC payloads) | Network-first with a 6s timeout; the last good copy is served offline |
| Other navigations | Network-only, with `/offline` fallback |
| `/api/*`, staff pages, auth pages, all non-GET (server actions, payments) | Never cached |

**Sensitive data:** only what the student has already viewed on their own device is cached, and the page cache is **wiped on visiting `/login` or `/activate`** (sign-in and sign-out), which matters on shared phones. Payments always need a connection: the M-Pesa instructions dialog is static text, and balances update from server callbacks.

**Updates:** a new service worker waits, then the app shows "A new version of Elly K is available – Update", which posts `SKIP_WAITING` and reloads on `controllerchange`. Bump `VERSION` in `sw.js` to invalidate old caches.

**Offline state:** `OfflineBanner` (in both shells) uses `online`/`offline` events to explain what still works.

## Push notifications

Web Push is ready: users opt in from Profile (only shown when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set). Subscriptions are stored per user, the outbox sends via VAPID, and expired endpoints (404/410) are removed. The service worker shows the notification and focuses or opens the linked page on tap.

## Low-end Android considerations

System fonts, no chart or animation libraries, SVG progress rings, server-rendered pages, 44px+ touch targets, bottom navigation within thumb reach, and native `<select>`/date inputs.

## Testing installability

Run a production build (`pnpm build && pnpm start`), open Chrome DevTools → Application → Manifest / Service workers, or Lighthouse → PWA. On a phone, use an HTTPS deployment (service workers require HTTPS except on localhost).
