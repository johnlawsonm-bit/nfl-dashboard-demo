"""
FastAPI service that serves NFL season projections from the pre-fitted
pipeline.joblib bundle built by build_pipeline.py.

The artifact is loaded exactly once, at module import time. No fitting or
rebuilding ever happens here -- if the artifact can't be loaded, /health
reports 503 and /project fails closed.

Run locally:
    source .venv/bin/activate
    uvicorn serve:app --reload
Then open http://localhost:8000/docs
"""
from __future__ import annotations

import math
import os

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from pipeline_def import TeamStrengthTransformer, make_feature_row  # noqa: F401 (needed to unpickle)

ARTIFACT_PATH = os.path.join(os.path.dirname(__file__), "pipeline.joblib")

_load_error: str | None = None
try:
    BUNDLE = joblib.load(ARTIFACT_PATH)
except Exception as exc:  # noqa: BLE001 - we want /health to report *any* load failure
    BUNDLE = None
    _load_error = str(exc)

VALID_TEAM_IDS: set[str] = set(BUNDLE["teams_by_id"].keys()) if BUNDLE else set()
SUPPORTED_SEASON: int = BUNDLE["current_season"] if BUNDLE else 0

app = FastAPI(title="NFL Season Projection API", version="1.0.0")

# The dashboard frontend (localhost during dev, the deployed Vercel site)
# calls this API directly from the browser, so it needs CORS enabled.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ProjectRequest(BaseModel):
    team_id: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="UUID of the team to project, as used by the dashboard's teams table.",
    )
    season: int = Field(
        default=SUPPORTED_SEASON,
        ge=2020,
        le=2035,
        description="Season to project. Only the bundle's baked-in current season is supported.",
    )

    @field_validator("team_id")
    @classmethod
    def team_must_exist(cls, v: str) -> str:
        # If the bundle failed to load, VALID_TEAM_IDS is empty -- defer to
        # the route handler's explicit 503, don't misreport this as a 422.
        if BUNDLE is None:
            return v
        if v not in VALID_TEAM_IDS:
            raise ValueError(f"unknown team_id: {v!r}")
        return v

    @field_validator("season")
    @classmethod
    def season_must_be_supported(cls, v: int) -> int:
        if BUNDLE is None:
            return v
        if v != SUPPORTED_SEASON:
            raise ValueError(f"season must be the supported current season ({SUPPORTED_SEASON})")
        return v


def _team_record(team_id: str, season: int) -> dict:
    stats = BUNDLE["team_stats_by_key"].get((team_id, season))
    if stats is None:
        return {"wins": 0, "losses": 0, "ties": 0, "points_for": 0, "points_against": 0}
    return stats


def _ctx_from_record(rec: dict, prev_win_pct: float) -> dict:
    gp = rec["wins"] + rec["losses"] + rec["ties"]
    return {
        "prev_season_win_pct": prev_win_pct,
        "rolling_ppg": rec["points_for"] / gp if gp > 0 else 24.0,
        "rolling_papg": rec["points_against"] / gp if gp > 0 else 24.0,
        "current_win_pct": rec["wins"] / gp if gp > 0 else BUNDLE["league_avg_win_pct"],
        "games_played_so_far": gp,
    }


def _win_pct(rec: dict) -> float:
    gp = rec["wins"] + rec["losses"] + rec["ties"]
    return rec["wins"] / gp if gp > 0 else BUNDLE["league_avg_win_pct"]


@app.get("/health")
def health():
    if BUNDLE is None:
        raise HTTPException(status_code=503, detail=f"pipeline artifact not loaded: {_load_error}")
    return {"status": "healthy", "artifact_loaded": True, "teams_loaded": len(VALID_TEAM_IDS)}


@app.get("/pipeline-info")
def pipeline_info():
    if BUNDLE is None:
        raise HTTPException(status_code=503, detail=f"pipeline artifact not loaded: {_load_error}")
    meta = BUNDLE["metadata"]
    return {
        "steps": meta["steps"],
        "built_at": meta["built_at"],
        "sklearn_version": meta["sklearn_version"],
        "target": meta.get("target"),
        "train_rows": meta.get("train_rows"),
        "train_mae_points": meta.get("train_mae_points"),
        "current_season": BUNDLE["current_season"],
        "previous_season": BUNDLE["previous_season"],
    }


