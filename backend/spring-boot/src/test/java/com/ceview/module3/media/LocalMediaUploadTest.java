package com.ceview.module3.media;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The dev-only upload target: no JWT, the unguessable media id is the credential. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class LocalMediaUploadTest {

    @Autowired private MockMvc mvc;
    @Autowired private MediaService mediaService;
    @Autowired private MediaAssetRepository mediaRepo;
    @Autowired private LocalMediaStorage storage;

    private static final byte[] PNG_BYTES = {(byte) 0x89, 'P', 'N', 'G'};

    @BeforeEach
    void setUp() {
        mediaRepo.deleteAll();
    }

    private MediaAsset pendingPng() {
        return mediaService.requestUpload(UUID.randomUUID(), "image/png", PNG_BYTES.length);
    }

    @Test
    void storesTheBytesWithoutAJwt() throws Exception {
        MediaAsset asset = pendingPng();

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNoContent());

        assertThat(storage.sizeOf(asset.getStorageKey())).hasValue(PNG_BYTES.length);
    }

    @Test
    void servesTheStoredFileAtItsPublicPath() throws Exception {
        MediaAsset asset = pendingPng();
        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                .contentType("image/png").content(PNG_BYTES)).andExpect(status().isNoContent());

        mvc.perform(get("/" + asset.getStorageKey()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(PNG_BYTES));
    }

    @Test
    void rejectsAContentTypeThatDiffersFromTheDeclaredOne() throws Exception {
        MediaAsset asset = pendingPng();

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/jpeg").content(PNG_BYTES))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void rejectsAnUnknownMediaId() throws Exception {
        mvc.perform(put("/api/media/local/" + UUID.randomUUID())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }

    @Test
    void refusesToOverwriteAnAssetAlreadyMarkedReady() throws Exception {
        MediaAsset asset = pendingPng();
        asset.setStatus(MediaAsset.STATUS_READY);
        mediaRepo.save(asset);

        mvc.perform(put("/api/media/local/" + asset.getMediaId())
                        .contentType("image/png").content(PNG_BYTES))
                .andExpect(status().isNotFound());
    }
}
