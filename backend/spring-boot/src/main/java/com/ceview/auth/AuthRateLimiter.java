package com.ceview.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/**
 * Process-local fixed-window limiter for the auth endpoints that carry phone verification
 * (register and complete-profile), keyed by the trusted servlet remote address. The SMS itself
 * is sent client-side by Firebase (which has its own quotas), so this bounds how often a single
 * client can hit our endpoints with verification tokens or unverified numbers.
 */
@Component
public class AuthRateLimiter {
    private static final int MAX_KEYS = 10_000;

    private final int maxRequests;
    private final long windowMillis;
    private final Clock clock;
    private final Map<String, Window> windows = new HashMap<>();

    private static final class Window {
        final long startMillis;
        int count;
        Window(long startMillis) { this.startMillis = startMillis; }
    }

    @Autowired
    public AuthRateLimiter(
        @Value("${ceview.auth.rate-limit.max-requests:20}") int maxRequests,
        @Value("${ceview.auth.rate-limit.window-seconds:900}") long windowSeconds
    ) {
        this(maxRequests, windowSeconds, Clock.systemUTC());
    }

    AuthRateLimiter(int maxRequests, long windowSeconds, Clock clock) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowSeconds * 1000;
        this.clock = clock;
    }

    public synchronized boolean tryAcquire(String key) {
        long now = clock.millis();
        Window w = windows.get(key);
        if (w == null || now - w.startMillis >= windowMillis) {
            if (w == null && windows.size() >= MAX_KEYS) {
                windows.values().removeIf(x -> now - x.startMillis >= windowMillis);
                if (windows.size() >= MAX_KEYS) return false;
            }
            w = new Window(now);
            windows.put(key, w);
        }
        if (w.count >= maxRequests) return false;
        w.count++;
        return true;
    }

    /** Seconds until the current window for {@code key} resets (for Retry-After). */
    public synchronized long retryAfterSeconds(String key) {
        Window w = windows.get(key);
        if (w == null) return 0;
        long remaining = windowMillis - (clock.millis() - w.startMillis);
        return Math.max(1, (remaining + 999) / 1000);
    }
}
