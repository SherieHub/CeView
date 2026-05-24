package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HomeView notifications. Backed by FastAPI for shape parity with the
 * frontend's MOCK_NOTIFICATIONS in constants.ts.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final AIInferenceGatewayService ai;

    public NotificationController(AIInferenceGatewayService ai) { this.ai = ai; }

    @GetMapping
    public Map<String, Object> list() {
        return ai.listNotifications();
    }
}
