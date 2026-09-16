"""
Custom sklearn transformer(s) used by the NFL season-projection Pipeline.

Must be importable both when building the pipeline (build_pipeline.py) and
when loading the fitted artifact (serve.py, and on Modal) since joblib needs
the class definition available at unpickle time.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class TeamStrengthTransformer(BaseEstimator, TransformerMixin):
    """Learns a simple offensive/defensive power rating per team from the
    training games, then engineers four extra numeric columns (team/opponent
    offensive and defensive rating) on top of the passthrough numeric
    features already present in X.

    The ratings are shrunk toward the league average based on how many
    games a team appears in, so teams with few observed games don't get an
    overconfident rating.

    Parameters (assigned as-is in __init__, nothing else happens there):
        team_col: name of the column holding the team's id for this row.
        opp_col: name of the column holding the opponent's id for this row.
        shrinkage: pseudo-count used to shrink a team's rating toward the
            league average (higher = more shrinkage, more conservative).
    """

    def __init__(self, team_col: str = "team_id", opp_col: str = "opp_id", shrinkage: float = 4.0):
        self.team_col = team_col
        self.opp_col = opp_col
        self.shrinkage = shrinkage

    def fit(self, X: pd.DataFrame, y=None):
        if y is None:
            raise ValueError("TeamStrengthTransformer requires y (points scored) during fit.")

        df = X.reset_index(drop=True).copy()
        y = np.asarray(y, dtype=float)
        df["__y"] = y

        self.league_avg_ = float(df["__y"].mean())

        # Offensive rating: shrunk average points scored *by* this team across training rows.
        off_stats = df.groupby(self.team_col)["__y"].agg(["mean", "count"])
        self.off_rating_ = {
            team: (row["count"] * row["mean"] + self.shrinkage * self.league_avg_)
            / (row["count"] + self.shrinkage)
            for team, row in off_stats.iterrows()
        }

        # Defensive rating: shrunk average points scored *against* this team
        # (i.e. points scored by whoever had them as the opponent).
        def_stats = df.groupby(self.opp_col)["__y"].agg(["mean", "count"])
        self.def_rating_ = {
            team: (row["count"] * row["mean"] + self.shrinkage * self.league_avg_)
            / (row["count"] + self.shrinkage)
            for team, row in def_stats.iterrows()
        }

        self.n_teams_ = len(set(self.off_rating_) | set(self.def_rating_))
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if not hasattr(self, "off_rating_"):
            raise RuntimeError("TeamStrengthTransformer.transform called before fit().")

        df = X.reset_index(drop=True).copy()
        df["team_off_rating"] = df[self.team_col].map(self.off_rating_).fillna(self.league_avg_)
        df["team_def_rating"] = df[self.team_col].map(self.def_rating_).fillna(self.league_avg_)
        df["opp_off_rating"] = df[self.opp_col].map(self.off_rating_).fillna(self.league_avg_)
        df["opp_def_rating"] = df[self.opp_col].map(self.def_rating_).fillna(self.league_avg_)

        feature_cols = [c for c in df.columns if c not in (self.team_col, self.opp_col)]
        return df[feature_cols].to_numpy(dtype=float)

    def get_feature_names_out(self, input_features=None):
        base = [c for c in (input_features or []) if c not in (self.team_col, self.opp_col)]
        return np.array(base + ["team_off_rating", "team_def_rating", "opp_off_rating", "opp_def_rating"])


# Column order the Pipeline was fit on. build_pipeline.py and serve.py both
# build feature rows through make_feature_row() so training-time and
# inference-time feature construction can never drift apart.
FEATURE_COLUMNS = [
    "team_id",
    "opp_id",
    "is_home",
    "team_prev_season_win_pct",
    "team_rolling_ppg",
    "team_rolling_papg",
    "team_current_win_pct",
    "team_games_played_so_far",
    "opp_prev_season_win_pct",
    "opp_rolling_ppg",
    "opp_rolling_papg",
    "opp_current_win_pct",
    "opp_games_played_so_far",
]


def make_feature_row(team_id: str, team_ctx: dict, opp_id: str, opp_ctx: dict, is_home: bool) -> dict:
    """Build one feature row (team's perspective) from pre-game context dicts.

    team_ctx / opp_ctx each hold: prev_season_win_pct, rolling_ppg,
    rolling_papg, current_win_pct, games_played_so_far -- all values that
    must be knowable *before* the game being featurized is played.
    """
    return {
        "team_id": team_id,
        "opp_id": opp_id,
        "is_home": 1.0 if is_home else 0.0,
        "team_prev_season_win_pct": team_ctx["prev_season_win_pct"],
        "team_rolling_ppg": team_ctx["rolling_ppg"],
        "team_rolling_papg": team_ctx["rolling_papg"],
        "team_current_win_pct": team_ctx["current_win_pct"],
        "team_games_played_so_far": team_ctx["games_played_so_far"],
        "opp_prev_season_win_pct": opp_ctx["prev_season_win_pct"],
        "opp_rolling_ppg": opp_ctx["rolling_ppg"],
        "opp_rolling_papg": opp_ctx["rolling_papg"],
        "opp_current_win_pct": opp_ctx["current_win_pct"],
        "opp_games_played_so_far": opp_ctx["games_played_so_far"],
    }
