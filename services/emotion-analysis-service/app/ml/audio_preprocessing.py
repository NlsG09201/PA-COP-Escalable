"""Audio I/O, resampling, normalisation and feature extraction utilities."""

from __future__ import annotations

import io
import logging
from typing import Optional

import librosa
import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

_CONTENT_TYPE_MAP: dict[str, str] = {
    "audio/wav": "WAV",
    "audio/x-wav": "WAV",
    "audio/wave": "WAV",
    "audio/mpeg": "MP3",
    "audio/mp3": "MP3",
    "audio/ogg": "OGG",
    "audio/webm": "WEBM",
    "audio/flac": "FLAC",
}


def load_audio(
    audio_bytes: bytes,
    content_type: str,
    target_sr: int = 16_000,
) -> tuple[np.ndarray, int]:
    """Decode raw audio bytes into a mono float32 numpy array at *target_sr*."""
    fmt = _CONTENT_TYPE_MAP.get(content_type)

    try:
        buf = io.BytesIO(audio_bytes)
        if fmt in ("WAV", "FLAC", "OGG"):
            audio_np, sr = sf.read(buf, dtype="float32", always_2d=False)
        else:
            audio_np, sr = librosa.load(buf, sr=None, mono=True)
    except Exception:
        logger.warning("Primary decoder failed for %s – falling back to librosa", content_type)
        buf = io.BytesIO(audio_bytes)
        audio_np, sr = librosa.load(buf, sr=None, mono=True)

    if audio_np.ndim > 1:
        audio_np = np.mean(audio_np, axis=1)

    audio_np = audio_np.astype(np.float32)

    if sr != target_sr:
        audio_np = librosa.resample(audio_np, orig_sr=sr, target_sr=target_sr)
        sr = target_sr

    logger.info("Loaded audio: %.2f s @ %d Hz", len(audio_np) / sr, sr)
    return audio_np, sr


def normalize_audio(audio: np.ndarray) -> np.ndarray:
    """Peak-normalise audio to [-1, 1]."""
    peak = np.max(np.abs(audio))
    if peak < 1e-8:
        return audio
    return audio / peak


def trim_silence(
    audio: np.ndarray,
    sr: int,
    top_db: int = 25,
) -> np.ndarray:
    """Trim leading and trailing silence using librosa."""
    trimmed, _ = librosa.effects.trim(audio, top_db=top_db)
    logger.debug(
        "Trimmed silence: %.2f s -> %.2f s",
        len(audio) / sr,
        len(trimmed) / sr,
    )
    return trimmed


def segment_audio(
    audio: np.ndarray,
    sr: int,
    segment_sec: float = 5.0,
    overlap_sec: float = 0.0,
) -> list[np.ndarray]:
    """Split audio into fixed-length segments with optional overlap."""
    seg_len = int(segment_sec * sr)
    hop = int((segment_sec - overlap_sec) * sr)
    if hop <= 0:
        hop = seg_len

    segments: list[np.ndarray] = []
    start = 0
    while start < len(audio):
        end = start + seg_len
        chunk = audio[start:end]
        if len(chunk) < sr:
            break
        if len(chunk) < seg_len:
            chunk = np.pad(chunk, (0, seg_len - len(chunk)))
        segments.append(chunk)
        start += hop

    if not segments:
        segments.append(audio)

    return segments


def extract_mfcc(
    audio: np.ndarray,
    sr: int,
    n_mfcc: int = 13,
    n_fft: int = 2048,
    hop_length: int = 512,
) -> np.ndarray:
    """Extract MFCC features and return shape (n_mfcc, T)."""
    mfccs = librosa.feature.mfcc(
        y=audio,
        sr=sr,
        n_mfcc=n_mfcc,
        n_fft=n_fft,
        hop_length=hop_length,
    )
    return mfccs


