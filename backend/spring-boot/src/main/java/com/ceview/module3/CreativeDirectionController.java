package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module3.dto.CreativeDirectionDtos.CreativeDirectionDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** SDD §3.2 — Creative Direction. Returns shot lists / lighting / moodboard. */
@RestController
@RequestMapping("/api/v1/creative-direction")
public class CreativeDirectionController {

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public CreativeDirectionController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    @PostMapping("/generate/{profileId}")
    public CreativeDirectionDto generate(@PathVariable String profileId,
                                         @RequestBody(required = false) Map<String, Object> body) {
        var payload = body == null ? new java.util.HashMap<String, Object>() : new java.util.HashMap<>(body);
        payload.put("profileId", profileId);
        Map<String, Object> raw = ai.generateCreative(payload);
        return mapper.convertValue(raw, CreativeDirectionDto.class);
    }
}
