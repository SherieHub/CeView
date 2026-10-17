package com.ceview.module4.attribution.link;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Builds the two strings an operator needs: the bare link that goes in a caption, and the
 * macro-suffixed URL that goes in an ad's "URL parameters" field.
 *
 * <p><b>The macros are the whole point.</b> A click's {@code fbclid} / {@code ttclid} is opaque and
 * cannot be decoded into an ad id, so it can never answer "which creative produced this booking".
 * What answers it is the platform substituting its own ids into the URL at click time. If the
 * operator pastes the bare link and skips the macro string, every click arrives untagged and the
 * feature silently degrades to campaign-level attribution — which is why Content Studio surfaces
 * this as a copyable block rather than leaving the operator to construct it.
 *
 * <p>Parameter names are deliberately short ({@code cmp}/{@code set}/{@code ad}) rather than {@code
 * utm_*}: this URL is pasted by hand into a small field, and the values are read back by CeView,
 * not by an analytics vendor.
 */
@Component
public class AdUrlBuilder {

  /**
   * Public origin the redirect is served from. Distinct from the API origin on purpose — this one
   * ends up inside paid ads, so it wants to be short and stable, and it is the piece most likely to
   * move to a dedicated always-warm host (see the cold-start risk in the design spec).
   */
  private final String baseUrl;

  public AdUrlBuilder(
      @Value("${ceview.attribution.base-url:http://localhost:8080}") String baseUrl) {
    this.baseUrl = stripTrailingSlash(baseUrl);
  }

  /** What goes in a caption or a link-in-bio. */
  public String linkUrl(String slug) {
    return baseUrl + "/r/" + slug;
  }

  /**
   * What goes in Meta Ads Manager's "URL parameters" field. Meta substitutes each {@code {{...}}}
   * token at click time.
   */
  public String metaAdUrl(String slug) {
    return linkUrl(slug) + "?cmp={{campaign.id}}&set={{adset.id}}&ad={{ad.id}}";
  }

  /**
   * The TikTok equivalent. TikTok uses bare double-underscore tokens rather than braces, and calls
   * the ad-level id {@code __CID__} — not to be confused with Meta's campaign id, which is the
   * naming trap here.
   */
  public String tiktokAdUrl(String slug) {
    return linkUrl(slug) + "?cmp=__CAMPAIGN_ID__&set=__AID__&ad=__CID__";
  }

  public String baseUrl() {
    return baseUrl;
  }

  private static String stripTrailingSlash(String s) {
    return (s != null && s.endsWith("/")) ? s.substring(0, s.length() - 1) : s;
  }
}
