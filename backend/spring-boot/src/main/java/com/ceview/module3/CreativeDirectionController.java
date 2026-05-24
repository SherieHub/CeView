package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** SDD §3.2 — Creative Direction. Returns shot lists / lighting / moodboard. */
@RestController
@RequestMapping("/api/v1/creative-direction")
public class CreativeDirectionController {

    private final AIInferenceGatewayService ai;

    public CreativeDirectionController(AIInferenceGatewayService ai) { this.ai = ai; }

    @PostMapping("/generate/{profileId}")
    public Map<String, Object> generate(@PathVariable String profileId,
                                        @RequestBody(required = false) Map<String, Object> body) {
        var payload = body == null ? new java.util.HashMap<String, Object>() : new java.util.HashMap<>(body);
        payload.put("profileId", profileId);
        return ai.generateCreative(payload);
    }
}
