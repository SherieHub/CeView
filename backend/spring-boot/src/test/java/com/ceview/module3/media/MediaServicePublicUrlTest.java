package com.ceview.module3.media;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MediaServicePublicUrlTest {

    private static MediaAsset asset(String storedUrl) {
        MediaAsset a = new MediaAsset();
        a.setMediaId(UUID.randomUUID());
        a.setStorageKey("media/tenant/file.jpg");
        a.setPublicUrl(storedUrl);
        return a;
    }

    private static MediaService serviceFor(String base) {
        return new MediaService(mock(MediaAssetRepository.class), mock(MediaStorage.class), base);
    }

    @Test
    void publicUrlFollowsTheCurrentBaseNotTheOneStoredAtUpload() {
        MediaAsset staleAsset = asset("https://ceview.online/media/tenant/file.jpg");

        assertThat(serviceFor("https://dev.ngrok-free.dev").publicUrlOf(staleAsset))
                .isEqualTo("https://dev.ngrok-free.dev/media/tenant/file.jpg");
    }

    @Test
    void trailingSlashOnTheBaseIsIgnored() {
        assertThat(serviceFor("https://ceview.online/").publicUrlOf(asset(null)))
                .isEqualTo("https://ceview.online/media/tenant/file.jpg");
    }

    @Test
    void uploadStoresTheSameUrlPublicUrlOfReturns() {
        MediaAssetRepository repo = mock(MediaAssetRepository.class);
        org.mockito.Mockito.when(repo.save(org.mockito.ArgumentMatchers.any(MediaAsset.class)))
                .thenAnswer(i -> i.getArgument(0));
        MediaService service = new MediaService(repo, mock(MediaStorage.class), "https://ceview.online");

        MediaAsset created = service.requestUpload(UUID.randomUUID(), "image/jpeg", 10);

        assertThat(created.getPublicUrl()).isEqualTo(service.publicUrlOf(created));
    }
}
