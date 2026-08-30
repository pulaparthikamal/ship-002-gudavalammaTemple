# Deployment

How to put this app live, for $0, using free tiers only. No trials, no "free for 14 days," nothing that needs a credit card to start.

## Architecture — what goes where, and why

| Piece | Where | Why |
|---|---|---|
| **Frontend** (`Admin/`, Vite/React SPA) | **Vercel** (free Hobby plan) | You asked for Vercel; it's also genuinely the best free static/SPA host — instant CDN, automatic HTTPS, zero config beyond the build command. |
| **Backend** (`server/`, Express) | **Render** (free Web Service) | This API needs a real, *persistent* Node process — it runs a nightly `node-cron` job and writes uploaded files to local disk. Vercel only runs your backend as short-lived serverless functions (no persistent process, no writable disk, cron jobs limited to once/day on the free plan) — that would break both features without extra rework. Render's free Web Service is a real long-running container, no card required. |
| **Database** | **MongoDB Atlas** (free M0 cluster, 512 MB) | The standard free MongoDB host. No card needed for M0. |
| **Domain** | Vercel's free `*.vercel.app` subdomain by default | See the **Domain** section — a real `gudavalammatemple.com` is not free anywhere legitimate; this is the one place "free" has a hard limit. |

### The honest tradeoffs of going 100% free

Be aware of these going in — none of them will crash the app, they just quietly degrade:

1. **Render's free tier sleeps after 15 minutes of no traffic**, then takes ~30-50s to wake on the next request (the first visitor after a quiet spell waits). It also means the nightly analytics-rollup cron job won't fire if the service is asleep at 1am. **Fix**: a free external uptime pinger (below) solves both problems at once.
2. **Uploaded images (temple logo, deity picture, announcement banners) live on Render's local disk, which is ephemeral** — a redeploy or restart can wipe it. Fine for a temple site's low-frequency admin uploads (re-upload if it happens), but don't treat it as permanent storage. If this ever matters, swap the `upload` module to a free tier of Cloudinary or Vercel Blob — not done here, out of scope for the free launch.
3. **Translation/transliteration won't do anything in production.** The app's translation pipeline falls back to LibreTranslate + a self-hosted LLM (Ollama), both configured at `localhost` in dev — neither is reachable from a cloud host. This is not a crash: `translationService` is deliberately built to fail closed and just show the original English text when its backend is unreachable (see `ARCHITECTURE.md`). Real translation would require pointing `LLM_PROVIDER` at OpenAI with a paid API key, or self-hosting LibreTranslate/Ollama somewhere reachable — a deliberate later upgrade, not part of this free setup.
4. **WhatsApp confirmations need a Meta Business/WhatsApp Cloud API setup** (free, but a real signup with its own approval process) — leave `WHATSAPP_*` env vars blank to skip this at launch; the app already treats it as optional and just skips sending.

---

## Step 1 — MongoDB Atlas (the database)

1. Go to mongodb.com/cloud/atlas/register, sign up (no card asked for the free tier).
2. Create a project, then **Build a Database** → pick **M0 Free**.
3. **Database Access** → add a database user (username + password — save these, you need them for the connection string).

trailskamal_db_user.  rBQmovm2IGFMKugb
4. **Network Access** → add IP address → **Allow access from anywhere** (`0.0.0.0/0`). Render's free tier has no fixed IP, so this is required, not a shortcut.
5. **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Append a database name before the `?`, e.g. `.../gudavalammaTemple?retryWrites=...` — this becomes your `MONGO_URI`.

## Step 2 — Render (the backend API)

1. Push this repo to GitHub if it isn't already the remote you're deploying from (`git remote -v` already shows `origin` pointing at `pulaparthikamal/gudavalammaTemple` — deploy from whichever branch you consider production, e.g. merge `temple_trail_1` into `main` first).
2. dashboard.render.com → sign up (GitHub login is easiest) → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: **Free**
   - **Health Check Path**: `/health` (added specifically for this — see `server/src/app.ts`)
4. **Environment** tab — add every variable from `server/.env.example`, with production values:
   - `NODE_ENV=production`
   - `PORT` — leave unset; Render injects its own `PORT` and the app already reads `process.env.PORT` via `envConfig.port`.
   - `MONGO_URI` — the Atlas connection string from Step 1.
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate real random values, don't reuse the dev placeholders:
     ```bash
     openssl rand -base64 48
     ```
     Run it twice, once per secret.
   - `ALLOWED_ORIGINS` — your Vercel URL(s), e.g. `https://gudavalamma-temple.vercel.app` (add the real domain here too later if you buy one — comma-separated, no spaces, no trailing slash).
   - `FRONTEND_URL` — same Vercel URL.
   - `MAIL_HOST`/`MAIL_PORT`/`MAIL_USER`/`MAIL_PASS`/`MAIL_FROM` — reuse your existing Gmail App Password setup from `server/.env`, or any SMTP you already have. Gmail's free daily send limit (~500/day) is plenty for a temple site's booking confirmations.
   - `UPLOAD_ROOT_DIR=uploads`, `UPLOAD_MAX_FILE_SIZE_MB=50`
   - `LLM_PROVIDER=ollama`, `LLM_BASE_URL=http://127.0.0.1:11434` — leave as-is; per the tradeoffs above this will just silently no-op in production. Don't point it at a real paid LLM unless you're intentionally taking on that cost.
   - `TRANSLATION_PROVIDER=libretranslate`, `LIBRETRANSLATE_URL=http://localhost:5001` — same, silently no-ops.
   - Leave every `WHATSAPP_*` var blank.
