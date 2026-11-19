package com.ceview.module1.performance;

import com.ceview.auth.CurrentOperator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ModelPerformanceService {
    private final CurrentOperator currentOperator;
    private final ModelPerformanceRepository repository;
    private final Set<UUID> administrators;

    public ModelPerformanceService(CurrentOperator currentOperator, ModelPerformanceRepository repository,
            @Value("${ceview.model-performance.admin-operator-ids:}") String adminIds) {
        this.currentOperator = currentOperator;
        this.repository = repository;
        this.administrators = Arrays.stream(adminIds.split(",")).map(String::trim)
            .filter(id -> !id.isEmpty()).map(UUID::fromString).collect(Collectors.toUnmodifiableSet());
    }

    public record Metrics(long totalRuns, long analysisRuns, long confirmedAnalysisRuns,
                          long unconfirmedAnalysisRuns, long overriddenRuns, long acceptedRuns,
                          Double confirmationRate, Double overrideRate, Double agreementRate,
                          Double averageTopConfidence, Double averageLatencyMs,
                          Double minLatencyMs, Double maxLatencyMs) {}
    public record Breakdown(String modelVersion, String runPurpose, Metrics metrics) {}
    public record CategoryFrequency(String category, String runPurpose, long totalRuns) {}
    public record Report(String scope, OffsetDateTime generatedAt, OffsetDateTime from, OffsetDateTime to,
                         String modelVersion, Metrics summary, List<Breakdown> breakdown,
                         List<CategoryFrequency> topCategoryDistribution, List<String> measurementNotes) {}

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Report report(OffsetDateTime from, OffsetDateTime to, String modelVersion) {
        if (!administrators.contains(currentOperator.resolve())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Model performance administrator access required");
        }
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var end = to == null ? now : to;
        var start = from == null ? end.minusDays(30) : from;
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be earlier than to");
        }
        if (modelVersion != null && (modelVersion.isBlank() || modelVersion.length() > 255)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "modelVersion must contain 1 to 255 characters");
        }
        var rows = repository.summarize(start, end, modelVersion);
        var breakdown = rows.stream().map(row -> new Breakdown(row.getModelVersion(), row.getRunPurpose(),
            metrics(List.of(row)))).toList();
        var categories = repository.categories(start, end, modelVersion).stream()
            .map(row -> new CategoryFrequency(row.getCategory(), row.getRunPurpose(), row.getTotalRuns())).toList();
        return new Report("ALL_BUSINESSES", now, start, end, modelVersion, metrics(rows), breakdown, categories,
            List.of("Successful recorded classifier runs only; failed or transport-lost attempts are not measured.",
                "Latency includes hosted client setup, network and queue time, not only model computation.",
                "Feedback rates use confirmed ANALYZE runs; agreement is not independently validated model accuracy.",
                "Confidence is the raw highest independent category probability, not a calibrated accuracy estimate.",
                "The window selects inference timestamps [from, to); feedback reflects current confirmations."));
    }

    private static Metrics metrics(List<ModelPerformanceRepository.RunStats> rows) {
        long total = 0, analysis = 0, confirmed = 0, overridden = 0;
        double confidence = 0, latency = 0;
        Double min = null, max = null;
        for (var row : rows) {
            total += row.getTotalRuns();
            if ("ANALYZE".equals(row.getRunPurpose())) analysis += row.getTotalRuns();
            confirmed += row.getConfirmedRuns();
            overridden += row.getOverriddenRuns();
            confidence += row.getConfidenceSum();
            latency += row.getLatencySum();
            min = min == null ? row.getMinLatency() : Math.min(min, row.getMinLatency());
            max = max == null ? row.getMaxLatency() : Math.max(max, row.getMaxLatency());
        }
        return new Metrics(total, analysis, confirmed, analysis - confirmed, overridden, confirmed - overridden,
            ratio(confirmed, analysis), ratio(overridden, confirmed), ratio(confirmed - overridden, confirmed),
            ratio(confidence, total), ratio(latency, total), min, max);
    }

    private static Double ratio(double value, long count) {
        return count == 0 ? null : value / count;
    }
}
