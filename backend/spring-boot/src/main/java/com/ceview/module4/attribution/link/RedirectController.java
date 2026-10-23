package com.ceview.module4.attribution.link;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
public class RedirectController {

    private final ClickTrackingService clickTrackingService;
    private final AttributionRateLimiter rateLimiter;

    public RedirectController(ClickTrackingService clickTrackingService, AttributionRateLimiter rateLimiter) {
        this.clickTrackingService = clickTrackingService;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/r/{slug}")
    public ResponseEntity<Void> redirect(@PathVariable String slug,
                                         @RequestParam MultiValueMap<String, String> params,
                                         @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
                                         @RequestHeader(value = HttpHeaders.REFERER, required = false) String referrer,
                                         HttpServletRequest request) {
        // Same address the enquiry rate limiter uses. Behind a proxy, forward-headers-strategy decides what it
        // is: `framework` takes the left-most X-Forwarded-For entry (works behind Render, but a client can
        // spoof it); `native` only trusts proxies in Tomcat's internal range (AWS).
        String ip = request.getRemoteAddr();
        // Over the limit the traveller is still sent on their way; they are just not recorded as a click.
        Optional<ClickTrackingService.RedirectDecision> redirect = rateLimiter.tryAcquire(ip)
                ? clickTrackingService.capture(slug,
                        new ClickTrackingService.ClickRequest(firstValues(params), userAgent, referrer, ip))
                : clickTrackingService.destinationOnly(slug);

        return redirect
                .map(decision -> ResponseEntity.status(HttpStatus.FOUND)
                        .location(URI.create(decision.location()))
                        .<Void>build())
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static Map<String, String> firstValues(MultiValueMap<String, String> params) {
        Map<String, String> first = new LinkedHashMap<>();
        params.forEach((key, values) -> {
            if (values != null && !values.isEmpty()) {
                first.put(key, values.get(0));
            }
        });
        return first;
    }
}
