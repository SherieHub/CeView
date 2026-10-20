package com.ceview.module3.social.publish;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.social.publish.PublishingDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/posts")
public class PublishingController {
    private final PublishingService service;
    private final PostViewService views;
    private final CurrentBusinessProfile current;
    public PublishingController(PublishingService service,PostViewService views,CurrentBusinessProfile current) {
        this.service=service; this.views=views; this.current=current;
    }
    @PostMapping("/publish")
    public List<PostView> publish(@Valid @RequestBody PublishRequest request) {
        return service.publish(current.resolveProfileId(),request).stream().map(views::view).toList();
    }
    @GetMapping
    public List<PostView> list(@RequestParam(required=false) String status,
            @RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to) {
        return service.list(current.resolveProfileId()).stream().map(views::view)
                .filter(p -> status==null || p.status().equalsIgnoreCase(status) || p.deliveryStatus().equalsIgnoreCase(status))
                .filter(p -> from==null || !LocalDate.parse(p.date()).isBefore(from))
                .filter(p -> to==null || !LocalDate.parse(p.date()).isAfter(to)).toList();
    }
    @GetMapping("/{id}") public PostView get(@PathVariable UUID id) { return views.view(service.get(current.resolveProfileId(),id)); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> cancel(@PathVariable UUID id) {
        service.cancel(current.resolveProfileId(),id); return ResponseEntity.noContent().build();
    }
}
