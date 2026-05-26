package com.ceview.module2;

import com.ceview.module2.dto.NotificationDtos.NotificationsResponse;
import com.ceview.module2.submodule22.NotificationService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * HomeView notifications (Submodule 2.2, FR2.15).
 * Reads persisted demand alerts from the DB; falls back to FastAPI stub
 * when no alerts exist for the profile.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public NotificationsResponse list(@RequestParam(required = false) UUID profileId) {
        return notificationService.getNotificationsForProfile(profileId);
    }
}
