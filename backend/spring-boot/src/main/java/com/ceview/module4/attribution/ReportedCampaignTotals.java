package com.ceview.module4.attribution;

import com.ceview.module4.engagement.CampaignRecord;
import com.ceview.module4.engagement.CampaignRecordRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The operator's own weekly figures (tbl_campaign_records) over a date range —
 * the self-reported side that attribution evidence is compared against.
 *
 * <p>Shared by the lift computation and the "more tracked than reported"
 * warning so both read periods the same way. A record belongs to the range its
 * {@code periodStart} falls in; records whose period cannot be parsed (legacy
 * rows with no dates) are skipped rather than guessed at.
 */
@Component
public class ReportedCampaignTotals {

    private final CampaignRecordRepository records;

    public ReportedCampaignTotals(CampaignRecordRepository records) {
        this.records = records;
    }

    /** Sums over a set of periods. {@code days} is the calendar days those periods cover. */
    public record Totals(int periods, long days, long bookings, double revenue) {
        public static final Totals EMPTY = new Totals(0, 0, 0, 0);

        public boolean isEmpty() {
            return periods == 0;
        }

        Totals plus(long periodDays, long periodBookings, double periodRevenue) {
            return new Totals(periods + 1, days + periodDays, bookings + periodBookings, revenue + periodRevenue);
        }
    }

    /** Records whose period starts in {@code [from, to)}. */
    public Totals between(UUID profileId, LocalDate from, LocalDate to) {
        return between(all(profileId), from, to);
    }

    /** Same, over records the caller already loaded — avoids re-reading for several ranges. */
    public Totals between(List<CampaignRecord> rows, LocalDate from, LocalDate to) {
        Totals totals = Totals.EMPTY;
        for (CampaignRecord row : rows) {
            Optional<LocalDate> start = parse(row.getPeriodStart());
            if (start.isEmpty() || start.get().isBefore(from) || !start.get().isBefore(to)) continue;
            // A record with no end date is treated as the weekly period IngestionForm submits.
            LocalDate end = parse(row.getPeriodEnd()).orElse(start.get().plusDays(6));
            long days = Math.max(1, ChronoUnit.DAYS.between(start.get(), end) + 1);
            totals = totals.plus(days, row.getBookings(), row.getRevenue());
        }
        return totals;
    }

    public List<CampaignRecord> all(UUID profileId) {
        return records.findByBusinessProfileIdOrderByCreatedAtDesc(profileId, Pageable.unpaged());
    }

    private static Optional<LocalDate> parse(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try {
            return Optional.of(LocalDate.parse(value.trim()));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }
}
