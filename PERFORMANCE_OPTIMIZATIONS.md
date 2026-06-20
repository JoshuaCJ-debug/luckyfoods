# Performance Optimizations — Load Speed & Render Cold Start

This document records the front-end load-performance work done to make Lucky Foods
feel fast despite the backend running on Render's free tier (which spins the
instance down after ~15 minutes of inactivity, causing a 30–60s cold start on the
next request).

The optimizations are **layered** — each is independent and additive. None undoes
another.

| # | Optimization | Problem it solves | File | Commit |
|---|--------------|-------------------|------|--------|
| 1 | App-shell placeholder | White flash before React mounts | `frontend/index.html` | `ee03bd1` |
| 2 | Menu cache (stale-while-revalidate) | Skeleton shown on every visit | `frontend/src/App.jsx` | `f714761` |
| 3 | Honest cold-start messaging | "Retrying" copy looked broken | `frontend/src/App.jsx` | `f714761` |
| 4 | Backend warm-up ping | Cold start blocks the first API call | `frontend/index.html` | `92b1a52` |

---

## The problem, in two parts

The perceived slowness was actually two distinct issues:

1. **First visit after the backend slept** → a genuine 30–60s Render cold start.
   Largely unavoidable on the free tier (Render's spin-down can't be disabled).
2. **Every other visit** → backend already warm, but the app still showed a blank
   screen, then a skeleton, and refetched the menu from scratch every time.

Most of the win came from fixing the *perceived* cost of #2, plus overlapping the
unavoidable cost of #1 with work the browser was already doing.

---

## 1. App-shell placeholder (kills the white flash)

**Before:** `index.html` had an empty `<div id="root"></div>`. The visitor saw a
blank white screen until the JS bundle downloaded, parsed, and React mounted — only
*then* did the menu skeleton appear.

**After:** a branded spinner is rendered *inside* the root div as static HTML +
inline CSS, so it paints on the first frame — before the JS bundle even downloads.

```html
<div id="root">
  <div id="app-shell">
    <div class="brand">LUCKY FOODS</div>
    <div class="spinner"></div>
  </div>
</div>
```

**Why it needs no JavaScript:** React's `createRoot(...).render()` *replaces* the
existing children of `#root` on first mount, so the shell disappears automatically
the instant `App` paints. No effect hook, no manual `.remove()`.

**Effect:** blank white screen → instant branded spinner.

---

## 2. Menu cache — stale-while-revalidate (biggest perceived win)

**Before:** `MenuView` fetched `/api/menu` fresh on every mount and showed the
skeleton until the response arrived — even though the menu rarely changes between
visits.

**After:** the menu is cached in `localStorage` under `menu_cache_v1`:

1. On mount, hydrate `menu` from the cache via `useMemo` → returning visitors see
   the **real menu with images instantly**, with no skeleton (`loading` starts
   `false` when a cache exists).
2. A background fetch still runs; on success it swaps in fresh data and re-caches.
3. The skeleton only appears on a **true first visit** (no cache).
4. If the background refetch fails while stale data is on screen, the app **keeps
   the stale menu** instead of showing an error — the error only surfaces when there
   is nothing to show.

All `localStorage` access is wrapped in `try/catch` to stay safe in private mode /
quota-exceeded situations.

**Key helper:**

```js
const MENU_CACHE_KEY = 'menu_cache_v1';
const readMenuCache = () => { /* JSON.parse from localStorage, guarded */ };
```

**Tradeoff:** a returning visitor sees the *last-seen* menu for a split second
before the fresh copy lands. If an admin just changed a price, it flashes the old
value then self-corrects. Acceptable for a menu. The `_v1` suffix lets us bust the
cache later if the data shape changes.

---

## 3. Honest cold-start messaging

**Before:** the first-visit loading messages were `Slow connection…` and
`Retrying…`, which read like *something is broken*.

**After:** they explain the Render wake-up so the wait reads as expected:

- `Waking up the kitchen — first visit can take up to a minute…`
- `Almost there — finishing up…`

These messages only appear when there is **no cache** (a genuine first load); they
stay silent on background refreshes for returning visitors.

---

## 4. Backend warm-up ping (overlaps the cold start)

**Goal:** start waking the Render instance *before* the first real API call, so the
cold start overlaps with the page download instead of stacking on top of it.

Added to the very top of `<head>` in `index.html`, before fonts/CSS/JS:

```html
<link rel="preconnect" href="%VITE_API_BASE_URL%" crossorigin />
<script>
  (function () {
    var base = '%VITE_API_BASE_URL%';
    if (base.indexOf('%') === 0) base = '';   // fallback to dev proxy if unset
    try { fetch(base + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(function () {}); } catch (e) {}
  })();
</script>
```

**Details:**

- **`preconnect`** pre-warms DNS + the TLS handshake to the API origin.
- **The `/health` ping** kicks the instance awake. `/health` is the ideal target:
  it hits no database, returns 200 instantly, and is mounted **before** the `/api`
  rate limiter in `backend/server.js`, so the ping never consumes API quota.
- **`%VITE_API_BASE_URL%`** is substituted by Vite at build time (the inline script
  can't read `import.meta.env`). In production it becomes the Render URL; if the env
  var is unset it falls back to a relative path (the Vite dev proxy).
- **`mode: 'no-cors'`** — we never read the response (we only need the request to
  land), so there are no CORS errors despite the cross-origin call.

**Timeline:**

```
Before:  [HTML+JS download] → React mounts → /api/menu fires → 🥶 30-60s cold start
After:   /health fires ───────────────────────────┐
         [HTML+JS download] → React mounts → /api/menu fires (instance already waking)
```

This does **not** eliminate the cold start — it shaves the page-download portion off
the wait. Only an external pinger fully prevents it (see below).

---

## How the layers stack

| Visit type | Result after all four layers |
|------------|------------------------------|
| First ever (cold backend) | Instant app-shell → skeleton with honest "waking up" copy; warm-up ping already started the instance during download |
| Returning visitor (warm or cold) | Instant app-shell → **real menu immediately** from cache → fresh data swaps in silently |

---

## Not done (intentionally)

- **External uptime pinger** (cron-job.org / UptimeRobot hitting `/health` every
  ~14 min) is the only thing that fully prevents the *first*-visit cold start. It
  was skipped because it largely defeats the point of the free tier (burns the
  monthly free hours). The `/health` endpoint already exists if we ever want to
  enable it.
- **Code splitting** (`React.lazy` on the heavy `ManagerView` / `AdminPanel` /
  `CheckoutScreen`) to shrink the initial bundle. This is the next planned step and
  requires first splitting the single `App.jsx` into separate files.
