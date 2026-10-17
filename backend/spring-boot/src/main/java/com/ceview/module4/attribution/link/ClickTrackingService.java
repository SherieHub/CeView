package com.ceview.module4.attribution.link;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class ClickTrackingService {

  static final String HOSTED_ENQUIRY_PATH = "/attribution/enquiry";

  private static final int MAX_EXTERNAL_ID_LENGTH = 128;
  private static final int MAX_HEADER_LENGTH = 2048;
  private static final Pattern BRACE_MACRO = Pattern.compile("^\\{\\{[^{}]+}}$");
  private static final Pattern DOUBLE_UNDERSCORE_TOKEN = Pattern.compile("^__[^_].*__$");
  private static final Pattern UNSUBSTITUTED_TIKTOK_MACRO = Pattern.compile("^__[A-Z_]+__$");
  private static final Pattern NUMERIC_ID = Pattern.compile("^\\d+$");

  private final AttributionLinkRepository linkRepository;
  private final AttributionClickRepository clickRepository;
  private final BotFilter botFilter;
  private final AdUrlBuilder adUrlBuilder;
  private final String ipHashSalt;

  public ClickTrackingService(
      AttributionLinkRepository linkRepository,
      AttributionClickRepository clickRepository,
      BotFilter botFilter,
      AdUrlBuilder adUrlBuilder,
      @Value("${ceview.attribution.ip-hash-salt:dev-attribution-ip-hash-salt}") String ipHashSalt) {
    this.linkRepository = linkRepository;
    this.clickRepository = clickRepository;
    this.botFilter = botFilter;
    this.adUrlBuilder = adUrlBuilder;
    this.ipHashSalt = ipHashSalt == null ? "" : ipHashSalt;
  }

  @Transactional
  public Optional<RedirectDecision> capture(String slug, ClickRequest request) {
    return linkRepository.findBySlug(slug).map(link -> capture(link, request));
  }

  private RedirectDecision capture(AttributionLink link, ClickRequest request) {
    OffsetDateTime now = OffsetDateTime.now();
    String ipHash = hashIp(request.ipAddress());
    String destination = destinationFor(link);

    if (botFilter.shouldSuppress(link, request.userAgent(), ipHash, now)) {
      return new RedirectDecision(destination, null, false);
    }

    AttributionClick click = new AttributionClick();
    click.setLinkId(link.getLinkId());
    click.setBusinessProfileId(link.getBusinessProfileId());
    click.setExternalCampaignId(macroValue(request.params(), "cmp"));
    click.setExternalAdsetId(macroValue(request.params(), "set"));
    click.setExternalAdId(macroValue(request.params(), "ad"));
    click.setPlatform(platformFor(request.params(), click));
    click.setClickToken(firstPresent(request.params(), "fbclid", "ttclid"));
    click.setReferrer(truncate(request.referrer(), MAX_HEADER_LENGTH));
    click.setUserAgent(truncate(request.userAgent(), MAX_HEADER_LENGTH));
    click.setIpHash(ipHash);
    click.setInWindow(!now.isBefore(link.getWindowStart()) && !now.isAfter(link.getWindowEnd()));
    click.setClickedAt(now);

    AttributionClick saved = clickRepository.save(click);
    return new RedirectDecision(
        appendClickId(destination, saved.getClickId()), saved.getClickId(), true);
  }

  String hashIp(String ipAddress) {
    if (ipAddress == null || ipAddress.isBlank()) return null;
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash =
          digest.digest((ipHashSalt + ":" + ipAddress.trim()).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }

  private String destinationFor(AttributionLink link) {
    if (!link.isHosted()) return link.getDestinationUrl();
    return adUrlBuilder.baseUrl() + HOSTED_ENQUIRY_PATH;
  }

  private String appendClickId(String destination, UUID clickId) {
    return UriComponentsBuilder.fromUriString(destination)
        .queryParam("cv", clickId)
        .build()
        .toUriString();
  }

  private static String platformFor(Map<String, String> params, AttributionClick click) {
    if (hasResolvedTiktokToken(params)) return AttributionClick.PLATFORM_TIKTOK;
    if (isNumeric(click.getExternalCampaignId())
        || isNumeric(click.getExternalAdsetId())
        || isNumeric(click.getExternalAdId())) {
      return AttributionClick.PLATFORM_META;
    }
    return AttributionClick.PLATFORM_UNKNOWN;
  }

  private static boolean hasResolvedTiktokToken(Map<String, String> params) {
    for (String key : new String[] {"cmp", "set", "ad"}) {
      String raw = first(params, key);
      if (raw == null) continue;
      String trimmed = raw.trim();
      if (DOUBLE_UNDERSCORE_TOKEN.matcher(trimmed).matches()
          && !UNSUBSTITUTED_TIKTOK_MACRO.matcher(trimmed).matches()) {
        return true;
      }
    }
    return false;
  }

  private static String macroValue(Map<String, String> params, String key) {
    String raw = first(params, key);
    if (raw == null) return null;
    String trimmed = raw.trim();
    if (trimmed.isEmpty()
        || BRACE_MACRO.matcher(trimmed).matches()
        || UNSUBSTITUTED_TIKTOK_MACRO.matcher(trimmed).matches()) {
      return null;
    }
    if (DOUBLE_UNDERSCORE_TOKEN.matcher(trimmed).matches()) {
      trimmed = trimmed.substring(2, trimmed.length() - 2);
    }
    return truncate(trimmed, MAX_EXTERNAL_ID_LENGTH);
  }

  private static String firstPresent(Map<String, String> params, String... keys) {
    for (String key : keys) {
      String value = first(params, key);
      if (value != null && !value.isBlank()) return value.trim();
    }
    return null;
  }

  private static String first(Map<String, String> params, String key) {
    if (params == null) return null;
    String direct = params.get(key);
    if (direct != null) return direct;
    return params.get(key.toLowerCase(Locale.ROOT));
  }

  private static boolean isNumeric(String value) {
    return value != null && NUMERIC_ID.matcher(value).matches();
  }

  private static String truncate(String value, int maxLength) {
    if (value == null) return null;
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }

  public record ClickRequest(
      Map<String, String> params, String userAgent, String referrer, String ipAddress) {}

  public record RedirectDecision(String location, UUID clickId, boolean clickRecorded) {}
}
