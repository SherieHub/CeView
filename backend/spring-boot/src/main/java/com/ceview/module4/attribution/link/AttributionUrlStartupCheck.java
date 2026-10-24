package com.ceview.module4.attribution.link;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Warns at startup when the public URLs behind tracked links still point at this machine.
 *
 * <p>The attribution base URL is copied into live ads and the enquiry base URL is where travellers
 * land, so a forgotten {@code localhost} default on a deployed instance silently breaks every link.
 * It only warns: local Docker runs the same profile as a real deployment, and a hard failure would
 * stop it from starting.
 */
@Component
@Profile("!h2")
public class AttributionUrlStartupCheck implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AttributionUrlStartupCheck.class);

    private final String attributionBaseUrl;
    private final String enquiryBaseUrl;

    public AttributionUrlStartupCheck(
            @Value("${ceview.attribution.base-url:}") String attributionBaseUrl,
            @Value("${ceview.attribution.enquiry-base-url:}") String enquiryBaseUrl) {
        this.attributionBaseUrl = attributionBaseUrl;
        this.enquiryBaseUrl = enquiryBaseUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        problems(attributionBaseUrl, enquiryBaseUrl).forEach(log::warn);
    }

    static List<String> problems(String attributionBaseUrl, String enquiryBaseUrl) {
        List<String> problems = new ArrayList<>();
        if (isLocalOrBlank(attributionBaseUrl)) {
            problems.add("CEVIEW_ATTRIBUTION_BASE_URL is '" + attributionBaseUrl + "': tracked links copied "
                    + "into ads will not work outside this machine. Set it to the API's public https origin "
                    + "before running real ads; it cannot change afterwards without breaking live links.");
        }
        if (isLocalOrBlank(enquiryBaseUrl)) {
            problems.add("FRONTEND_BASE_URL (or CEVIEW_ENQUIRY_BASE_URL) is '" + enquiryBaseUrl + "': hosted "
                    + "tracked links will send travellers to a booking form they cannot reach. Set it to the "
                    + "frontend's public https origin.");
        }
        return problems;
    }

    private static boolean isLocalOrBlank(String url) {
        if (url == null || url.isBlank()) return true;
        String host = url.toLowerCase(Locale.ROOT);
        return host.contains("//localhost") || host.contains("//127.0.0.1") || host.contains("//0.0.0.0")
                || host.contains("//[::1]");
    }
}
