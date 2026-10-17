package com.ceview.module4.attribution.link;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Shared, process-local IP-hash budget for public attribution requests. */
@Component
public class AttributionRateLimiter {
  public static final int REQUESTS_PER_MINUTE = 30;
  private static final int MAX_ADDRESSES = 10_000;
  private final Clock clock;
  private final String salt = UUID.randomUUID().toString();
  private final Map<String, Integer> counts = new HashMap<>();
  private long minute = -1;

  public AttributionRateLimiter() {
    this(Clock.systemUTC());
  }

  AttributionRateLimiter(Clock clock) {
    this.clock = clock;
  }

  /** Pass the trusted servlet remote address, never an unverified forwarding header. */
  public boolean tryAcquire(String remoteAddress) {
    return tryAcquireHash(hashIp(remoteAddress));
  }

  /** Track 2 can reuse this method with its already-hashed click IP. */
  public synchronized boolean tryAcquireHash(String ipHash) {
    long currentMinute = clock.millis() / 60_000;
    if (minute != currentMinute) {
      counts.clear();
      minute = currentMinute;
    }
    int count = counts.getOrDefault(ipHash, 0);
    if (count >= REQUESTS_PER_MINUTE || (count == 0 && counts.size() >= MAX_ADDRESSES))
      return false;
    counts.put(ipHash, count + 1);
    return true;
  }

  public String hashIp(String remoteAddress) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest((salt + remoteAddress).getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
