package com.ceview.module4.adconnections;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The TikTok creator login (module3) reuses the OAuth state table under its own key. */
@SpringBootTest
class AdConnectionServiceProviderKeyTest {

    @Autowired private AdConnectionService service;

    @Test
    void aStateMintedForAKeyIsConsumedOnceForThatKey() {
        UUID profile = UUID.randomUUID();
        UUID state = service.mintState(profile, "tiktok_creator");

        assertThat(service.consumeState(state, "tiktok_creator")).isEqualTo(profile);
        assertThatThrownBy(() -> service.consumeState(state, "tiktok_creator"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already used");
    }

    @Test
    void aStateCannotBeConsumedForADifferentKey() {
        UUID state = service.mintState(UUID.randomUUID(), "tiktok_creator");

        assertThatThrownBy(() -> service.consumeState(state, "meta"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("different provider");
    }

    @Test
    void theEnumOverloadsStillWork() {
        UUID profile = UUID.randomUUID();
        UUID state = service.mintState(profile, AdProvider.META);

        assertThat(service.consumeState(state, AdProvider.META)).isEqualTo(profile);
    }

    @Test
    void onlyAllowListedKeysCanMintAState() {
        UUID profile = UUID.randomUUID();

        assertThat(service.mintState(profile, "tiktok")).isNotNull();
        assertThatThrownBy(() -> service.mintState(profile, "myspace"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.mintState(profile, ""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.mintState(profile, (String) null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
