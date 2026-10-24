package com.ceview.module3.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Content Studio saved drafts (/api/content/drafts). The payload is opaque to the backend. */
public final class ContentDraftDtos {
    private ContentDraftDtos() {}

    /**
     * A row in the named-drafts list: no payload, just enough to recognise the draft and to tell
     * whether it can be published as it stands.
     *
     * @param hasMedia    an uploaded image or video is attached
     * @param mediaUrl    the attached image's public URL, for a thumbnail; null for a video or none
     * @param auditStatus "Pass" or "Fail" when the compliance audit was saved with the draft, else null
     * @param auditScore  that audit's OMCS score, rounded; null when there is no audit
     */
    public record DraftSummaryDto(
            UUID id, String kind, String name, String market, UUID demandAlertId,
            String captionPreview, boolean hasMedia, String mediaUrl, String auditStatus, Integer auditScore,
            OffsetDateTime updatedAt) {}

    /**
     * @param existing true only when a request to save a NEW draft found one with identical content
     *                 already saved, so nothing was created and this is that existing draft
     */
    public record DraftDto(
            UUID id, String kind, String name, String market, UUID demandAlertId,
            JsonNode payload, OffsetDateTime createdAt, OffsetDateTime updatedAt, boolean existing) {}

    public record AutosaveRequest(JsonNode payload) {}

    public record CreateDraftRequest(String name, JsonNode payload) {}

    /** Either field may be omitted; a rename and a payload update can travel together. */
    public record UpdateDraftRequest(String name, JsonNode payload) {}
}
