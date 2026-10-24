package com.ceview.module4.attribution.link;

import com.ceview.auth.CurrentBusinessProfile;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class EnquiryController {
    private final EnquiryService service;
    private final CurrentBusinessProfile currentProfile;

    public EnquiryController(EnquiryService service, CurrentBusinessProfile currentProfile) {
        this.service = service;
        this.currentProfile = currentProfile;
    }

    // Public traveller endpoints: the validated click establishes the business.
    @PostMapping("/api/public/attribution/enquiries")
    public AttributionLinkDtos.EnquiryAck submit(@Valid @RequestBody AttributionLinkDtos.EnquiryRequest request) {
        return service.submit(request);
    }

    @GetMapping("/api/public/attribution/enquiries/context")
    public ResponseEntity<EnquiryService.EnquiryContext> context(@RequestParam UUID cv) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.context(cv));
    }

    // Operator endpoint: identity comes exclusively from the authenticated JWT.
    @GetMapping("/api/attribution/enquiries")
    public ResponseEntity<List<EnquiryService.OperatorEnquiry>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.list(currentProfile.resolveProfileId()));
    }

    // The operator decides what an enquiry became; the enquiry is looked up within their own business only.
    @PatchMapping("/api/attribution/enquiries/{enquiryId}")
    public ResponseEntity<EnquiryService.OperatorEnquiry> decide(
            @PathVariable UUID enquiryId, @Valid @RequestBody AttributionLinkDtos.EnquiryOutcomeRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.decide(currentProfile.resolveProfileId(), enquiryId, request));
    }

    @ExceptionHandler(EnquiryService.EnquiryNotFoundException.class)
    public ResponseEntity<Map<String, String>> enquiryNotFound() {
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND).cacheControl(CacheControl.noStore())
                .body(Map.of("error", "Enquiry not found."));
    }

    @ExceptionHandler({EnquiryService.InvalidEnquiryException.class,
            org.springframework.web.bind.MethodArgumentNotValidException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, String>> invalidEnquiry() {
        return ResponseEntity.badRequest().cacheControl(CacheControl.noStore())
                .body(Map.of("error", "Unable to process this enquiry."));
    }
}
