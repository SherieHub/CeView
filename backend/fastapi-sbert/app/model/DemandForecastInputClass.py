from __future__ import annotations

from typing import Any, Dict, List, Literal
from pydantic import BaseModel, Field

# Supported markets in Hugging Face Space JamJamzz/ceview-demand-prediction-model
MarketLiteral = Literal["JP", "KR", "US"]

# Supported tourism categories in Hugging Face Space JamJamzz/ceview-demand-prediction-model
CategoryLiteral = Literal[
    "accommodation_staycation",
    "adventure_nature",
    "coastal_island",
    "culinary_gastronomy",
    "cultural_heritage",
    "theme_parks_entertainment",
    "urban_city",
]


class DemandForecastInputClass(BaseModel):
    """Input contract for calling the Transformer demand prediction model hosted on Hugging Face Spaces.

    Corresponds to the 3 parameters accepted by /forecast:
      - history_json : JSON string containing 52 weekly rows of [trend_scaled, week_sin, week_cos]
      - market       : Target market ('JP' | 'KR' | 'US')
      - category     : Standardized tourism category identifier
    """

    history_json: str = Field(
        ...,
        description="52-week historical series JSON string. Must contain exactly 52 rows of [trend_scaled, week_sin, week_cos].",
    )
    market: MarketLiteral = Field(
        default="KR",
        description="Target origin market. Choices: 'JP' (Japan), 'KR' (South Korea), 'US' (United States).",
    )
    category: CategoryLiteral = Field(
        default="accommodation_staycation",
        description="Standardized CeView tourism category label.",
    )


class WeeklyForecastPoint(BaseModel):
    """Predicted search interest index for an individual week ahead (t+1 through t+12)."""

    week_ahead: int = Field(..., ge=1, le=12, description="Week horizon (1 to 12)")
    google_trends: float = Field(
        ..., ge=0.0, le=100.0, description="Predicted Google Trends search interest index"
    )


class DemandForecastOutputClass(BaseModel):
    """Output contract returned by the Transformer demand prediction model (/forecast)."""

    market: str = Field(..., description="Target market code ('KR', 'JP', 'US')")
    category: str = Field(..., description="Standardized tourism category label")
    weekly_forecasts: List[WeeklyForecastPoint] = Field(
        ..., description="List of 12 predicted weekly search interest indices"
    )
    mean_demand_4_weeks: float = Field(
        ..., ge=0.0, le=100.0, description="Arithmetic mean of predictions for weeks 1 through 4"
    )
    mean_demand_12_weeks: float = Field(
        ..., ge=0.0, le=100.0, description="Arithmetic mean of all 12 weekly predictions"
    )
    model: Dict[str, Any] = Field(
        default_factory=dict, description="Metadata regarding model version, architecture, and training epoch"
    )

