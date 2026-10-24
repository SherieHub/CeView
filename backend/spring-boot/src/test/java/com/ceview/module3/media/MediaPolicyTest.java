package com.ceview.module3.media;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaPolicyTest {

    @Test
    void acceptsJpegPngAndWebpAsImages() {
        for (String type : new String[] {"image/jpeg", "image/png", "image/webp"}) {
            assertThat(MediaPolicy.ruleFor(type)).hasValueSatisfying(rule -> {
                assertThat(rule.kind()).isEqualTo(MediaPolicy.KIND_IMAGE);
                assertThat(rule.maxBytes()).isEqualTo(MediaPolicy.MAX_IMAGE_BYTES);
            });
        }
    }

    @Test
    void acceptsMp4AndQuickTimeAsVideos() {
        assertThat(MediaPolicy.ruleFor("video/mp4")).hasValueSatisfying(rule -> {
            assertThat(rule.kind()).isEqualTo(MediaPolicy.KIND_VIDEO);
            assertThat(rule.extension()).isEqualTo("mp4");
        });
        assertThat(MediaPolicy.ruleFor("video/quicktime"))
                .hasValueSatisfying(rule -> assertThat(rule.extension()).isEqualTo("mov"));
    }

    @Test
    void rejectsAnythingElse() {
        assertThat(MediaPolicy.ruleFor("image/gif")).isEmpty();
        assertThat(MediaPolicy.ruleFor("application/pdf")).isEmpty();
        assertThat(MediaPolicy.ruleFor("")).isEmpty();
        assertThat(MediaPolicy.ruleFor(null)).isEmpty();
    }

    @Test
    void contentTypeLookupIgnoresCase() {
        assertThat(MediaPolicy.ruleFor("IMAGE/JPEG")).isPresent();
    }

    @Test
    void videosMayBeLargerThanImages() {
        assertThat(MediaPolicy.MAX_VIDEO_BYTES).isGreaterThan(MediaPolicy.MAX_IMAGE_BYTES);
    }
}
