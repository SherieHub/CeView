package com.ceview.module1.performance;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/admin/model-performance")
public class ModelPerformanceController {
    private final ModelPerformanceService service;

    public ModelPerformanceController(ModelPerformanceService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ModelPerformanceService.Report> report(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(required = false) String modelVersion) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.report(from, to, modelVersion));
    }
}
