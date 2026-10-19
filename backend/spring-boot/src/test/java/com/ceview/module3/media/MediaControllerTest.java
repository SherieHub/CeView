package com.ceview.module3.media;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.testsupport.TestOperators;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayInputStream;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class MediaControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private MediaAssetRepository mediaRepo;
    @Autowired private MediaService mediaService;
    @Autowired private LocalMediaStorage storage;
    @Autowired private TestOperators testOperators;

    private record Tenant(String token, UUID profileId) {}

    private Tenant a;
    private Tenant b;

    @BeforeEach
    void setUp() {
        mediaRepo.deleteAll();
        profileRepo.deleteAll();
        a = tenant("Cebu Dive Co.");
        b = tenant("Mactan Cafe");
    }

    private Tenant tenant(String businessName) {
        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName(businessName);
        UUID profileId = profileRepo.save(profile).getBusinessProfileId();
        return new Tenant(jwtService.issue(operatorId, operatorId + "@example.com"), profileId);
    }

    private static String bearer(Tenant t) {
        return "Bearer " + t.token();
    }

    private static String uploadBody(String contentType, long sizeBytes) {
        return "{\"contentType\":\"" + contentType + "\",\"sizeBytes\":" + sizeBytes + "}";
    }

    @Test
    void issuesAnUploadSlotScopedToTheTenant() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 1024)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("image"))
                .andExpect(jsonPath("$.uploadUrl").value(startsWith("/api/media/local/")))
                .andExpect(jsonPath("$.publicUrl")
                        .value(startsWith("http://localhost:8080/media/" + a.profileId() + "/")));

        assertThat(mediaRepo.findAll()).singleElement().satisfies(asset -> {
            assertThat(asset.getBusinessProfileId()).isEqualTo(a.profileId());
            assertThat(asset.getStatus()).isEqualTo(MediaAsset.STATUS_PENDING);
        });
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(post("/api/media/uploads")
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 1024)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAnUnsupportedType() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("application/pdf", 1024)))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void rejectsAnImageOverTheLimit() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(uploadBody("image/png", MediaPolicy.MAX_IMAGE_BYTES + 1)))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void acceptsALargeVideo() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(uploadBody("video/mp4", MediaPolicy.MAX_IMAGE_BYTES + 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("video"));
    }

    @Test
    void rejectsAnEmptyFile() throws Exception {
        mvc.perform(post("/api/media/uploads").header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content(uploadBody("image/jpeg", 0)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void completeBeforeTheFileIsStoredIsAConflict() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());
    }

    @Test
    void completeMarksTheAssetReadyWithTheRealSizeAndDimensions() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"width\":800,\"height\":600}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.sizeBytes").value(4))
                .andExpect(jsonPath("$.width").value(800))
                .andExpect(jsonPath("$.height").value(600))
                .andExpect(jsonPath("$.publicUrl").value(asset.getPublicUrl()));
    }

    @Test
    void completeWithoutABodyStillWorks() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/png", 2);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void completeRejectsAndDeletesAFileLargerThanThePolicyAllows() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(),
                new ByteArrayInputStream(new byte[(int) MediaPolicy.MAX_IMAGE_BYTES + 1]), Long.MAX_VALUE);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isPayloadTooLarge());

        assertThat(storage.sizeOf(asset.getStorageKey())).isEmpty();
        assertThat(mediaRepo.findById(asset.getMediaId())).isEmpty();
    }

    @Test
    void completeRejectsAndDeletesAFileWhoseSizeDiffersFromTheDeclaredOne() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4, 5, 6}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict());

        assertThat(storage.sizeOf(asset.getStorageKey())).isEmpty();
        assertThat(mediaRepo.findById(asset.getMediaId())).isEmpty();
    }

    @Test
    void completingAnAlreadyReadyAssetIsIdempotentAndKeepsTheFirstDimensions() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"width\":800,\"height\":600}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(a))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"width\":1,\"height\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.width").value(800))
                .andExpect(jsonPath("$.height").value(600));
    }

    @Test
    void anotherTenantCannotCompleteMyUpload() throws Exception {
        MediaAsset asset = mediaService.requestUpload(a.profileId(), "image/jpeg", 4);
        storage.write(asset.getStorageKey(), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 100);

        mvc.perform(post("/api/media/" + asset.getMediaId() + "/complete")
                        .header("Authorization", bearer(b))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
    }
}
