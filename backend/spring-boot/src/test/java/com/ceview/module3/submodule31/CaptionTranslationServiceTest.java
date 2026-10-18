package com.ceview.module3.submodule31;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CaptionTranslationServiceTest {

    private final AIInferenceGatewayService ai = mock(AIInferenceGatewayService.class);
    private final CurrentBusinessProfile current = mock(CurrentBusinessProfile.class);
    private final BusinessProfileRepository repo = mock(BusinessProfileRepository.class);
    private final CaptionTranslationService service = new CaptionTranslationService(ai, current, repo);

    private void withProfile() {
        UUID id = UUID.randomUUID();
        BusinessProfile p = new BusinessProfile();
        p.setBusinessName("Blue Reef Divers");
        when(current.resolveProfileId()).thenReturn(id);
        when(repo.findById(id)).thenReturn(Optional.of(p));
    }

    @Test
    @SuppressWarnings("unchecked")
    void translateSendsSnakeCasePayloadWithTheCallersBusinessName() {
        withProfile();
        when(ai.translateCaption(anyMap())).thenReturn(
                Map.of("caption_en", "Healing trip", "source_language", "ko", "source", "groq"));

        var dto = service.translate("세부 힐링여행", "tiktok");

        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(ai).translateCaption(sent.capture());
        assertThat(sent.getValue()).containsEntry("caption", "세부 힐링여행")
                .containsEntry("platform", "tiktok")
                .containsEntry("business_name", "Blue Reef Divers");
        assertThat(dto.captionEn()).isEqualTo("Healing trip");
        assertThat(dto.sourceLanguage()).isEqualTo("ko");
    }

    @Test
    void blankTranslationIsABadGateway() {
        withProfile();
        when(ai.translateCaption(anyMap())).thenReturn(Map.of("caption_en", " "));

        assertThatThrownBy(() -> service.translate("세부", "instagram"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("MOD31_TRANSLATION_FAILED");
    }

    @Test
    @SuppressWarnings("unchecked")
    void localizeMapsTheNativeCaptionAndForwardsTheOriginal() {
        withProfile();
        when(ai.localizeCaption(anyMap())).thenReturn(
                Map.of("caption", "세부 힐링", "caption_en", "Cebu healing"));

        var dto = service.localize("Cebu healing", "ko", "instagram", "세부");

        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(ai).localizeCaption(sent.capture());
        assertThat(sent.getValue()).containsEntry("target_language", "ko")
                .containsEntry("original_caption", "세부");
        assertThat(dto.caption()).isEqualTo("세부 힐링");
        assertThat(dto.captionEn()).isEqualTo("Cebu healing");
    }
}
