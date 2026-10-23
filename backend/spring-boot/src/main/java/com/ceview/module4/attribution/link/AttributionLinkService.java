package com.ceview.module4.attribution.link;

import com.ceview.module4.attribution.AttributionCode;
import com.ceview.module4.attribution.AttributionWindow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Mints and resolves the trackable link for a surge window — the sibling of
 * {@code AttributionCodeService}, minted in the same transaction off the same
 * alert, keyed on the same window.
 *
 * <p><b>Mint is idempotent per window, and that matters more here than for the
 * code.</b> A slug lives inside a running paid ad. The forecasting pipeline
 * retires and re-creates the alert row on every run; minting per alert would
 * hand the operator a new slug mid-campaign and 404 every click on the ad
 * already in market. A rerun therefore finds the existing link, re-points it at
 * the new alert row, and leaves the slug alone.
 */
@Service
public class AttributionLinkService {

    private static final Logger log = LoggerFactory.getLogger(AttributionLinkService.class);

    /**
     * Slug space is 40 bits, so a collision is not something that happens in
     * practice — this bound exists so a broken generator fails loudly instead of
     * spinning forever inside the forecasting transaction.
     */
    private static final int MAX_SLUG_ATTEMPTS = 10;

    private final AttributionLinkRepository linkRepo;
    private final SlugGenerator slugGenerator;
    private final AdUrlBuilder adUrlBuilder;

    public AttributionLinkService(AttributionLinkRepository linkRepo,
                                  SlugGenerator slugGenerator,
                                  AdUrlBuilder adUrlBuilder) {
        this.linkRepo = linkRepo;
        this.slugGenerator = slugGenerator;
        this.adUrlBuilder = adUrlBuilder;
    }

    /**
     * Returns the link for this window, creating it the first time the window is
     * seen.
     *
     * <p>New links start with a null {@code destinationUrl}, i.e. pointing at
     * CeView's hosted enquiry page. That is the default that works without the
     * operator owning or being able to edit a website; pointing it at their own
     * booking page is an explicit choice they make later.
     */
    @Transactional
    public AttributionLink mintForWindow(UUID businessProfileId,
                                         String category,
                                         String targetMarket,
                                         OffsetDateTime windowOpenDate,
                                         UUID demandAlertId) {

        Optional<AttributionLink> existing = linkRepo
                .findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                        businessProfileId, category, targetMarket, windowOpenDate);

        if (existing.isPresent()) {
            AttributionLink link = existing.get();
            if (!Objects.equals(link.getDemandAlertId(), demandAlertId)) {
                link.setDemandAlertId(demandAlertId);
                linkRepo.save(link);
            }
            return link;
        }

        AttributionLink link = new AttributionLink();
        link.setBusinessProfileId(businessProfileId);
        link.setDemandAlertId(demandAlertId);
        link.setCategory(category);
        link.setTargetMarket(targetMarket);
        link.setSlug(uniqueSlug());
        link.setDestinationUrl(null);
        link.setWindowStart(windowOpenDate);
        link.setWindowEnd(AttributionWindow.endFor(windowOpenDate));

        AttributionLink saved = linkRepo.save(link);
        log.info("Attribution link minted slug={} market={} category={}",
                saved.getSlug(), targetMarket, category);
        return saved;
    }

    /** Resolves the link to weave into captions generated from a given alert. */
    @Transactional(readOnly = true)
    public Optional<AttributionLink> findForAlert(UUID demandAlertId) {
        if (demandAlertId == null) return Optional.empty();
        return linkRepo.findByDemandAlertId(demandAlertId);
    }

    /** The link minted alongside {@code code}: both are keyed on the same window tuple. */
    @Transactional(readOnly = true)
    public Optional<AttributionLink> findForCode(AttributionCode code) {
        return linkRepo.findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                code.getBusinessProfileId(), code.getCategory(), code.getTargetMarket(), code.getWindowStart());
    }

    @Transactional(readOnly = true)
    public Optional<AttributionLink> findForOperator(UUID linkId, UUID businessProfileId) {
        return linkRepo.findByLinkIdAndBusinessProfileId(linkId, businessProfileId);
    }

    /** The three strings an operator copies: bare link, Meta ad URL, TikTok ad URL. */
    public AttributionLinkDtos.LinkUrls urlsFor(AttributionLink link) {
        return new AttributionLinkDtos.LinkUrls(
                adUrlBuilder.linkUrl(link.getSlug()),
                adUrlBuilder.metaAdUrl(link.getSlug()),
                adUrlBuilder.tiktokAdUrl(link.getSlug()));
    }

    private String uniqueSlug() {
        for (int attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
            String candidate = slugGenerator.generate();
            if (!linkRepo.existsBySlug(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException(
                "Could not generate a unique attribution slug in " + MAX_SLUG_ATTEMPTS + " attempts");
    }
}
