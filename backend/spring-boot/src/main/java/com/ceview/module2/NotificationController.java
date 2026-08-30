package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.NotificationDtos.NotificationsResponse;
import com.ceview.module2.submodule22.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * HomeView notifications (Submodule 2.2, FR2.15).
 * Reads persisted demand alerts from the DB; falls back to FastAPI stub
 * when no alerts exist for the profile.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final CurrentBusinessProfile currentBusinessProfile;

    public NotificationController(NotificationService notificationService,
                                   CurrentBusinessProfile currentBusinessProfile) {
        this.notificationService = notificationService;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    @GetMapping
    public NotificationsResponse list(@RequestParam(required = false) UUID profileId) {
        // Derives the caller's own profile when omitted, or rejects a mismatched
        // client-supplied one — never trusts profileId outright.
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        return notificationService.getNotificationsForProfile(resolvedProfileId);
    }

    /** Persists the read flag the dashboard already sets optimistically. */
    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id) {
        notificationService.markRead(currentBusinessProfile.resolveProfileId(), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Keyword-trend notifications, split out of GET /api/notifications because each
     * category round-trips to PyTrends via FastAPI rank-markets (up to 75s). The
     * dashboard loads this independently so a slow AI hop cannot block the alert feed.
     */
    @GetMapping("/keyword-trends")
    public NotificationsResponse keywordTrends() {
        return notificationService.getKeywordTrendNotifications(
                currentBusinessProfile.resolveProfileId());
    }
}
