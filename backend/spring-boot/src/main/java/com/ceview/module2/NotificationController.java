package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module2.dto.NotificationDtos.NotificationsResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * HomeView notifications. Backed by FastAPI; response is deserialised into
 * typed records so missing/renamed fields surface here, not as silent
 * `undefined` in the React `TrendAlertCard`.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public NotificationController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    @GetMapping
    public NotificationsResponse list() {
        Map<String, Object> raw = ai.listNotifications();
        return mapper.convertValue(raw, NotificationsResponse.class);
    }
}
