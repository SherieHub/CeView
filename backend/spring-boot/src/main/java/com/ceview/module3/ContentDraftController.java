package com.ceview.module3;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.dto.ContentDraftDtos.AutosaveRequest;
import com.ceview.module3.dto.ContentDraftDtos.CreateDraftRequest;
import com.ceview.module3.dto.ContentDraftDtos.DraftDto;
import com.ceview.module3.dto.ContentDraftDtos.DraftSummaryDto;
import com.ceview.module3.dto.ContentDraftDtos.UpdateDraftRequest;
import com.ceview.module3.submodule31.ContentDraftService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Submodule 3.1 — saved Content Studio drafts, so an operator can come back to generated
 * captions and content direction without regenerating them.
 *
 * <p>There is no profileId anywhere in this API: the profile is always the caller's own,
 * resolved from the JWT by {@link CurrentBusinessProfile}. A draft that belongs to someone
 * else is indistinguishable from one that does not exist (404).
 *
 * GET    /auto?market=  — the working draft for a market (204 when there is none)
 * PUT    /auto?market=  — upsert the working draft
 * GET    ?market=       — the named drafts for a market, newest first
 * POST   ?market=       — save a named draft
 * GET    /{id} · PUT /{id} · DELETE /{id}
 */
@RestController
@RequestMapping("/api/content/drafts")
public class ContentDraftController {

    private final ContentDraftService drafts;
    private final CurrentBusinessProfile currentBusinessProfile;

    public ContentDraftController(ContentDraftService drafts, CurrentBusinessProfile currentBusinessProfile) {
        this.drafts = drafts;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    @GetMapping
    public List<DraftSummaryDto> list(@RequestParam String market) {
        return drafts.listNamed(currentBusinessProfile.resolveOrValidate(null), market);
    }

    @GetMapping("/auto")
    public ResponseEntity<DraftDto> auto(@RequestParam String market) {
        return drafts.findAuto(currentBusinessProfile.resolveOrValidate(null), market)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/auto")
    public DraftDto autosave(@RequestParam String market,
                             @RequestParam(required = false) UUID demandAlertId,
                             @RequestBody AutosaveRequest body) {
        return drafts.autosave(currentBusinessProfile.resolveOrValidate(null), market, demandAlertId,
                body == null ? null : body.payload());
    }

    /** 201 for a new draft; 200 with the existing one when identical content was already saved. */
    @PostMapping
    public ResponseEntity<DraftDto> create(@RequestParam String market,
                                           @RequestParam(required = false) UUID demandAlertId,
                                           @RequestBody CreateDraftRequest body) {
        DraftDto draft = drafts.createNamed(currentBusinessProfile.resolveOrValidate(null), market, demandAlertId,
                body == null ? null : body.name(), body == null ? null : body.payload());
        return ResponseEntity.status(draft.existing() ? HttpStatus.OK : HttpStatus.CREATED).body(draft);
    }

    @GetMapping("/{id}")
    public DraftDto get(@PathVariable UUID id) {
        return drafts.get(currentBusinessProfile.resolveOrValidate(null), id);
    }

    @PutMapping("/{id}")
    public DraftDto update(@PathVariable UUID id, @RequestBody UpdateDraftRequest body) {
        return drafts.updateNamed(currentBusinessProfile.resolveOrValidate(null), id,
                body == null ? null : body.name(), body == null ? null : body.payload());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        drafts.delete(currentBusinessProfile.resolveOrValidate(null), id);
    }
}
