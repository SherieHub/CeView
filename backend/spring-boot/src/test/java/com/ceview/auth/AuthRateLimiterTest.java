package com.ceview.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthRateLimiterTest {

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-10-18T00:00:00Z");
        void advance(Duration d) { now = now.plus(d); }
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void blocksAfterMaxRequestsWithinWindowAndReopensAfterIt() {
        MutableClock clock = new MutableClock();
        AuthRateLimiter limiter = new AuthRateLimiter(2, 60, clock);

        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertFalse(limiter.tryAcquire("1.1.1.1"));
        assertEquals(60, limiter.retryAfterSeconds("1.1.1.1"));

        clock.advance(Duration.ofSeconds(61));
        assertTrue(limiter.tryAcquire("1.1.1.1"));
    }

    @Test
    void tracksEachKeySeparately() {
        AuthRateLimiter limiter = new AuthRateLimiter(1, 60, new MutableClock());

        assertTrue(limiter.tryAcquire("1.1.1.1"));
        assertFalse(limiter.tryAcquire("1.1.1.1"));
        assertTrue(limiter.tryAcquire("2.2.2.2"));
    }
}