def extract_prosody(
    audio: np.ndarray,
    sr: int,
    hop_length: int = 512,
    frame_length: int = 2048,
    contour_max_points: int = 50,
) -> dict:
    """Extract prosodic features from an audio signal.

    Returns a dict matching the ``ProsodyFeatures`` schema.
    """
    pitch_contour_raw = _estimate_pitch_autocorr(audio, sr, hop_length, frame_length)

    voiced = pitch_contour_raw[pitch_contour_raw > 0]
    pitch_mean = float(np.mean(voiced)) if len(voiced) > 0 else 0.0
    pitch_std = float(np.std(voiced)) if len(voiced) > 0 else 0.0

    rms = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]
    energy_mean = float(np.mean(rms))
    energy_std = float(np.std(rms))

    speech_rate = _estimate_speech_rate(audio, sr)
    pause_ratio = _estimate_pause_ratio(audio, sr)

    pitch_contour = _resample_contour(pitch_contour_raw, contour_max_points)
    energy_contour = _resample_contour(rms, contour_max_points)

    return {
        "pitch_mean": pitch_mean,
        "pitch_std": pitch_std,
        "energy_mean": energy_mean,
        "energy_std": energy_std,
        "speech_rate": speech_rate,
        "pause_ratio": pause_ratio,
        "pitch_contour": pitch_contour,
        "energy_contour": energy_contour,
    }


def _estimate_pitch_autocorr(
    audio: np.ndarray,
    sr: int,
    hop_length: int,
    frame_length: int,
) -> np.ndarray:
    """Simple autocorrelation-based pitch estimation per frame."""
    min_lag = sr // 500  # 500 Hz upper bound
    max_lag = sr // 50   # 50 Hz lower bound
    n_frames = 1 + (len(audio) - frame_length) // hop_length
    pitches = np.zeros(max(n_frames, 0), dtype=np.float32)

    for i in range(n_frames):
        start = i * hop_length
        frame = audio[start : start + frame_length]
        if len(frame) < frame_length:
            break

        frame = frame - np.mean(frame)
        energy = np.sum(frame ** 2)
        if energy < 1e-8:
            continue

        corr = np.correlate(frame, frame, mode="full")
        corr = corr[len(corr) // 2 :]

        safe_max_lag = min(max_lag, len(corr) - 1)
        if min_lag >= safe_max_lag:
            continue

        search_region = corr[min_lag : safe_max_lag + 1]
        if len(search_region) == 0:
            continue

        peak_idx = int(np.argmax(search_region)) + min_lag
        if corr[peak_idx] / (corr[0] + 1e-12) > 0.3:
            pitches[i] = sr / peak_idx

    return pitches


def _estimate_speech_rate(audio: np.ndarray, sr: int) -> float:
    """Estimate syllable-level speech rate (syllables per second).

    Uses spectral flux onset detection as a proxy for syllable nuclei.
    """
    try:
        onsets = librosa.onset.onset_detect(y=audio, sr=sr, units="time")
        duration = len(audio) / sr
        if duration < 0.1:
            return 0.0
        return float(len(onsets) / duration)
    except Exception:
        return 0.0


def _estimate_pause_ratio(audio: np.ndarray, sr: int, threshold_db: float = -40.0) -> float:
    """Ratio of silent frames to total frames."""
    rms = librosa.feature.rms(y=audio)[0]
    if len(rms) == 0:
        return 0.0
    threshold_linear = librosa.db_to_amplitude(threshold_db)
    silent_frames = int(np.sum(rms < threshold_linear))
    return float(silent_frames / len(rms))


def _resample_contour(contour: np.ndarray, n_points: int) -> list[float]:
    """Down/up-sample a 1-D contour to exactly *n_points* values."""
    if len(contour) == 0:
        return [0.0] * n_points
    if len(contour) == n_points:
        return [float(v) for v in contour]
    indices = np.linspace(0, len(contour) - 1, n_points)
    resampled = np.interp(indices, np.arange(len(contour)), contour)
    return [float(v) for v in resampled]
