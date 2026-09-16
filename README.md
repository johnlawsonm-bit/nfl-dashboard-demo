This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Season Projections (ML feature)

A "Season Projections" tab adds a real, fitted machine-learning projection: given a
team, it predicts the team's expected points in each remaining game of the season
and aggregates those into a projected final win-loss record. All code lives in `ml/`.

Everything (training data, current-season stats, remaining schedule) comes from this
project's own Supabase dataset — the same dummy/fictional data the rest of the
dashboard uses. Team names stay fictional throughout; nothing here uses real NFL
branding. Season 2025 (fully played) is used as "previous season," and season 2026
weeks 1–2 are the "current season so far," matching the assignment's feature set.

### Architecture

- **`ml/pipeline_def.py`** — `TeamStrengthTransformer`, a custom
  `BaseEstimator`/`TransformerMixin` that learns a shrinkage-weighted
  offensive/defensive rating per team during `.fit()` and engineers 4 extra
  numeric features from it at `.transform()` time.
- **`ml/build_pipeline.py`** — pulls teams/games/team_stats from Supabase, builds a
  leakage-free training set (608 rows from 304 "Final" games), fits
  `Pipeline([TeamStrengthTransformer, RandomForestRegressor])` to predict a team's
  expected points in its next game, and saves a bundle dict (pipeline + team data +
  schedule + metadata) to `ml/pipeline.joblib` via `joblib.dump`.
- **`ml/serve.py`** — FastAPI app. Loads `pipeline.joblib` once at import time
  (never refits). `GET /health`, `GET /pipeline-info`, `POST /project`.
- **`ml/modal_serve.py`** — deploys `serve.py` to [Modal](https://modal.com), pinning
  scikit-learn to the exact version recorded in the artifact's metadata.
- **`ml/postman_collection.json`** — Postman/newman tests against the **deployed**
  Modal URL (health, pipeline-info, valid project → 200, invalid project → 422).
- **`src/components/tabs/projections-tab.tsx`** — the dashboard tab that calls the
  live Modal API via `NEXT_PUBLIC_PROJECTIONS_API_URL`.

### 1. Install dependencies

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install scikit-learn pandas numpy joblib fastapi "uvicorn[standard]" requests python-dotenv pydantic modal
```

### 2. Build the artifact

Requires `.env.local` at the repo root with `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (already present for the main app).

```bash
source .venv/bin/activate
python build_pipeline.py
```

This fetches training data from Supabase, fits the pipeline, and writes
`ml/pipeline.joblib`. It prints the exact `scikit-learn` version used — that same
version is what `modal_serve.py` pins in the deployed image.

### 3. Run the API locally

```bash
source .venv/bin/activate
uvicorn serve:app --reload
```

### 4. Test /docs

Open http://localhost:8000/docs and try `/health`, `/pipeline-info`, and `/project`
(e.g. body `{"team_id": "<a team's UUID from the teams table>"}`).

### 5. Deploy to Modal

```bash
modal token new          # one-time browser login, if not already authenticated
source .venv/bin/activate
modal deploy modal_serve.py
```

Note the printed `*.modal.run` URL — that's the live API base URL.

### 6. Configure the Vercel API URL

In the Vercel project's **Settings → Environment Variables** (or **Environments** in
newer Vercel UIs → Production → Environment Variables), add:

- **Key:** `NEXT_PUBLIC_PROJECTIONS_API_URL`
- **Value:** the `*.modal.run` URL from step 5 (as a **Plain Text**, not
  Sensitive/Secret, variable — it's a public API URL)

For local dev, add the same key/value to `.env.local`.

### 7. Deploy the frontend

Push to the `main` branch — Vercel's GitHub integration auto-builds and deploys.
`NEXT_PUBLIC_*` variables are baked in at build time, so a new deploy is required
any time the env var changes.

### 8. Run the Postman collection

```bash
npx newman run ml/postman_collection.json --reporters cli,htmlextra \
  --reporter-htmlextra-export ml/postman_report.html
```

Collection variables `MODAL_URL` and `VALID_TEAM_ID` are pre-filled with the current
deployment's URL and a valid team id; update them if you redeploy or rebuild the
artifact with fresh team UUIDs.

### Model explanation

**Model type:** `RandomForestRegressor` inside a two-step sklearn `Pipeline`
(`TeamStrengthTransformer` → `RandomForestRegressor`) — chosen because it's robust to
a small, noisy dataset without requiring feature scaling, keeping the pipeline
"reasonably simple and reliable" per the assignment rather than over-engineered.
**What it predicts:** a team's expected points scored in its next game, given
pre-game features (home/away, previous-season win %, current-season rolling
scoring/allowed averages, and the two team-strength ratings). Win probability for
each remaining game is then derived from the predicted point differential between a
team and its opponent via a logistic function calibrated to the league's actual
scoring spread, and those probabilities are summed into a projected final record.
**Custom transformer:** `TeamStrengthTransformer` (in `pipeline_def.py`) — learns a
shrinkage-weighted offensive and defensive point rating per team from the training
games during `.fit()`, then adds four engineered columns (team/opponent
offense/defense rating) at `.transform()` time.
**scikit-learn version:** recorded exactly in `pipeline.joblib`'s
`metadata.sklearn_version` (currently `1.9.1`) and pinned identically in the Modal
deployment image.
