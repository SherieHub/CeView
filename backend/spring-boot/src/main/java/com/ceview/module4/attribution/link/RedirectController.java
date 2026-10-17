package com.ceview.module4.attribution.link;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RedirectController {

  private final ClickTrackingService clickTrackingService;

  public RedirectController(ClickTrackingService clickTrackingService) {
    this.clickTrackingService = clickTrackingService;
  }

  @GetMapping("/r/{slug}")
  public ResponseEntity<Void> redirect(
      @PathVariable String slug,
      @RequestParam MultiValueMap<String, String> params,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String userAgent,
      @RequestHeader(value = HttpHeaders.REFERER, required = false) String referrer,
      HttpServletRequest request) {
    ClickTrackingService.ClickRequest clickRequest =
        new ClickTrackingService.ClickRequest(
            firstValues(params), userAgent, referrer, clientIp(request));

    return clickTrackingService
        .capture(slug, clickRequest)
        .map(
            decision ->
                ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(decision.location()))
                    .<Void>build())
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  private static Map<String, String> firstValues(MultiValueMap<String, String> params) {
    Map<String, String> first = new LinkedHashMap<>();
    params.forEach(
        (key, values) -> {
          if (values != null && !values.isEmpty()) {
            first.put(key, values.get(0));
          }
        });
    return first;
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",", 2)[0].trim();
    }
    return request.getRemoteAddr();
  }
}
