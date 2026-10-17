package com.ceview.module4.attribution.link;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * Produces the short random slug that appears in an ad.
 *
 * <p><b>Why random and not derived.</b> {@code AttributionCode.code} is derived from market +
 * category + date on purpose: a customer has to be able to say it out loud. A slug derived the same
 * way would let anyone enumerate every other operator's live campaigns by guessing plausible
 * market/category/date combinations — and the redirect cannot be tenant-scoped, because the request
 * arrives from a browser with no JWT. The slug <em>is</em> the credential.
 *
 * <p>The alphabet excludes {@code 0/O} and {@code 1/I/l}: these get read off screens, retyped, and
 * occasionally dictated over the phone.
 *
 * <p>8 characters over a 32-symbol alphabet is 40 bits — ample against guessing at the volumes
 * involved, and short enough not to dominate an ad's link.
 */
@Component
public class SlugGenerator {

  static final String ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
  static final int LENGTH = 8;

  private final SecureRandom random = new SecureRandom();

  public String generate() {
    StringBuilder sb = new StringBuilder(LENGTH);
    for (int i = 0; i < LENGTH; i++) {
      sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
    }
    return sb.toString();
  }
}