5. Deploy. First build takes a few minutes. Once live, Render gives you a URL like `https://gudavalammatemple-api.onrender.com`.
6. **Seed the database once**, from your own machine (not on Render — it's a one-off script, not a persistent process):
   ```bash
   cd server
   MONGO_URI="<the same Atlas URI>" npm run seed
   ```
   This creates the roles (including the new `GUEST` role), menus, seva/darshan catalogs, and languages. It never touches the `users` collection, so it's safe to re-run.
7. **Create your first login.** The seed script doesn't create a user — use `server/src/scripts/list-users.ts` as a reference (it edits `admin@yopmail.com`'s password) or, simpler, register a devotee account via the deployed frontend once it's live, then manually flip that user's `role` to `SUPER_ADMIN` in Atlas's web-based **Collections** browser (`users` collection → edit the document → set `role` to the `SUPER_ADMIN` role's `_id` from the `roles` collection).

### Keep it awake (fixes both the cold-start and the cron job)

Render's free tier sleeps after 15 idle minutes. cron-job.org (free, no card) solves this:
1. Sign up at cron-job.org.
2. Create a job hitting `https://<your-render-url>/health` every **10 minutes**.
3. Done — the service never fully idles, so the 1am analytics rollup fires normally and visitors never hit a cold start.

## Step 3 — Vercel (the frontend)

1. vercel.com → sign up (GitHub login) → **Add New** → **Project** → import the same repo.
2. Settings:
   - **Root Directory**: `Admin`
   - **Framework Preset**: Vite (Vercel auto-detects this)
   - **Build Command**: `npm run build` (default, fine as-is)
   - **Output Directory**: `dist` (default, fine as-is)
   - A `vercel.json` is already committed at `Admin/vercel.json` — it rewrites every path to `index.html` so client-side routes (react-router) don't 404 on refresh/direct link. No action needed, just don't delete it.
3. **Environment Variables**:
   - `VITE_API_BASE_URL` = `https://<your-render-url>/api/v1` (the exact URL from Step 2, with `/api/v1` appended).
4. Deploy. Vercel gives you a free URL immediately: `https://<project-name>.vercel.app`.
5. Go back to Render and double check `ALLOWED_ORIGINS`/`FRONTEND_URL` match this exact URL (including `https://`, no trailing slash) — CORS will reject the frontend otherwise.

## Domain — the one thing that genuinely isn't free

- **Free option**: the `*.vercel.app` URL Vercel gives you in Step 3. Fully free, forever, real HTTPS. This is the default recommendation.
- **`gudavalammatemple.com`**: a real `.com` costs money everywhere legitimate — roughly $9–15/year (Cloudflare Registrar sells at-cost, ~$9.15/yr for `.com`, no markup; Namecheap/Porkbun are similar). There is no free, reputable way to get a real `.com`. (Skip anything advertising "free .com/.tk/.ml domains" — the free-TLD registrar that used to offer this, Freenom, was shut down in 2023 after abuse lawsuits and is not a safe or working option anymore.)
- If you do buy it: point its DNS at Vercel (Vercel's dashboard → **Domains** → add `gudavalammatemple.com` → it gives you the exact A/CNAME records to add at your registrar) and add `https://gudavalammatemple.com` to Render's `ALLOWED_ORIGINS`/`FRONTEND_URL`.

## Redeploying

Both Vercel and Render auto-deploy on every push to the connected branch — no manual redeploy step. Push to `main` (or whichever branch you connected), watch both dashboards.

## Post-deploy smoke test

1. Visit the Vercel URL — the devotee home page should load, showing the deity image and nav.
2. `/login` — sign in with your `SUPER_ADMIN` account.
3. `/temple-profile` — confirm the two image uploaders work (uploads go through Render, so this also proves the API + CORS + Atlas connection all work end to end).
4. Switch the language switcher to Telugu — confirm the UI still renders (translated content will silently stay English per the known tradeoff above — that's expected, not a bug).
5. Register a new devotee account, book a darshan slot — confirms the guest-checkout + booking-ledger + email-confirmation path all work.
