from __future__ import annotations

from datetime import datetime
from statistics import mean
from typing import Any

from .anomaly_detector import AnomalyDetector


def _number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


class FailurePredictor:
    """Prediction-only engine. It never emits remediation or execution commands."""

    def __init__(self, metrics: list[dict[str, Any]], context: dict[str, Any] | None = None) -> None:
        self.metrics = self._chronological(metrics or [])
        self.context = context or {}
        self.anomalies = AnomalyDetector(self.metrics).detect()

    def run(self) -> dict[str, Any]:
        predictions = self._build_predictions()
        if not predictions:
            predictions.append(self._healthy_prediction())

        return {
            "predictions": predictions,
            "anomalies": self.anomalies,
            "summary": self._summary(),
            "trendAnalysis": self._trend_analysis(),
            "aiGeneratedResponse": False,
        }

    def _build_predictions(self) -> list[dict[str, Any]]:
        predictions: list[dict[str, Any]] = []
        latest = self.metrics[-1] if self.metrics else {}

        cpu = self._series("cpuUsagePercent")
        memory = self._series("memoryUsagePercent")
        disk = self._series("diskUsagePercent")
        swap = self._series("swapUsagePercent")
        load = self._series("loadAverage")
        disk_growth = self._series("filesystemGrowthBytesPerMinute")
        if not disk_growth:
            disk_growth = self._derived_disk_growth()
        network_rx = self._series("networkRxBytesPerSecond") or self._series("networkDownloadSpeed")
        network_tx = self._series("networkTxBytesPerSecond") or self._series("networkUploadSpeed")
        disk_read = self._series("diskReadBytesPerSecond") or self._series("diskReadIo")
        disk_write = self._series("diskWriteBytesPerSecond") or self._series("diskWriteIo")

        if max(cpu or [0]) >= 92 or (self._avg(cpu) >= 82 and self._avg(load) >= 1.5):
            predictions.append(
                self._prediction(
                    "CPU spikes",
                    "Server crash probability",
                    "CPU saturation can starve application threads and trigger watchdog or orchestration restarts.",
                    "high" if max(cpu or [0]) < 95 else "critical",
                    min(0.96, max(cpu or [0]) / 100),
                    45,
                    ["CPU", "Processes"],
                    self._evidence("metric", "CPU pressure", f"peak CPU={round(max(cpu or [0]), 2)}%, average load={round(self._avg(load), 2)}", "high"),
                )
            )

        memory_slope = self._slope(memory[-8:])
        if max(memory or [0]) >= 90 or (self._avg(memory) >= 82 and memory_slope > 0.8) or self._avg(swap) >= 20:
            predictions.append(
                self._prediction(
                    "Memory leak or pressure",
                    "Memory exhaustion",
                    "Memory usage is high or rising while swap activity indicates pressure on physical RAM.",
                    "critical" if max(memory or [0]) >= 96 else "high",
                    min(0.95, 0.55 + max(memory or [0]) / 200 + max(0, memory_slope) / 20),
                    60,
                    ["Memory", "Swap"],
                    self._evidence("trend", "Memory trajectory", f"peak memory={round(max(memory or [0]), 2)}%, slope={round(memory_slope, 3)}, avg swap={round(self._avg(swap), 2)}%", "high"),
                )
            )

        disk_slope = self._slope(disk[-8:])
        disk_full_minutes = self._minutes_to_disk_full(disk, disk_growth)
        if max(disk or [0]) >= 88 or disk_slope > 0.5 or disk_full_minutes is not None:
            severity = "critical" if max(disk or [0]) >= 96 or (disk_full_minutes is not None and disk_full_minutes <= 180) else "high"
            horizon = int(min(disk_full_minutes or 720, 720))
            predictions.append(
                self._prediction(
                    "Disk exhaustion risk",
                    "Disk full event",
                    "Disk usage or filesystem growth indicates writes may fail if the current rate continues.",
                    severity,
                    min(0.97, 0.5 + max(disk or [0]) / 200 + max(0, disk_slope) / 10),
                    horizon,
                    ["Disk", "Filesystem"],
                    self._evidence("trend", "Disk growth", f"current disk={round(max(disk or [0]), 2)}%, slope={round(disk_slope, 3)}% per sample, estimatedFullMinutes={disk_full_minutes}", severity),
                )
            )

        io_peak = max(max(disk_read or [0]), max(disk_write or [0]))
        if io_peak >= 50_000_000 or self._avg(disk_read + disk_write) >= 30_000_000:
            predictions.append(
                self._prediction(
                    "IO bottlenecks",
                    "Service degradation",
                    "Disk I/O throughput is elevated and may delay reads, writes, logs, and database flushes.",
                    "medium" if io_peak < 100_000_000 else "high",
                    min(0.9, 0.55 + io_peak / 200_000_000),
                    90,
                    ["Disk I/O", "Services"],
                    self._evidence("metric", "Disk I/O", f"peak disk I/O={round(io_peak, 2)} B/s", "medium"),
                )
            )

        failed_services = latest.get("serviceSummary", {}).get("failed", 0) if isinstance(latest.get("serviceSummary"), dict) else 0
        if _number(failed_services) > 0:
            predictions.append(
                self._prediction(
                    "Service degradation",
                    "Service failure probability",
                    "One or more services are already in a failed state.",
                    "critical",
                    0.9,
                    30,
                    ["Services"],
                    self._evidence("event", "Failed services", f"failed services={int(_number(failed_services))}", "critical"),
                )
            )

        process_summary = latest.get("processSummary") if isinstance(latest.get("processSummary"), dict) else {}
        top_processes = latest.get("topProcesses") or process_summary.get("topCpu") or []
        abusive = [
            p for p in top_processes
            if _number(p.get("cpu") or p.get("cpuPercent")) >= 80 or _number(p.get("mem") or p.get("memoryPercent")) >= 25
        ]
        if abusive:
            names = [str(p.get("name", "unknown")) for p in abusive[:3]]
            predictions.append(
                self._prediction(
                    "Process abuse",
                    "Resource exhaustion",
                    "A small set of processes is consuming disproportionate CPU or memory.",
                    "high",
                    0.82,
                    45,
                    ["Processes", "CPU", "Memory"],
                    self._evidence("anomaly", "Top process pressure", f"high consumers={', '.join(names)}", "high"),
                )
            )

        network_peak = max(max(network_rx or [0]), max(network_tx or [0]))
        if network_peak >= 5_000_000:
            predictions.append(
                self._prediction(
                    "Network spikes",
                    "Service degradation",
                    "Network throughput spike may indicate traffic surge, backup activity, or abusive connections.",
                    "medium" if network_peak < 20_000_000 else "high",
                    min(0.88, 0.55 + network_peak / 50_000_000),
                    60,
                    ["Network"],
                    self._evidence("metric", "Network throughput", f"peak network={round(network_peak, 2)} B/s", "medium"),
                )
            )

        for anomaly in self.anomalies:
            if anomaly["severity"] in {"high", "critical"} and not any(anomaly["component"] in item["affectedComponents"] for item in predictions):
                predictions.append(
                    self._prediction(
                        anomaly["title"],
                        "Resource exhaustion",
                        f"{anomaly['detector']} detected abnormal {anomaly['component']} behavior.",
                        anomaly["severity"],
                        anomaly["confidence"],
                        120,
                        [anomaly["component"]],
                        self._evidence("anomaly", anomaly["title"], "; ".join(anomaly["evidence"]), anomaly["severity"], anomaly),
                    )
                )

        return predictions

    def _prediction(
        self,
        issue: str,
        predicted_failure: str,
        root_cause: str,
        severity: str,
        confidence: float,
        horizon_minutes: int,
        components: list[str],
        evidence: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "issue": issue,
            "predictedFailure": predicted_failure,
            "recommendation": "Prediction only: review evidence and continue monitoring before choosing any remediation.",
            "rootCauseAnalysis": root_cause,
            "severity": severity,
            "confidence": round(max(0.0, min(1.0, confidence)), 2),
            "horizonMinutes": max(0, horizon_minutes),
            "timeframe": self._timeframe(horizon_minutes),
            "evidence": [evidence],
            "recommendedActions": ["Review prediction evidence", "Monitor related metrics"],
            "affectedComponents": components,
            "impactedServices": [],
            "impactedDirectories": [],
        }

    def _healthy_prediction(self) -> dict[str, Any]:
        return self._prediction(
            "No significant failure risk detected",
            "None",
            "Hybrid detectors did not find threshold, statistical, or trend signals above risk levels.",
            "low",
            0.84,
            0,
            [],
            self._evidence("event", "Detector result", "No current anomaly exceeded risk thresholds", "low"),
        )

    def _evidence(self, source: str, title: str, detail: str, severity: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        return {"source": source, "title": title, "detail": detail, "severity": severity, "metadata": metadata or {}}

    def _series(self, field: str) -> list[float]:
        return [_number(point.get(field)) for point in self.metrics if point.get(field) is not None]

    def _chronological(self, metrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(metrics) < 2:
            return list(metrics)

        def timestamp(point: dict[str, Any]) -> float:
            value = point.get("collectedAt") or point.get("created")
            if isinstance(value, datetime):
                return value.timestamp()
            if isinstance(value, str):
                try:
                    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
                except ValueError:
                    return 0.0
            return 0.0

        if any(timestamp(point) for point in metrics):
            return sorted(metrics, key=timestamp)
        return list(metrics)

    def _avg(self, values: list[float]) -> float:
        return mean(values) if values else 0.0

    def _slope(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        x_mean = (len(values) - 1) / 2
        y_mean = mean(values)
        numerator = sum((idx - x_mean) * (value - y_mean) for idx, value in enumerate(values))
        denominator = sum((idx - x_mean) ** 2 for idx in range(len(values)))
        return numerator / denominator if denominator else 0.0

    def _derived_disk_growth(self) -> list[float]:
        values = self._series("diskUsagePercent")
        return [max(0.0, values[idx] - values[idx - 1]) for idx in range(1, len(values))]

    def _minutes_to_disk_full(self, disk: list[float], disk_growth: list[float]) -> int | None:
        latest = disk[-1] if disk else 0.0
        growth = self._avg([value for value in disk_growth[-5:] if value > 0])
        if latest < 70 or growth <= 0:
            return None
        return int(max(0, (100 - latest) / growth))

    def _timeframe(self, minutes: int) -> str:
        if minutes <= 0:
            return "N/A"
        if minutes < 60:
            return f"{minutes} minutes"
        return f"{round(minutes / 60, 1)} hours"

    def _summary(self) -> dict[str, Any]:
        latest = self.metrics[-1] if self.metrics else {}
        return {
            "sampleCount": len(self.metrics),
            "latestCpuUsagePercent": _number(latest.get("cpuUsagePercent")),
            "latestMemoryUsagePercent": _number(latest.get("memoryUsagePercent")),
            "latestDiskUsagePercent": _number(latest.get("diskUsagePercent")),
            "anomalyCount": len(self.anomalies),
        }

    def _trend_analysis(self) -> dict[str, Any]:
        return {
            "cpuSlope": round(self._slope(self._series("cpuUsagePercent")[-8:]), 4),
            "memorySlope": round(self._slope(self._series("memoryUsagePercent")[-8:]), 4),
            "diskSlope": round(self._slope(self._series("diskUsagePercent")[-8:]), 4),
        }
