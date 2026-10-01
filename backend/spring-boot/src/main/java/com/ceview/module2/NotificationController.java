package com.ceview.module2;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.NotificationDtos.NotificationsResponse;
import com.ceview.module2.submodule22.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * HomeView notifications (Submodule 2.2, FR2.15).
 * Reads persisted Module 2 alerts from the DB. Notification requests never
 * call external trend services.
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
     * Persisted keyword-trend notifications. The scheduled producer performs any
     * slow PyTrends work separately; this endpoint never waits for it.
     */
    @GetMapping("/keyword-trends")
    public NotificationsResponse keywordTrends() {
        return notificationService.getKeywordTrendNotifications(
                currentBusinessProfile.resolveProfileId());
    }
}
