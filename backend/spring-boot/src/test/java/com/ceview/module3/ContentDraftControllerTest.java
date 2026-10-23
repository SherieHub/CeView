package com.ceview.module3;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.media.MediaAsset;
import com.ceview.module3.media.MediaAssetRepository;
import com.ceview.module3.submodule31.ContentStudioDraft;
import com.ceview.module3.submodule31.ContentStudioDraftRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Saved Content Studio drafts: auto-save upsert, named CRUD, limits, and per-operator isolation. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class ContentDraftControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private ContentStudioDraftRepository draftRepo;
    @Autowired private MediaAssetRepository mediaRepo;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    private String tokenA;
    private String tokenB;
    private UUID profileA;

    @BeforeEach
    void setUp() {
        draftRepo.deleteAll();
        profileRepo.deleteAll();
        tokenA = operatorWithProfile("a@example.com", "Operator A");
        tokenB = operatorWithProfile("b@example.com", "Operator B");
        profileA = profileRepo.findAll().stream()
                .filter(p -> "Operator A".equals(p.getBusinessName()))
                .findFirst().orElseThrow().getBusinessProfileId();
    }

    private String operatorWithProfile(String email, String business) {
        UUID operator = UUID.randomUUID();
        testOperators.create(operator);
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operator);
        profile.setBusinessName(business);
        profileRepo.save(profile);
        return jwtService.issue(operator, email);
    }

    private static MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private Map<String, Object> payload(String caption) {
        return Map.of("schemaVersion", 1, "activePlatform", "instagram", "draft", Map.of("caption", caption));
    }

    private String body(Object o) throws Exception {
        return objectMapper.writeValueAsString(o);
    }

    private UUID createNamed(String token, String market, String name, String caption) throws Exception {
        MvcResult result = mvc.perform(as(post("/api/content/drafts").param("market", market), token)
                        .content(body(Map.of("name", name, "payload", payload(caption)))))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(json.get("id").asText());
    }

    @Test
    void noAutoSaveYetIs204() throws Exception {
        mvc.perform(as(get("/api/content/drafts/auto").param("market", "japan"), tokenA))
                .andExpect(status().isNoContent());
    }

    @Test
    void autosaveTwiceKeepsOneRowAndTheLatestPayload() throws Exception {
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                        .content(body(Map.of("payload", payload("first")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("auto"));
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                        .content(body(Map.of("payload", payload("second")))))
                .andExpect(status().isOk());

        assertThat(draftRepo.count()).isEqualTo(1);
        mvc.perform(as(get("/api/content/drafts/auto").param("market", "japan"), tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payload.draft.caption").value("second"));
    }

    @Test
    void eachMarketKeepsItsOwnAutoSave() throws Exception {
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                .content(body(Map.of("payload", payload("jp"))))).andExpect(status().isOk());
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "korea"), tokenA)
                .content(body(Map.of("payload", payload("kr"))))).andExpect(status().isOk());

        mvc.perform(as(get("/api/content/drafts/auto").param("market", "korea"), tokenA))
                .andExpect(jsonPath("$.payload.draft.caption").value("kr"));
        mvc.perform(as(get("/api/content/drafts/auto").param("market", "japan"), tokenA))
                .andExpect(jsonPath("$.payload.draft.caption").value("jp"));
    }

    @Test
    void namedDraftLifecycle() throws Exception {
        UUID id = createNamed(tokenA, "japan", "Golden hour", "Sunset swim");

        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Golden hour"))
                .andExpect(jsonPath("$[0].captionPreview").value("Sunset swim"))
                .andExpect(jsonPath("$[0].payload").doesNotExist());

        mvc.perform(as(put("/api/content/drafts/" + id), tokenA).content(body(Map.of("name", "Renamed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.payload.draft.caption").value("Sunset swim"));

        mvc.perform(as(put("/api/content/drafts/" + id), tokenA)
                        .content(body(Map.of("payload", payload("Edited")))))
                .andExpect(jsonPath("$.payload.draft.caption").value("Edited"));

        mvc.perform(as(get("/api/content/drafts/" + id), tokenA)).andExpect(status().isOk());
        mvc.perform(as(delete("/api/content/drafts/" + id), tokenA)).andExpect(status().isNoContent());
        mvc.perform(as(get("/api/content/drafts/" + id), tokenA)).andExpect(status().isNotFound());
    }

    /** A READY image owned by operator A whose stored public_url is from an earlier base URL. */
    private UUID staleImageOfA() {
        MediaAsset asset = new MediaAsset();
        asset.setBusinessProfileId(profileA);
        asset.setKind("image");
        asset.setContentType("image/png");
        asset.setSizeBytes(10);
        asset.setStorageKey("media/" + profileA + "/" + UUID.randomUUID() + ".png");
        asset.setPublicUrl("https://old-host.example/" + asset.getStorageKey());
        asset.setStatus("READY");
        return mediaRepo.save(asset).getMediaId();
    }

    @Test
    void thumbnailFollowsTheCurrentPublicBaseUrlNotTheOneSavedInTheDraft() throws Exception {
        UUID mediaId = staleImageOfA();
        String key = mediaRepo.findById(mediaId).orElseThrow().getStorageKey();
        Map<String, Object> withMedia = new HashMap<>(payload("Stale link"));
        withMedia.put("media", Map.of("kind", "image", "mediaId", mediaId.toString(),
                "publicUrl", "https://old-host.example/" + key));
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Stale", "payload", withMedia))))
                .andExpect(status().isCreated());

        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hasMedia").value(true))
                .andExpect(jsonPath("$[0].mediaUrl").value("http://localhost:8080/" + key));
    }

    @Test
    void aDraftWhoseMediaIsGoneStillCountsAsHavingMediaButShowsNoThumbnail() throws Exception {
        Map<String, Object> withMedia = new HashMap<>(payload("Gone"));
        withMedia.put("media", Map.of("kind", "image", "mediaId", UUID.randomUUID().toString(),
                "publicUrl", "https://old-host.example/media/gone.png"));
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Gone", "payload", withMedia))))
                .andExpect(status().isCreated());

        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenA))
                .andExpect(jsonPath("$[0].hasMedia").value(true))
                .andExpect(jsonPath("$[0].mediaUrl").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void anotherOperatorsMediaIsNeverTurnedIntoAThumbnail() throws Exception {
        UUID aMedia = staleImageOfA();
        Map<String, Object> withMedia = new HashMap<>(payload("Borrowed"));
        withMedia.put("media", Map.of("kind", "image", "mediaId", aMedia.toString(),
                "publicUrl", "https://old-host.example/x.png"));
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenB)
                        .content(body(Map.of("name", "Borrowed", "payload", withMedia))))
                .andExpect(status().isCreated());

        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenB))
                .andExpect(jsonPath("$[0].mediaUrl").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void listTellsWhichDraftsCanBePublishedAsTheyStand() throws Exception {
        UUID readyMedia = staleImageOfA();
        String readyKey = mediaRepo.findById(readyMedia).orElseThrow().getStorageKey();
        Map<String, Object> ready = new HashMap<>(payload("Ready caption"));
        ready.put("media", Map.of("kind", "image", "mediaId", readyMedia.toString(), "publicUrl", "http://localhost:8080/" + readyKey));
        ready.put("audit", Map.of("status", "Pass", "omcsScore", 83.6));
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Ready", "payload", ready))))
                .andExpect(status().isCreated());

        Map<String, Object> video = new HashMap<>(payload("Video caption"));
        video.put("media", Map.of("kind", "video", "mediaId", "m2", "publicUrl", "http://localhost:8080/media/m2.mp4"));
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Video", "payload", video))))
                .andExpect(status().isCreated());
        createNamed(tokenA, "japan", "Bare", "No media");

        MvcResult result = mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenA))
                .andExpect(status().isOk()).andReturn();
        Map<String, JsonNode> byName = new HashMap<>();
        for (JsonNode row : objectMapper.readTree(result.getResponse().getContentAsString())) {
            byName.put(row.get("name").asText(), row);
        }

        JsonNode readyRow = byName.get("Ready");
        assertThat(readyRow.get("hasMedia").asBoolean()).isTrue();
        assertThat(readyRow.get("mediaUrl").asText()).isEqualTo("http://localhost:8080/" + readyKey);
        assertThat(readyRow.get("auditStatus").asText()).isEqualTo("Pass");
        assertThat(readyRow.get("auditScore").asInt()).isEqualTo(84);
        assertThat(readyRow.has("payload")).isFalse();

        // A video has media but no thumbnail an <img> could show, and no audit was saved with it.
        JsonNode videoRow = byName.get("Video");
        assertThat(videoRow.get("hasMedia").asBoolean()).isTrue();
        assertThat(videoRow.get("mediaUrl").isNull()).isTrue();
        assertThat(videoRow.get("auditStatus").isNull()).isTrue();

        JsonNode bareRow = byName.get("Bare");
        assertThat(bareRow.get("hasMedia").asBoolean()).isFalse();
        assertThat(bareRow.get("mediaUrl").isNull()).isTrue();
        assertThat(bareRow.get("auditScore").isNull()).isTrue();
    }

    @Test
    void savingTheSameWorkTwiceKeepsOneDraft() throws Exception {
        UUID first = createNamed(tokenA, "japan", "First save", "Same caption");

        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Second click", "payload", payload("Same caption")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.existing").value(true))
                .andExpect(jsonPath("$.id").value(first.toString()))
                .andExpect(jsonPath("$.name").value("First save"));

        assertThat(draftRepo.count()).isEqualTo(1);
    }

    @Test
    void changedWorkIsANewDraft() throws Exception {
        createNamed(tokenA, "japan", "One", "First caption");

        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Two", "payload", payload("Edited caption")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.existing").value(false));

        assertThat(draftRepo.count()).isEqualTo(2);
    }

    @Test
    void aDuplicateNeitherCountsAgainstNorIsBlockedByTheLimit() throws Exception {
        for (int i = 0; i < 20; i++) createNamed(tokenA, "japan", "Draft " + i, "c" + i);

        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "Again", "payload", payload("c7")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.existing").value(true));

        assertThat(draftRepo.count()).isEqualTo(20);
    }

    @Test
    void anotherOperatorsIdenticalWorkIsNotADuplicate() throws Exception {
        createNamed(tokenA, "japan", "Mine", "Same caption");

        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenB)
                        .content(body(Map.of("name", "Theirs", "payload", payload("Same caption")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.existing").value(false));

        assertThat(draftRepo.count()).isEqualTo(2);
    }

    @Test
    void theSameWorkInAnotherMarketIsNotADuplicate() throws Exception {
        createNamed(tokenA, "japan", "Japan", "Same caption");

        mvc.perform(as(post("/api/content/drafts").param("market", "korea"), tokenA)
                        .content(body(Map.of("name", "Korea", "payload", payload("Same caption")))))
                .andExpect(status().isCreated());

        assertThat(draftRepo.count()).isEqualTo(2);
    }

    @Test
    void autoSaveIsNotInTheNamedList() throws Exception {
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                .content(body(Map.of("payload", payload("x"))))).andExpect(status().isOk());

        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenA))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void anotherOperatorCannotSeeChangeOrDeleteMyDrafts() throws Exception {
        UUID id = createNamed(tokenA, "japan", "Mine", "private caption");
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                .content(body(Map.of("payload", payload("mine"))))).andExpect(status().isOk());

        mvc.perform(as(get("/api/content/drafts/" + id), tokenB)).andExpect(status().isNotFound());
        mvc.perform(as(put("/api/content/drafts/" + id), tokenB).content(body(Map.of("name", "Hijack"))))
                .andExpect(status().isNotFound());
        mvc.perform(as(delete("/api/content/drafts/" + id), tokenB)).andExpect(status().isNotFound());
        mvc.perform(as(get("/api/content/drafts").param("market", "japan"), tokenB))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(as(get("/api/content/drafts/auto").param("market", "japan"), tokenB))
                .andExpect(status().isNoContent());

        // B's own auto-save for the same market neither overwrites nor duplicates A's.
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenB)
                .content(body(Map.of("payload", payload("theirs"))))).andExpect(status().isOk());
        mvc.perform(as(get("/api/content/drafts/auto").param("market", "japan"), tokenA))
                .andExpect(jsonPath("$.payload.draft.caption").value("mine"));
        assertThat(draftRepo.findAll().stream().filter(d -> d.getKind().equals(ContentStudioDraft.KIND_NAMED)))
                .hasSize(1);
        mvc.perform(as(get("/api/content/drafts/" + id), tokenA)).andExpect(status().isOk());
    }

    @Test
    void namedDraftsAreCappedPerMarket() throws Exception {
        for (int i = 0; i < 20; i++) createNamed(tokenA, "japan", "Draft " + i, "c" + i);

        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "One too many", "payload", payload("x")))))
                .andExpect(status().isConflict());
        // The cap is per market.
        createNamed(tokenA, "korea", "Fine", "ok");
    }

    @Test
    void rejectsBadInput() throws Exception {
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content(body(Map.of("name", "   ", "payload", payload("x")))))
                .andExpect(status().isBadRequest());
        mvc.perform(as(post("/api/content/drafts").param("market", "japan"), tokenA)
                        .content("{\"name\":\"ok\",\"payload\":[1,2]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(as(get("/api/content/drafts").param("market", "  "), tokenA))
                .andExpect(status().isBadRequest());
    }

    @Test
    void oversizePayloadIs413() throws Exception {
        String huge = "x".repeat(600 * 1024);
        mvc.perform(as(put("/api/content/drafts/auto").param("market", "japan"), tokenA)
                        .content(body(Map.of("payload", payload(huge)))))
                .andExpect(status().isPayloadTooLarge());
        assertThat(draftRepo.count()).isZero();
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/content/drafts").param("market", "japan")).andExpect(status().isUnauthorized());
    }
}
