package com.ceview.module3.submodule31;

import com.ceview.common.TraceIdFilter;
import com.ceview.module3.Module3ErrorCodes;
import com.ceview.module3.dto.ContentDraftDtos.DraftDto;
import com.ceview.module3.dto.ContentDraftDtos.DraftSummaryDto;
import com.ceview.module3.media.MediaAssetRepository;
import com.ceview.module3.media.MediaService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Saved Content Studio drafts. Every method takes the profile id the controller resolved
 * from the JWT and scopes every lookup by it, so a foreign draft id is simply "not found".
 */
@Service
public class ContentDraftService {

    static final int MAX_PAYLOAD_BYTES = 512 * 1024;
    static final int MAX_NAMED_PER_MARKET = 20;
    static final int MAX_NAME_CHARS = 120;
    static final int MAX_MARKET_CHARS = 60;
    static final int PREVIEW_CHARS = 140;
    static final String AUTO_NAME = "Auto-saved draft";

    private final ContentStudioDraftRepository repo;
    private final ObjectMapper objectMapper;
    private final MediaAssetRepository mediaAssets;
    private final MediaService mediaService;

    public ContentDraftService(ContentStudioDraftRepository repo, ObjectMapper objectMapper,
                               MediaAssetRepository mediaAssets, MediaService mediaService) {
        this.repo = repo;
        this.objectMapper = objectMapper;
        this.mediaAssets = mediaAssets;
        this.mediaService = mediaService;
    }

    public List<DraftSummaryDto> listNamed(UUID profileId, String market) {
        return repo.findByBusinessProfileIdAndMarketAndKindOrderByUpdatedAtDesc(
                        profileId, market(market), ContentStudioDraft.KIND_NAMED)
                .stream().map(this::toSummary).toList();
    }

    public Optional<DraftDto> findAuto(UUID profileId, String market) {
        return repo.findFirstByBusinessProfileIdAndMarketAndKind(
                profileId, market(market), ContentStudioDraft.KIND_AUTO).map(this::toDto);
    }

    public DraftDto get(UUID profileId, UUID id) {
        return toDto(owned(profileId, id));
    }

    /** Upserts the one auto-saved draft for (profile, market). */
    public DraftDto autosave(UUID profileId, String market, UUID alertId, JsonNode payload) {
        String m = market(market);
        String json = serialize(payload);
        ContentStudioDraft draft = repo.findFirstByBusinessProfileIdAndMarketAndKind(
                profileId, m, ContentStudioDraft.KIND_AUTO).orElseGet(() -> {
            ContentStudioDraft created = new ContentStudioDraft();
            created.setBusinessProfileId(profileId);
            created.setMarket(m);
            created.setKind(ContentStudioDraft.KIND_AUTO);
            created.setName(AUTO_NAME);
            return created;
        });
        draft.setDemandAlertId(alertId);
        draft.setPayloadJson(json);
        try {
            return toDto(repo.save(draft));
        } catch (DataIntegrityViolationException lostRace) {
            // Two saves for a brand-new market raced past the find; the unique index kept one.
            ContentStudioDraft existing = repo.findFirstByBusinessProfileIdAndMarketAndKind(
                    profileId, m, ContentStudioDraft.KIND_AUTO).orElseThrow(() -> lostRace);
            existing.setDemandAlertId(alertId);
            existing.setPayloadJson(json);
            return toDto(repo.save(existing));
        }
    }

    public DraftDto createNamed(UUID profileId, String market, UUID alertId, String name, JsonNode payload) {
        String m = market(market);
        String cleanName = name(name);
        String json = serialize(payload);

        // Saving the same work twice (a double-click, two tabs, "Save as" with nothing changed)
        // must not add a copy. JsonNode equality ignores field order. Checked before the limit so
        // a duplicate never counts against it, or fails because of it.
        JsonNode incoming = parse(json);
        for (ContentStudioDraft saved : repo.findByBusinessProfileIdAndMarketAndKindOrderByUpdatedAtDesc(
                profileId, m, ContentStudioDraft.KIND_NAMED)) {
            if (parse(saved.getPayloadJson()).equals(incoming)) {
                return toDto(saved, true);
            }
        }

        if (repo.countByBusinessProfileIdAndMarketAndKind(profileId, m, ContentStudioDraft.KIND_NAMED)
                >= MAX_NAMED_PER_MARKET) {
            throw fail(HttpStatus.CONFLICT, Module3ErrorCodes.MOD31_DRAFT_LIMIT,
                    "You can keep up to " + MAX_NAMED_PER_MARKET + " saved drafts per market. Delete one first.");
        }
        ContentStudioDraft draft = new ContentStudioDraft();
        draft.setBusinessProfileId(profileId);
        draft.setMarket(m);
        draft.setKind(ContentStudioDraft.KIND_NAMED);
        draft.setName(cleanName);
        draft.setDemandAlertId(alertId);
        draft.setPayloadJson(json);
        return toDto(repo.save(draft));
    }

