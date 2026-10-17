package com.ceview.module4.attribution;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mints and resolves the quotable tracking code for a surge window.
 *
 * <p>Phase 1 of the marketing-attribution design. Called from {@code
 * ForecastingService.persistDemandAlert} inside the pipeline's existing transaction, so a code and
 * its alert are committed together or not at all.
 *
 * <p><b>Mint is idempotent per window, not per alert.</b> The pipeline retires and re-creates the
 * alert row on every run; if this minted per alert, an operator's code would change underneath a
 * caption they had already posted. Instead the window tuple is the key: a rerun finds the existing
 * code, updates its pointer to the new alert row, and leaves the code string untouched.
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
   * Returns the code for this window, creating it if this is the first time the window has been
   * seen.
   *
   * @param demandAlertId the alert currently representing the window; stored as a refreshed
   *     pointer, never as a foreign key
   */
  @Transactional
  public AttributionCode mintForWindow(
      UUID businessProfileId,
      String category,
      String targetMarket,
      OffsetDateTime windowOpenDate,
      UUID demandAlertId) {

    Optional<AttributionCode> existing =
        codeRepo.findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
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
    log.info(
        "Attribution code minted code={} market={} category={}",
        saved.getCode(),
        targetMarket,
        category);
    return saved;
  }

  /** Resolves the code to weave into captions generated from a given alert. */
  @Transactional(readOnly = true)
  public Optional<AttributionCode> findForAlert(UUID demandAlertId) {
    if (demandAlertId == null) return Optional.empty();
    return codeRepo.findByDemandAlertId(demandAlertId);
  }

  /**
   * Derives a short, sayable code and disambiguates it if the operator already has one by that
   * name.
   *
   * <p>Collisions are rare — the derivation already includes market, category and date — but two
   * categories sharing a four-letter prefix in the same market on the same day would produce one,
   * and a silent constraint violation inside the forecasting transaction would roll back the whole
   * pipeline run, not just this code.
   */
  String uniqueCodeFor(
      UUID businessProfileId, String market, String category, OffsetDateTime windowStart) {
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
    return token(market, 2) + "-" + token(category, 4) + "-" + DATE_PART.format(windowStart);
  }

  /** Letters and digits only, uppercased, clipped — ad captions are not a place for punctuation. */
  private static String token(String raw, int length) {
    if (raw == null || raw.isBlank()) return "XX";
    String cleaned = raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    if (cleaned.isEmpty()) return "XX";
    return cleaned.substring(0, Math.min(length, cleaned.length()));
  }
}
