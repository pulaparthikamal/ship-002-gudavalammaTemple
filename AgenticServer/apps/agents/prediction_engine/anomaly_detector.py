from __future__ import annotations

from dataclasses import dataclass
from statistics import mean, pstdev
from typing import Any


MetricPoint = dict[str, Any]


@dataclass(frozen=True)
class MetricSpec:
    field: str
    label: str
    component: str
    threshold: float
    unit: str
    aliases: tuple[str, ...] = ()


METRIC_SPECS = [
    MetricSpec("cpuUsagePercent", "CPU spike", "CPU", 85, "%"),
    MetricSpec("memoryUsagePercent", "Memory pressure", "Memory", 88, "%"),
    MetricSpec("diskUsagePercent", "Disk pressure", "Disk", 85, "%"),
    MetricSpec("swapUsagePercent", "Swap pressure", "Memory", 25, "%"),
    MetricSpec("loadAverage", "Load spike", "CPU", 2.0, ""),
    MetricSpec("diskReadIo", "Disk read I/O spike", "Disk I/O", 50_000_000, "B/s", ("diskReadBytesPerSecond",)),
    MetricSpec("diskWriteIo", "Disk write I/O spike", "Disk I/O", 50_000_000, "B/s", ("diskWriteBytesPerSecond",)),
    MetricSpec("networkDownloadSpeed", "Network download spike", "Network", 5_000_000, "B/s", ("networkRxBytesPerSecond",)),
    MetricSpec("networkUploadSpeed", "Network upload spike", "Network", 5_000_000, "B/s", ("networkTxBytesPerSecond",)),
    MetricSpec("filesystemGrowthBytesPerMinute", "High disk growth", "Filesystem", 50_000_000, "B/min"),
]


def _number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _severity(value: float, threshold: float, z_score: float = 0.0) -> str:
    if value >= threshold * 1.25 or z_score >= 4:
        return "critical"
    if value >= threshold or z_score >= 3:
        return "high"
    if z_score >= 2:
        return "medium"
    return "warning"


class AnomalyDetector:
    """Hybrid threshold, statistical, trend, and optional Isolation Forest detector."""

    def __init__(self, metrics: list[MetricPoint]) -> None:
        self.metrics = list(metrics or [])

    def detect(self) -> list[dict[str, Any]]:
        anomalies: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        for spec in METRIC_SPECS:
            values = [self._metric_value(item, spec) for item in self.metrics]
            if not values:
                continue

            latest = values[-1]
            baseline = mean(values[:-1] or values)
            stddev = pstdev(values[:-1] or values) if len(values) > 2 else 0.0
            z_score = (latest - baseline) / stddev if stddev > 0 else 0.0

            threshold_hit = latest >= spec.threshold
            statistical_hit = len(values) >= 6 and z_score >= 2.5
            if threshold_hit or statistical_hit:
                key = (spec.field, "threshold_statistical")
                seen.add(key)
                anomalies.append(
                    self._build_anomaly(
                        spec,
                        "threshold_statistical",
                        latest,
                        baseline,
                        _severity(latest, spec.threshold, z_score),
                        [
                            f"latest={round(latest, 2)}{spec.unit}",
                            f"baseline={round(baseline, 2)}{spec.unit}",
                            f"zScore={round(z_score, 2)}",
                            f"threshold={round(spec.threshold, 2)}{spec.unit}",
                        ],
                        z_score=z_score,
                    )
                )

            slope = self._slope(values[-8:])
            if len(values) >= 5 and slope > max(spec.threshold * 0.03, 1):
                key = (spec.field, "trend")
                seen.add(key)
                anomalies.append(
                    self._build_anomaly(
                        spec,
                        "trend",
                        latest,
                        baseline,
                        "high" if latest >= spec.threshold * 0.8 else "medium",
                        [
                            f"positiveSlope={round(slope, 3)} per sample",
                            f"latest={round(latest, 2)}{spec.unit}",
                            "time-series trend detector found sustained growth",
                        ],
                        slope=slope,
                    )
                )

        for anomaly in self._isolation_forest_anomalies(seen):
            anomalies.append(anomaly)

        return anomalies

    def _metric_value(self, item: MetricPoint, spec: MetricSpec) -> float:
        for field in (spec.field, *spec.aliases):
            if item.get(field) is not None:
                return _number(item.get(field))
        return 0.0

    def _build_anomaly(
        self,
        spec: MetricSpec,
        detector: str,
        value: float,
        baseline: float,
        severity: str,
        evidence: list[str],
        **metadata: Any,
    ) -> dict[str, Any]:
        return {
            "type": spec.field,
            "title": spec.label,
            "component": spec.component,
            "severity": severity,
            "value": round(value, 4),
            "baseline": round(baseline, 4),
            "threshold": spec.threshold,
            "confidence": self._confidence(value, spec.threshold, metadata.get("z_score", 0.0)),
            "detector": detector,
            "evidence": evidence,
            "metadata": metadata,
        }

    def _confidence(self, value: float, threshold: float, z_score: float) -> float:
        threshold_confidence = min(1.0, value / threshold) if threshold > 0 else 0.5
        z_confidence = min(1.0, max(0.0, z_score) / 4)
        return round(max(0.55, min(0.98, 0.45 + threshold_confidence * 0.35 + z_confidence * 0.2)), 2)

    def _slope(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        x_mean = (len(values) - 1) / 2
        y_mean = mean(values)
        numerator = sum((idx - x_mean) * (value - y_mean) for idx, value in enumerate(values))
        denominator = sum((idx - x_mean) ** 2 for idx in range(len(values)))
        return numerator / denominator if denominator else 0.0

    def _isolation_forest_anomalies(self, seen: set[tuple[str, str]]) -> list[dict[str, Any]]:
        if len(self.metrics) < 12:
            return []
        try:
            from sklearn.ensemble import IsolationForest  # type: ignore
        except Exception:
            return []

        matrix = [[self._metric_value(point, spec) for spec in METRIC_SPECS] for point in self.metrics]
        model = IsolationForest(contamination=0.12, random_state=42)
        labels = model.fit_predict(matrix)
        if labels[-1] != -1:
            return []

        latest = matrix[-1]
        baselines = [mean(row[idx] for row in matrix[:-1]) for idx in range(len(fields))]
        deltas = [abs(latest[idx] - baselines[idx]) for idx in range(len(fields))]
        top_index = max(range(len(fields)), key=lambda idx: deltas[idx])
        spec = METRIC_SPECS[top_index]
        if (spec.field, "threshold_statistical") in seen:
            return []

        return [
            self._build_anomaly(
                spec,
                "isolation_forest",
                latest[top_index],
                baselines[top_index],
                "medium",
                [
                    "Isolation Forest marked the latest metric vector as anomalous",
                    f"largestDeviation={round(deltas[top_index], 2)}{spec.unit}",
                ],
            )
        ]
