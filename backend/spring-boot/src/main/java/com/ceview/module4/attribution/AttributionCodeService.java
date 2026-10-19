package com.ceview.module4.attribution;

import com.ceview.module2.MarketFlags;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * Mints and resolves the quotable tracking code for a surge window.
 *
 * <p>Phase 1 of the marketing-attribution design. Called from
 * {@code ForecastingService.persistDemandAlert} inside the pipeline's existing
 * transaction, so a code and its alert are committed together or not at all.
 *
 * <p><b>Mint is idempotent per window, not per alert.</b> The pipeline retires
 * and re-creates the alert row on every run; if this minted per alert, an
 * operator's code would change underneath a caption they had already posted.
 * Instead the window tuple is the key: a rerun finds the existing code, updates
 * its pointer to the new alert row, and leaves the code string untouched.
 */
@Service
public class AttributionCodeService {

    private static final Logger log = LoggerFactory.getLogger(AttributionCodeService.class);

    private static final DateTimeFormatter DATE_PART = DateTimeFormatter.ofPattern("MMdd");
    private static final int MAX_COLLISION_ATTEMPTS = 50;

    private final AttributionCodeRepository codeRepo;

    public AttributionCodeService(AttributionCodeRepository codeRepo) {
        this.codeRepo = codeRepo;
    }

    /**
     * Returns the code for this window, creating it if this is the first time
     * the window has been seen.
     *
     * @param demandAlertId the alert currently representing the window; stored
     *                      as a refreshed pointer, never as a foreign key
     */
    @Transactional
    public AttributionCode mintForWindow(UUID businessProfileId,
                                         String category,
                                         String targetMarket,
                                         OffsetDateTime windowOpenDate,
                                         UUID demandAlertId) {

        Optional<AttributionCode> existing = codeRepo
                .findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                        businessProfileId, category, targetMarket, windowOpenDate);

        if (existing.isPresent()) {
            // Re-point at the alert this run produced. The code string itself is
            // never regenerated: it may already be printed on a caption the
            // operator posted days ago.
            AttributionCode code = existing.get();
            if (!java.util.Objects.equals(code.getDemandAlertId(), demandAlertId)) {
                code.setDemandAlertId(demandAlertId);
                codeRepo.save(code);
            }
            return code;
        }

        AttributionCode code = new AttributionCode();
        code.setBusinessProfileId(businessProfileId);
        code.setDemandAlertId(demandAlertId);
        code.setCategory(category);
        code.setTargetMarket(targetMarket);
        code.setCode(uniqueCodeFor(businessProfileId, targetMarket, category, windowOpenDate));
        code.setWindowStart(windowOpenDate);
        code.setWindowEnd(AttributionWindow.endFor(windowOpenDate));

        AttributionCode saved = codeRepo.save(code);
        log.info("Attribution code minted code={} market={} category={}",
                saved.getCode(), targetMarket, category);
        return saved;
    }

    /** Resolves the code to weave into captions generated from a given alert. */
    @Transactional(readOnly = true)
    public Optional<AttributionCode> findForAlert(UUID demandAlertId) {
        if (demandAlertId == null) return Optional.empty();
        return codeRepo.findByDemandAlertId(demandAlertId);
    }

    /**
     * Resolves the code that captions generated for {@code market} should carry.
     *
     * <p>An explicit alert id wins when its code is for the same market. Otherwise the operator's live-or-upcoming
     * window for that market is used — Content Studio is reached from the
     * market picker, not only from an alert notification, and a Korea caption
     * written while a Korea surge window is open is that campaign's content
     * either way. Upcoming windows count because alerts fire ahead of the
     * surge: the caption is posted before the window opens. A category match
     * breaks ties, then the soonest window.
     *
     * @return empty when the operator has no current window for the market,
     *         in which case captions are generated untagged, as before
     */
    @Transactional(readOnly = true)
    public Optional<AttributionCode> findForContent(UUID businessProfileId, String market,
                                                    String category, UUID demandAlertId) {
        if (demandAlertId != null) {
            // Content Studio lets the operator pick a different market than the
            // alert's own, so the alert's code only applies when its market matches.
            Optional<AttributionCode> byAlert = codeRepo.findByDemandAlertId(demandAlertId)
                    .filter(c -> c.getBusinessProfileId().equals(businessProfileId))
                    .filter(c -> market != null && market.equalsIgnoreCase(c.getTargetMarket()));
            if (byAlert.isPresent()) return byAlert;
        }
        if (businessProfileId == null || market == null || market.isBlank()) return Optional.empty();

        OffsetDateTime now = OffsetDateTime.now();
        return codeRepo.findByBusinessProfileIdOrderByWindowStartDesc(businessProfileId).stream()
                .filter(c -> market.equalsIgnoreCase(c.getTargetMarket()))
                .filter(c -> !c.getWindowEnd().isBefore(now))
                .min(java.util.Comparator
                        .comparing((AttributionCode c) -> !c.getCategory().equalsIgnoreCase(
                                category == null ? "" : category))
                        .thenComparing(AttributionCode::getWindowStart));
    }

    /**
     * Derives a short, sayable code and disambiguates it if the operator already
     * has one by that name.
     *
     * <p>Collisions are rare — the derivation already includes market, category
     * and date — but two categories sharing a four-letter prefix in the same
     * market on the same day would produce one, and a silent constraint
     * violation inside the forecasting transaction would roll back the whole
     * pipeline run, not just this code.
     */
    String uniqueCodeFor(UUID businessProfileId, String market, String category, OffsetDateTime windowStart) {
        String base = deriveCode(market, category, windowStart);
        if (codeRepo.findByBusinessProfileIdAndCode(businessProfileId, base).isEmpty()) {
            return base;
        }
        for (int suffix = 2; suffix <= MAX_COLLISION_ATTEMPTS; suffix++) {
            String candidate = base + "-" + suffix;
            if (codeRepo.findByBusinessProfileIdAndCode(businessProfileId, candidate).isEmpty()) {
                return candidate;
            }
        }
        // Practically unreachable; better than throwing inside the pipeline.
        return base + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase(Locale.ROOT);
    }

    /** e.g. {@code KR-DIVE-1019}. */
    static String deriveCode(String market, String category, OffsetDateTime windowStart) {
        return marketPrefix(market) + "-" + token(category, 4) + "-" + DATE_PART.format(windowStart);
    }

    /**
     * The country code a traveller recognises. The pipeline's market ids are
     * "korea" / "japan" / "usa", which clipped to two letters gave {@code KO} and
     * {@code JA}; {@link MarketFlags} maps them to ISO-3166 {@code KR} / {@code JP} /
     * {@code US}. An unmapped market falls back to its first two letters.
     */
    private static String marketPrefix(String market) {
        String iso = market == null ? "" : MarketFlags.isoFor(market.trim().toLowerCase(Locale.ROOT));
        return iso.isEmpty() ? token(market, 2) : iso;
    }

    /** Letters and digits only, uppercased, clipped — ad captions are not a place for punctuation. */
    private static String token(String raw, int length) {
        if (raw == null || raw.isBlank()) return "XX";
        String cleaned = raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (cleaned.isEmpty()) return "XX";
        return cleaned.substring(0, Math.min(length, cleaned.length()));
    }
}
