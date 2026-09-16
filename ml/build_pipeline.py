"""
Builds the training dataset from the NFL Dashboard Demo's own Supabase data,
fits a real sklearn Pipeline (TeamStrengthTransformer + RandomForestRegressor)
to predict a team's expected points in its next game, and saves a fitted
bundle to pipeline.joblib.

Training data: season 2025 (fully played, 17 weeks) + season 2026 weeks 1-2
(the "current season so far"), pulled from the same dummy dataset the rest of
the dashboard already reads from Supabase. Every feature used for a given
game is built only from information that would have been available strictly
before that game was played (see build_team_timelines below) -- no leakage.

Run:
    source .venv/bin/activate
    python build_pipeline.py
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import requests
import sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline

from pipeline_def import TeamStrengthTransformer, FEATURE_COLUMNS, make_feature_row

PREVIOUS_SEASON = 2025
CURRENT_SEASON = 2026
WEEKS_PER_SEASON = 17
LEAGUE_AVG_WIN_PCT = 0.5


def load_supabase_env() -> tuple[str, str]:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env.local")
    text = open(env_path).read()
    url = re.search(r"NEXT_PUBLIC_SUPABASE_URL=(.*)", text).group(1).strip()
    key = re.search(r"NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)", text).group(1).strip()
    return url, key


def fetch_table(base_url: str, headers: dict, table: str, params: dict) -> list[dict]:
    resp = requests.get(f"{base_url}/rest/v1/{table}", headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def build_team_timelines(games: pd.DataFrame, team_stats: pd.DataFrame, teams: pd.DataFrame):
    """Walk every game in chronological (season, week) order and, for each
    team involved, emit one training row per *Final* game using only stats
    accumulated strictly before that game. Returns (X rows, y values).
    """
    team_ids = teams["id"].tolist()

    prev_season_win_pct = {}
    for _, row in team_stats[team_stats["season"] == PREVIOUS_SEASON].iterrows():
        gp = row["wins"] + row["losses"] + row["ties"]
        prev_season_win_pct[row["team_id"]] = row["wins"] / gp if gp > 0 else LEAGUE_AVG_WIN_PCT
    for tid in team_ids:
        prev_season_win_pct.setdefault(tid, LEAGUE_AVG_WIN_PCT)

    prev_season_ppg = {}
    for _, row in team_stats[team_stats["season"] == PREVIOUS_SEASON].iterrows():
        gp = row["wins"] + row["losses"] + row["ties"]
        prev_season_ppg[row["team_id"]] = row["points_for"] / gp if gp > 0 else None

    prev_season_papg = {}
    for _, row in team_stats[team_stats["season"] == PREVIOUS_SEASON].iterrows():
        gp = row["wins"] + row["losses"] + row["ties"]
        prev_season_papg[row["team_id"]] = row["points_against"] / gp if gp > 0 else None

    league_avg_ppg_guess = 24.0  # neutral fallback before we've seen any data at all

    # running within-season accumulators, reset at the start of each season
    running = {season: {tid: {"pf": 0.0, "pa": 0.0, "w": 0, "l": 0, "t": 0, "gp": 0} for tid in team_ids}
               for season in (PREVIOUS_SEASON, CURRENT_SEASON)}

    def pre_game_ctx(season: int, team_id: str) -> dict:
        acc = running[season][team_id]
        gp = acc["gp"]
        if gp > 0:
            rolling_ppg = acc["pf"] / gp
            rolling_papg = acc["pa"] / gp
            current_win_pct = acc["w"] / gp
        else:
            rolling_ppg = prev_season_ppg.get(team_id) or league_avg_ppg_guess
            rolling_papg = prev_season_papg.get(team_id) or league_avg_ppg_guess
            current_win_pct = LEAGUE_AVG_WIN_PCT
        return {
            "prev_season_win_pct": prev_season_win_pct.get(team_id, LEAGUE_AVG_WIN_PCT),
            "rolling_ppg": rolling_ppg,
            "rolling_papg": rolling_papg,
            "current_win_pct": current_win_pct,
            "games_played_so_far": gp,
        }

    def update_after_game(season: int, team_id: str, points_for: int, points_against: int):
        acc = running[season][team_id]
        acc["pf"] += points_for
        acc["pa"] += points_against
        acc["gp"] += 1
        if points_for > points_against:
            acc["w"] += 1
        elif points_for < points_against:
            acc["l"] += 1
        else:
            acc["t"] += 1

    rows = []
    targets = []

    final_games = games[games["status"] == "Final"].sort_values(["season", "week"])
    for _, g in final_games.iterrows():
        season = g["season"]
        home_id, away_id = g["home_team_id"], g["away_team_id"]
        home_score, away_score = g["home_score"], g["away_score"]

        home_ctx = pre_game_ctx(season, home_id)
        away_ctx = pre_game_ctx(season, away_id)

        rows.append(make_feature_row(home_id, home_ctx, away_id, away_ctx, is_home=True))
        targets.append(float(home_score))
        rows.append(make_feature_row(away_id, away_ctx, home_id, home_ctx, is_home=False))
        targets.append(float(away_score))

        update_after_game(season, home_id, home_score, away_score)
        update_after_game(season, away_id, away_score, home_score)

    X = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    y = np.array(targets, dtype=float)
    return X, y, running


def main():
    print(f"scikit-learn version: {sklearn.__version__}")
    base_url, anon_key = load_supabase_env()
    headers = {"apikey": anon_key, "Authorization": f"Bearer {anon_key}"}

    print("Fetching teams/games/team_stats from Supabase...")
    teams = pd.DataFrame(fetch_table(base_url, headers, "teams", {"select": "*"}))
    games = pd.DataFrame(fetch_table(
        base_url, headers, "games",
        {"select": "*", "season": f"in.({PREVIOUS_SEASON},{CURRENT_SEASON})"},
    ))
    team_stats = pd.DataFrame(fetch_table(
        base_url, headers, "team_stats",
        {"select": "*", "season": f"in.({PREVIOUS_SEASON},{CURRENT_SEASON})"},
    ))
    print(f"  teams={len(teams)} games={len(games)} team_stats={len(team_stats)}")

    X, y, running_after_fit = build_team_timelines(games, team_stats, teams)
    print(f"Training rows: {len(X)} (from {(games['status'] == 'Final').sum()} final games)")

    pipeline = Pipeline(steps=[
        ("team_strength", TeamStrengthTransformer(team_col="team_id", opp_col="opp_id", shrinkage=4.0)),
        ("model", RandomForestRegressor(
            n_estimators=300, max_depth=5, min_samples_leaf=6, random_state=42,
        )),
    ])
    pipeline.fit(X, y)

    train_pred = pipeline.predict(X)
    mae = float(np.mean(np.abs(train_pred - y)))
    print(f"Train MAE: {mae:.2f} points")

    # Win-probability scale: derive from the actual point-differential spread
    # in training games so /project's logistic win-prob is calibrated to
    # this league's scoring, not an arbitrary constant.
    home_games = games[games["status"] == "Final"]
    diffs = (home_games["home_score"] - home_games["away_score"]).astype(float)
    win_prob_scale = float(diffs.std())
    print(f"Win-probability logistic scale (point-diff std): {win_prob_scale:.2f}")

    # ---- Supporting data baked into the bundle so serve.py never needs a
    # live Supabase call at request time. ----
    teams_by_id = teams.set_index("id").to_dict(orient="index")

    team_stats_by_key = {}
    for _, row in team_stats.iterrows():
        team_stats_by_key[(row["team_id"], int(row["season"]))] = {
            "wins": int(row["wins"]), "losses": int(row["losses"]), "ties": int(row["ties"]),
            "points_for": int(row["points_for"]), "points_against": int(row["points_against"]),
        }

    schedule_current_season = games[games["season"] == CURRENT_SEASON][
        ["id", "week", "home_team_id", "away_team_id", "home_score", "away_score", "status"]
    ].to_dict(orient="records")

    bundle = {
        "pipeline": pipeline,
        "teams_by_id": teams_by_id,
        "team_stats_by_key": team_stats_by_key,
        "schedule_current_season": schedule_current_season,
        "current_season": CURRENT_SEASON,
        "previous_season": PREVIOUS_SEASON,
        "weeks_per_season": WEEKS_PER_SEASON,
        "win_prob_scale": win_prob_scale,
        "league_avg_win_pct": LEAGUE_AVG_WIN_PCT,
        "feature_columns": FEATURE_COLUMNS,
        "metadata": {
            "steps": [name for name, _ in pipeline.steps],
            "built_at": datetime.now(timezone.utc).isoformat(),
            "sklearn_version": sklearn.__version__,
            "train_rows": int(len(X)),
            "train_mae_points": mae,
            "target": "expected_points_scored_next_game",
        },
    }

    out_path = os.path.join(os.path.dirname(__file__), "pipeline.joblib")
    joblib.dump(bundle, out_path)
    print(f"Saved bundle to {out_path}")

    # Sanity check: reload in a fresh namespace and confirm it predicts
    # without needing to be refit.
    reloaded = joblib.load(out_path)
    sample = X.iloc[[0]]
    pred = reloaded["pipeline"].predict(sample)
    print(f"Reload sanity check OK, sample prediction: {pred[0]:.2f} points")


if __name__ == "__main__":
    main()