    public DraftDto updateNamed(UUID profileId, UUID id, String name, JsonNode payload) {
        ContentStudioDraft draft = owned(profileId, id);
        if (ContentStudioDraft.KIND_AUTO.equals(draft.getKind())) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION,
                    "The auto-saved draft is updated with PUT /api/content/drafts/auto");
        }
        if (name == null && payload == null) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION,
                    "name or payload is required");
        }
        if (name != null) draft.setName(name(name));
        if (payload != null) draft.setPayloadJson(serialize(payload));
        return toDto(repo.save(draft));
    }

    public void delete(UUID profileId, UUID id) {
        repo.delete(owned(profileId, id));
    }

    private ContentStudioDraft owned(UUID profileId, UUID id) {
        return repo.findByDraftIdAndBusinessProfileId(id, profileId)
                .orElseThrow(() -> fail(HttpStatus.NOT_FOUND, Module3ErrorCodes.MOD31_DRAFT_NOT_FOUND,
                        "draft not found"));
    }

    private String market(String raw) {
        String m = raw == null ? "" : raw.strip();
        if (m.isEmpty() || m.length() > MAX_MARKET_CHARS) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION,
                    "market is required (at most " + MAX_MARKET_CHARS + " characters)");
        }
        return m;
    }

    private String name(String raw) {
        String n = raw == null ? "" : raw.strip();
        if (n.isEmpty() || n.length() > MAX_NAME_CHARS) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION,
                    "name must be 1-" + MAX_NAME_CHARS + " characters");
        }
        return n;
    }

    private String serialize(JsonNode payload) {
        if (payload == null || !payload.isObject()) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION,
                    "payload must be a JSON object");
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw fail(HttpStatus.BAD_REQUEST, Module3ErrorCodes.MOD31_DRAFT_VALIDATION, "payload is not valid JSON");
        }
        if (json.getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            throw fail(HttpStatus.PAYLOAD_TOO_LARGE, Module3ErrorCodes.MOD31_DRAFT_TOO_LARGE,
                    "draft is too large (limit " + (MAX_PAYLOAD_BYTES / 1024) + " KB)");
        }
        return json;
    }

    private JsonNode parse(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            return objectMapper.createObjectNode();
        }
    }

    private DraftDto toDto(ContentStudioDraft d) {
        return toDto(d, false);
    }

    private DraftDto toDto(ContentStudioDraft d, boolean existing) {
        return new DraftDto(d.getDraftId(), d.getKind(), d.getName(), d.getMarket(), d.getDemandAlertId(),
                parse(d.getPayloadJson()), d.getCreatedAt(), d.getUpdatedAt(), existing);
    }

    private DraftSummaryDto toSummary(ContentStudioDraft d) {
        JsonNode payload = parse(d.getPayloadJson());
        JsonNode media = payload.path("media");
        boolean hasMedia = !media.path("publicUrl").asText("").isEmpty();
        JsonNode audit = payload.path("audit");
        String auditStatus = audit.path("status").asText(null);
        Integer auditScore = audit.path("omcsScore").isNumber()
                ? (int) Math.round(audit.path("omcsScore").asDouble()) : null;
        return new DraftSummaryDto(d.getDraftId(), d.getKind(), d.getName(), d.getMarket(), d.getDemandAlertId(),
                preview(payload), hasMedia,
                // A thumbnail only for an image: a video's URL is not something an <img> can show.
                hasMedia && "image".equals(media.path("kind").asText(""))
                        ? currentImageUrl(d.getBusinessProfileId(), media.path("mediaId").asText(""))
                        : null,
                auditStatus, auditScore, d.getUpdatedAt());
    }

    /**
     * The picture's URL as of now, from the asset itself: the {@code publicUrl} saved inside the
     * draft is from whenever it was uploaded and stops working if the public base URL changes.
     * Null when the asset is gone (or isn't this operator's), so no broken thumbnail is shown.
     */
    private String currentImageUrl(UUID profileId, String mediaId) {
        UUID id;
        try {
            id = UUID.fromString(mediaId);
        } catch (IllegalArgumentException e) {
            return null;
        }
        return mediaAssets.findByMediaIdAndBusinessProfileId(id, profileId)
                .map(mediaService::publicUrlOf)
                .orElse(null);
    }

    /** The caption being worked on: the composer's caption, else the chosen (or first) generated option. */
    private static String preview(JsonNode payload) {
        String caption = payload.path("draft").path("caption").asText("").strip();
        if (caption.isEmpty()) {
            String platform = payload.path("activePlatform").asText("instagram");
            JsonNode options = payload.path("content").path("captions").path(platform).path("options");
            int index = payload.path("selectedOption").asInt(0);
            if (options.isArray() && options.size() > 0) {
                caption = options.path(index >= 0 && index < options.size() ? index : 0).asText("").strip();
            }
        }
        return caption.length() > PREVIEW_CHARS ? caption.substring(0, PREVIEW_CHARS) + "..." : caption;
    }

    private static ResponseStatusException fail(HttpStatus status, String code, String message) {
        MDC.put(TraceIdFilter.MDC_CODE_KEY, code);
        return new ResponseStatusException(status, message);
    }
}
