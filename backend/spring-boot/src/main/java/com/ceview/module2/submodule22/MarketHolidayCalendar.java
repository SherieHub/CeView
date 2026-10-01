package com.ceview.module2.submodule22;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-market holiday calendar keyed by (market, isoYear, isoWeek) — replaces the
 * old {@code HOLIDAY_WEEKS} constant, a bare {@code Map<String, Set<Integer>>} of
 * ISO week numbers with no year, which silently assumed a holiday lands on the
 * same ISO week every year (Step 7, contract §3.4; C-02, H-31).
 *
 * <p>Fixed-date national holidays (Japan's New Year / Golden Week / Obon; the
 * US's Independence Day / Thanksgiving / Christmas) are computed from a real
 * calendar rule via {@code java.time} — correct for any requested year, not a
 * bounded lookup table that needs yearly maintenance.
 *
 * <p>Korea's Seollal and Chuseok are lunisolar and cannot be derived from a
 * fixed rule; their dates are loaded once from the versioned classpath
 * resource {@code module2/market-holiday-calendar.json} — see that file's
 * header for the accuracy caveat (training-data knowledge, not live-verified).
 */
@Component
public class MarketHolidayCalendar {

    private static final Logger log = LoggerFactory.getLogger(MarketHolidayCalendar.class);
    private static final WeekFields ISO_WEEK = WeekFields.ISO;
    private static final String RESOURCE_PATH = "module2/market-holiday-calendar.json";

    private final List<LocalDate> koreaLunarDates;
    private final Map<String, Set<Integer>> cache = new ConcurrentHashMap<>();

    public MarketHolidayCalendar(ObjectMapper objectMapper) {
        this.koreaLunarDates = loadKoreaLunarDates(objectMapper);
    }

    private static List<LocalDate> loadKoreaLunarDates(ObjectMapper objectMapper) {
        try (InputStream in = MarketHolidayCalendar.class.getClassLoader().getResourceAsStream(RESOURCE_PATH)) {
            if (in == null) {
                log.warn("{} not found on classpath — Korean lunar holidays (Seollal/Chuseok) will never be flagged",
                        RESOURCE_PATH);
                return List.of();
            }
            LunarHolidayFile file = objectMapper.readValue(in, LunarHolidayFile.class);
            List<LocalDate> dates = new ArrayList<>();
            if (file.koreaLunarHolidays() != null) {
                for (LunarEntry e : file.koreaLunarHolidays()) {
                    dates.add(LocalDate.parse(e.date()));
                }
            }
            return List.copyOf(dates);
        } catch (Exception e) {
            log.warn("Failed to load {} — Korean lunar holidays will never be flagged: {}",
                    RESOURCE_PATH, e.getMessage());
            return List.of();
        }
    }

    /** True when (isoYear, isoWeek) contains a known holiday period for this market. */
    public boolean isHoliday(String market, int isoYear, int isoWeek) {
        return holidayWeeksFor(market, isoYear).contains(isoWeek);
    }

    private Set<Integer> holidayWeeksFor(String market, int isoYear) {
        return cache.computeIfAbsent(market + "|" + isoYear, k -> computeHolidayWeeks(market, isoYear));
    }

    /**
     * A fixed-date holiday near a Gregorian year boundary can land in the ISO
     * week-based year before or after its own calendar year (e.g. Dec 31 can be
     * ISO week 1 of next year; Jan 1-3 can be the last ISO week of the previous
     * year) — so this scans calYear-1..calYear+1 and filters by the ACTUAL
     * week-based year of each candidate date, rather than assuming calYear ==
     * isoYear.
     */
    private Set<Integer> computeHolidayWeeks(String market, int isoYear) {
        Set<LocalDate> dates = new HashSet<>();
        for (int calYear = isoYear - 1; calYear <= isoYear + 1; calYear++) {
            dates.addAll(fixedDateHolidays(market, calYear));
        }
        if ("korea".equals(market)) {
            for (LocalDate lunar : koreaLunarDates) {
                // A 3-day public-holiday window around the lunar date itself.
                dates.add(lunar.minusDays(1));
                dates.add(lunar);
                dates.add(lunar.plusDays(1));
            }
        }

        Set<Integer> weeks = new HashSet<>();
        for (LocalDate d : dates) {
            if (d.get(ISO_WEEK.weekBasedYear()) == isoYear) {
                weeks.add(d.get(ISO_WEEK.weekOfWeekBasedYear()));
            }
        }
        return weeks;
    }

    private static List<LocalDate> fixedDateHolidays(String market, int calYear) {
        List<LocalDate> dates = new ArrayList<>();
        switch (market) {
            case "japan" -> {
                dates.add(LocalDate.of(calYear, 1, 1));   // Shogatsu (New Year)
                dates.add(LocalDate.of(calYear, 1, 2));
                dates.add(LocalDate.of(calYear, 1, 3));
                for (int d = 29; d <= 30; d++) dates.add(LocalDate.of(calYear, 4, d));   // Golden Week start
                for (int d = 1; d <= 5; d++) dates.add(LocalDate.of(calYear, 5, d));     // Golden Week
                for (int d = 13; d <= 16; d++) dates.add(LocalDate.of(calYear, 8, d));   // Obon
            }
            case "usa" -> {
                LocalDate thanksgiving = LocalDate.of(calYear, 11, 1)
                        .with(TemporalAdjusters.dayOfWeekInMonth(4, DayOfWeek.THURSDAY));
                dates.add(thanksgiving);
                dates.add(thanksgiving.plusDays(1));           // the following Friday
                dates.add(LocalDate.of(calYear, 7, 3));
                dates.add(LocalDate.of(calYear, 7, 4));        // Independence Day
                dates.add(LocalDate.of(calYear, 7, 5));
                dates.add(LocalDate.of(calYear, 12, 24));
                dates.add(LocalDate.of(calYear, 12, 25));      // Christmas
                dates.add(LocalDate.of(calYear, 12, 26));
            }
            default -> { /* korea's fixed-date holidays are out of this step's "at minimum" scope */ }
        }
        return dates;
    }

    private record LunarHolidayFile(String version, String note, List<LunarEntry> koreaLunarHolidays) {}
    private record LunarEntry(String name, String date) {}
}
