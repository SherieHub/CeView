"""Pure-numpy signal processing for Module 2.1.

All functions are stateless and have no external dependencies beyond numpy.
"""
from __future__ import annotations

import numpy as np


def normalize_trend_index(v: float) -> float:
    return float(max(0.0, min(100.0, v)))


def compute_rolling_mean(series: list[float], window: int = 4) -> float:
    if not series:
        return 0.0
    arr = np.array(series[-window:], dtype=np.float64)
    return float(arr.mean())


def compute_rolling_std_dev(series: list[float], window: int = 4) -> float:
    if len(series) < 2:
        return 0.0
    arr = np.array(series[-window:], dtype=np.float64)
    return float(arr.std(ddof=0))


def compute_spike_indicator(rolling_std: float, rolling_mean: float, multiplier: float = 1.5) -> bool:
    if rolling_mean == 0.0:
        return False
    return rolling_std > multiplier * rolling_mean


def compute_seasonality_score(weekly_history: list[float]) -> float:
    """FFT peak-ratio seasonality analysis.

    Requires ≥ 52 weeks of data; returns neutral 0.5 if insufficient history.
    Peak ratio = dominant non-DC frequency amplitude / total spectrum energy.
    """
    if len(weekly_history) < 52:
        return 0.5

    arr = np.array(weekly_history, dtype=np.float32)
    arr = arr - arr.mean()  # remove DC component

    spectrum = np.abs(np.fft.rfft(arr))
    total_energy = float(spectrum.sum())

    if total_energy == 0.0:
        return 0.0

    peak_amplitude = float(spectrum[1:].max())  # skip DC bin 0
    return float(min(1.0, peak_amplitude / total_energy))
