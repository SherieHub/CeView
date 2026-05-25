package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module3.dto.ComplianceDtos.ComplianceResultDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

/** SDD §3.3 — Multimodal Compliance. Returns { score, aligned[], gaps[] }. */
@RestController
@RequestMapping("/api/v1/compliance")
public class ComplianceController {

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public ComplianceController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    @PostMapping(value = "/evaluate", consumes = {"multipart/form-data", "application/json"})
    public ComplianceResultDto evaluate(
            @RequestPart(value = "caption", required = false) String caption,
            @RequestPart(value = "market", required = false) String market,
            @RequestPart(value = "media", required = false) MultipartFile media) {
        var payload = new HashMap<String, Object>();
        payload.put("caption", caption);
        payload.put("market", market);
        payload.put("mediaName", media == null ? null : media.getOriginalFilename());
        payload.put("mediaSize", media == null ? 0 : media.getSize());
        Map<String, Object> raw = ai.evaluateCompliance(payload);
        return mapper.convertValue(raw, ComplianceResultDto.class);
    }

    /** JSON-only variant for clients that send no file upload. */
    @PostMapping(value = "/evaluate-json", consumes = "application/json")
    public ComplianceResultDto evaluateJson(@RequestBody Map<String, Object> body) {
        Map<String, Object> raw = ai.evaluateCompliance(body == null ? Map.of() : body);
        return mapper.convertValue(raw, ComplianceResultDto.class);
    }
}
