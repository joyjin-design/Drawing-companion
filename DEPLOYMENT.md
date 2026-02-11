# Deploying to Vercel

The Gemini API key is **never** sent to the browser. The frontend calls your own API routes (`/api/outline`, `/api/shading`, `/api/evaluate`), and those routes use the key on the server.

## Environment variables on Vercel

1. **Vercel** → your project → **Settings** → **Environment Variables**.

2. **Add (or update):**

   | Name | Value | Where | Notes |
   |------|--------|--------|--------|
   | `GEMINI_API_KEY` | Your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) | **Production** (and **Preview** if you use preview URLs) | **Server-only.** No `VITE_` prefix – it is not exposed to the browser. |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Optional | For backup/sync |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Optional | For backup/sync |

3. **Do not set** `VITE_GEMINI_API_KEY` in production. The key is used only in API routes via `GEMINI_API_KEY`.

4. **Redeploy** after changing env vars (Deployments → ⋯ → Redeploy).

## Local development

- **Production (Vercel):** The app is served from the same origin as `/api`, so it calls `/api/outline` etc. with no extra config.

- **Local (`npm run dev`):** The dev server has no API routes. Either:
  - **Option A:** Set `VITE_API_ORIGIN` to your deployed URL (e.g. `https://your-app.vercel.app`) so the local app calls your deployed API. Add to `.env`:
    ```env
    VITE_API_ORIGIN=https://your-app.vercel.app
    ```
  - **Option B:** Run `vercel dev` so both the app and API run locally (API will use `GEMINI_API_KEY` from a local `.env` if you add it for dev).

## Dependencies and npm audit

`npm audit` may report vulnerabilities in transitive dependencies of `@vercel/node` (e.g. `path-to-regexp`, `undici`). These live in Vercel’s serverless runtime; our code only uses the `VercelRequest` / `VercelResponse` types.

- **Do not run `npm audit fix --force`.** It downgrades `@vercel/node` to 4.x and introduces more issues (e.g. esbuild, tar). Keep `@vercel/node` at **5.x** until Vercel publishes a release that uses patched versions of those dependencies.
- After upgrading `@vercel/node` in the future, run `npm audit` again to confirm.

## Quick check

- **"Server missing GEMINI_API_KEY"** → Set `GEMINI_API_KEY` in Vercel (not `VITE_GEMINI_API_KEY`) and redeploy.
- **CORS or network errors in dev** → Ensure `VITE_API_ORIGIN` points to your deployed URL (with `https://`) and that the deployed API is working.
