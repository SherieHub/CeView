package com.ceview.testsupport;

import com.ceview.module4.postmetrics.PostMetric;
import com.ceview.testsupport.TestSupportSeedService.BusinessProfileRequest;
import com.ceview.testsupport.TestSupportSeedService.DemandWindowRequest;
import com.ceview.testsupport.TestSupportSeedService.PostMetricsRequest;
import com.ceview.testsupport.TestSupportSeedService.SeedException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * E2E-only seeding hooks for Playwright, alongside the email-code reader in
 * {@link com.ceview.email.TestSupportController}. Same guard: the bean exists only when
 * {@code ceview.test-support.enabled=true}, and SecurityConfig opens {@code /api/test-support/**}
 * only in that case.
 */
@RestController
@RequestMapping("/api/test-support")
@ConditionalOnProperty(name = "ceview.test-support.enabled", havingValue = "true")
public class TestSupportSeedController {

    private final TestSupportSeedService seeds;

    public TestSupportSeedController(TestSupportSeedService seeds) {
        this.seeds = seeds;
    }

    @PostMapping("/business-profile")
    public ResponseEntity<?> businessProfile(@RequestBody BusinessProfileRequest req) {
        return ResponseEntity.ok(Map.of("businessProfileId", seeds.seedBusinessProfile(req).getBusinessProfileId()));
    }

    @PostMapping("/demand-window")
    public ResponseEntity<?> demandWindow(@RequestBody DemandWindowRequest req) {
        return ResponseEntity.ok(seeds.seedDemandWindow(req));
    }

    @PostMapping("/post-metrics")
    public ResponseEntity<?> postMetrics(@RequestBody PostMetricsRequest req) {
        PostMetric row = seeds.seedPostMetrics(req);
        return ResponseEntity.ok(Map.of("postId", row.getPostId(), "id", row.getId()));
    }

    @PostMapping("/email-codes/expire")
    public ResponseEntity<?> expireEmailCodes(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(Map.of("expired", seeds.expireEmailCodes(body.get("email"))));
    }

    @ExceptionHandler(SeedException.class)
    ResponseEntity<?> seedFailed(SeedException e) {
        return ResponseEntity.status(e.status).body(Map.of("error", e.getMessage()));
    }
}
