package com.ceview.module4.attribution.link;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Conservative click filter for the public redirect path. Platform preview
 * crawlers and headless clients should still reach the destination, but they
 * must not inflate operator-facing click counts.
 */
@Component
public class BotFilter {

    /**
     * A crawler preview and a double-tap from the same traveller look identical
     * here. Count once, then suppress repeats for a short window.
     */
    static final Duration SAME_LINK_IP_DEBOUNCE = Duration.ofSeconds(60);

    private static final Pattern HEADLESS_SIGNATURES = Pattern.compile(
            "headless|phantomjs|selenium|webdriver|puppeteer|playwright|curl|wget|python-requests",
            Pattern.CASE_INSENSITIVE);

    private static final String[] USER_AGENT_DENYLIST = {
            "facebookexternalhit",
            "facebot",
            "tiktokbot",
            "bytespider",
            "bingbot",
            "googlebot"
    };

    private final AttributionClickRepository clickRepository;

    public BotFilter(AttributionClickRepository clickRepository) {
        this.clickRepository = clickRepository;
    }

    /**
     * The click a repeat from the same address should reuse, if one was recorded inside the debounce
     * window. The repeat records nothing new, but still carries the earlier click's id so the
     * traveller's enquiry form keeps working.
     */
    public Optional<AttributionClick> recentDuplicate(AttributionLink link, String ipHash, OffsetDateTime now) {
        if (ipHash == null || ipHash.isBlank()) return Optional.empty();
        return clickRepository.findFirstByLinkIdAndIpHashAndClickedAtGreaterThanEqualOrderByClickedAtDesc(
                link.getLinkId(), ipHash, now.minus(SAME_LINK_IP_DEBOUNCE));
    }

    boolean isDeniedUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return false;
        String normalized = userAgent.toLowerCase(Locale.ROOT);
        for (String denied : USER_AGENT_DENYLIST) {
            if (normalized.contains(denied)) return true;
        }
        return HEADLESS_SIGNATURES.matcher(userAgent).find();
    }
}
