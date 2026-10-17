package com.ceview.module4.attribution.link;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Clock;
import org.junit.jupiter.api.Test;

class AttributionRateLimiterTest {
  @Test
  void budgetsArePerHashAndResetAfterTheMinute() {
    Clock clock = mock(Clock.class);
    when(clock.millis()).thenReturn(0L);
    AttributionRateLimiter limiter = new AttributionRateLimiter(clock);
    String hash = limiter.hashIp("192.0.2.1");
    assertEquals(64, hash.length());
    assertEquals(hash, limiter.hashIp("192.0.2.1"));
    assertNotEquals(hash, limiter.hashIp("192.0.2.2"));
    for (int i = 0; i < AttributionRateLimiter.REQUESTS_PER_MINUTE; i++) {
      assertTrue(limiter.tryAcquireHash(hash));
    }
    assertFalse(limiter.tryAcquire("192.0.2.1"));
    assertTrue(limiter.tryAcquire("192.0.2.2"));
    when(clock.millis()).thenReturn(60_000L);
    assertTrue(limiter.tryAcquireHash(hash));
  }
}
