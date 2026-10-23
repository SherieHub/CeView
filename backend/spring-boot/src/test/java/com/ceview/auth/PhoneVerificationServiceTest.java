package com.ceview.auth;

import com.google.firebase.auth.FirebaseAuth;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * SMS verification is a switch separate from Firebase itself: Firebase stays configured for
 * Google sign-in, but phone codes need the paid Blaze plan, so they are off unless enabled.
 */
class PhoneVerificationServiceTest {

    private final FirebaseAuth firebase = mock(FirebaseAuth.class);

    @Test
    void switchedOffAcceptsTheTypedNumberAsUnverifiedEvenWithFirebaseConfigured() {
        var service = new PhoneVerificationService(Optional.of(firebase), false);

        var resolved = service.resolve(null, "+639171234567", false);

        assertThat(resolved.contactNumber()).isEqualTo("+639171234567");
        assertThat(resolved.verified()).isFalse();
        verifyNoInteractions(firebase);
    }

    @Test
    void switchedOffStillRequiresANumber() {
        var service = new PhoneVerificationService(Optional.of(firebase), false);

        assertThatThrownBy(() -> service.resolve(null, " ", false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("contactNumber is required");
    }

    @Test
    void switchedOnWithFirebaseStillRequiresAVerifiedNumber() {
        var service = new PhoneVerificationService(Optional.of(firebase), true);

        assertThatThrownBy(() -> service.resolve(null, "+639171234567", false))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("phone verification required");
    }

    @Test
    void switchedOnWithoutFirebaseFallsBackToTheTypedNumber() {
        var service = new PhoneVerificationService(Optional.empty(), true);

        var resolved = service.resolve(null, "+639171234567", false);

        assertThat(resolved.verified()).isFalse();
    }
}