@app.post("/project")
def project(req: ProjectRequest):
    if BUNDLE is None:
        raise HTTPException(status_code=503, detail=f"pipeline artifact not loaded: {_load_error}")

    pipeline = BUNDLE["pipeline"]
    team_id = req.team_id
    season = req.season
    team_info = BUNDLE["teams_by_id"][team_id]

    prev_win_pct_by_team = {
        tid: _win_pct(BUNDLE["team_stats_by_key"].get((tid, BUNDLE["previous_season"]), {"wins": 0, "losses": 0, "ties": 0}))
        for tid in VALID_TEAM_IDS
    }

    current_rec = _team_record(team_id, season)
    current_gp = current_rec["wins"] + current_rec["losses"] + current_rec["ties"]

    remaining_games = [
        g for g in BUNDLE["schedule_current_season"]
        if g["status"] == "Scheduled" and (g["home_team_id"] == team_id or g["away_team_id"] == team_id)
    ]
    remaining_games.sort(key=lambda g: g["week"])

    game_projections = []
    expected_wins_sum = 0.0

    for g in remaining_games:
        is_home = g["home_team_id"] == team_id
        opp_id = g["away_team_id"] if is_home else g["home_team_id"]
        opp_info = BUNDLE["teams_by_id"][opp_id]

        team_rec = _team_record(team_id, season)
        opp_rec = _team_record(opp_id, season)
        team_ctx = _ctx_from_record(team_rec, prev_win_pct_by_team.get(team_id, BUNDLE["league_avg_win_pct"]))
        opp_ctx = _ctx_from_record(opp_rec, prev_win_pct_by_team.get(opp_id, BUNDLE["league_avg_win_pct"]))

        team_row = pd.DataFrame(
            [make_feature_row(team_id, team_ctx, opp_id, opp_ctx, is_home=is_home)],
            columns=BUNDLE["feature_columns"],
        )
        opp_row = pd.DataFrame(
            [make_feature_row(opp_id, opp_ctx, team_id, team_ctx, is_home=not is_home)],
            columns=BUNDLE["feature_columns"],
        )

        team_exp_pts = float(pipeline.predict(team_row)[0])
        opp_exp_pts = float(pipeline.predict(opp_row)[0])

        diff = team_exp_pts - opp_exp_pts
        win_prob = 1.0 / (1.0 + math.exp(-diff / BUNDLE["win_prob_scale"]))
        expected_wins_sum += win_prob

        game_projections.append({
            "week": g["week"],
            "opponent_team_id": opp_id,
            "opponent_name": opp_info["name"],
            "is_home": is_home,
            "team_expected_points": round(team_exp_pts, 1),
            "opponent_expected_points": round(opp_exp_pts, 1),
            "team_win_probability": round(win_prob, 3),
        })

    projected_remaining_wins = expected_wins_sum
    projected_remaining_losses = len(remaining_games) - expected_wins_sum
    projected_final_wins = current_rec["wins"] + projected_remaining_wins
    projected_final_losses = current_rec["losses"] + projected_remaining_losses

    avg_expected_points = (
        sum(gp["team_expected_points"] for gp in game_projections) / len(game_projections)
        if game_projections else None
    )

    return {
        "team": {"id": team_id, "name": team_info["name"], "city": team_info["city"]},
        "season": season,
        "current_record": {
            "wins": current_rec["wins"], "losses": current_rec["losses"], "ties": current_rec["ties"],
            "games_played": current_gp,
            "points_for": current_rec["points_for"], "points_against": current_rec["points_against"],
        },
        "previous_season_win_total": {
            "season": BUNDLE["previous_season"],
            "wins": BUNDLE["team_stats_by_key"].get((team_id, BUNDLE["previous_season"]), {}).get("wins"),
            "losses": BUNDLE["team_stats_by_key"].get((team_id, BUNDLE["previous_season"]), {}).get("losses"),
        },
        "remaining_schedule": game_projections,
        "projection": {
            "remaining_games": len(remaining_games),
            "projected_remaining_wins": round(projected_remaining_wins, 2),
            "projected_remaining_losses": round(projected_remaining_losses, 2),
            "projected_final_wins": round(projected_final_wins, 2),
            "projected_final_losses": round(projected_final_losses, 2),
            "projected_final_wins_rounded": round(projected_final_wins),
            "projected_final_losses_rounded": BUNDLE["weeks_per_season"] - round(projected_final_wins),
            "projected_final_record": f"{round(projected_final_wins)}-{BUNDLE['weeks_per_season'] - round(projected_final_wins)}",
            "avg_expected_points_remaining_games": round(avg_expected_points, 1) if avg_expected_points else None,
        },
    }
