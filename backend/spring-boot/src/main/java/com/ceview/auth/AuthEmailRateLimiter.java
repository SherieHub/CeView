package com.ceview.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.OptionalLong;

/**
 * Process-local per-IP budget for the auth endpoints that send email. It exists to protect the
 * email provider's free quota (Resend: 100/day): the per-account cooldown and hourly cap cannot
 * stop one client cycling through many addresses. Fixed window, same approach as the attribution
 * limiter, and the address map is capped so it cannot grow without bound.
 */
@Component
public class AuthEmailRateLimiter {

    private static final int MAX_ADDRESSES = 10_000;

    private final Clock clock;
    private final int maxRequests;
    private final long windowMillis;
    private final Map<String, Integer> counts = new HashMap<>();
    private long window = -1;

    @Autowired
    public AuthEmailRateLimiter(
        Clock clock,
        @Value("${ceview.auth-rate-limit.max-requests:10}") int maxRequests,
        @Value("${ceview.auth-rate-limit.window:15m}") Duration window
    ) {
        this.clock = clock;
        this.maxRequests = maxRequests;
        this.windowMillis = window.toMillis();
    }

    /**
     * Pass the servlet remote address (resolved from the forwarded headers by Spring when
     * {@code server.forward-headers-strategy=framework}).
     *
     * @return empty if the request is allowed, otherwise the seconds until the window resets
     */
    public synchronized OptionalLong tryAcquire(String remoteAddress) {
        long now = clock.millis();
        long current = now / windowMillis;
        if (window != current) {
            counts.clear();
            window = current;
        }
        int count = counts.getOrDefault(remoteAddress, 0);
        if (count >= maxRequests || (count == 0 && counts.size() >= MAX_ADDRESSES)) {
            long resetMillis = (current + 1) * windowMillis - now;
            return OptionalLong.of(Math.max(1, (long) Math.ceil(resetMillis / 1000.0)));
        }
        counts.put(remoteAddress, count + 1);
        return OptionalLong.empty();
    }
}
