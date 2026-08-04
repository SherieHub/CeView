package com.ceview.auth;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Standalone unit coverage for {@link CurrentBusinessProfile}, mirroring
 * {@link CurrentOperatorTest} — this is shared infrastructure that Module 2/3/4
 * controllers reuse identically, so its 409 "no business profile yet" path
 * (previously untested anywhere in the suite) and its 403 cross-operator
 * rejection are pinned down here rather than only indirectly via each
 * controller's own MockMvc tests.
 */
class CurrentBusinessProfileTest {

    private final CurrentOperator currentOperator = new CurrentOperator();
    private final BusinessProfileRepository businessProfileRepository = mock(BusinessProfileRepository.class);
    private final CurrentBusinessProfile currentBusinessProfile =
            new CurrentBusinessProfile(currentOperator, businessProfileRepository);

    private UUID operatorId;

    @BeforeEach
    void authenticate() {
        operatorId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void resolveProfileIdReturnsTheOperatorsProfileIdWhenOneExists() {
        UUID profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessProfileId(profileId);
        when(businessProfileRepository.findFirstByUserId(operatorId)).thenReturn(Optional.of(profile));

        assertEquals(profileId, currentBusinessProfile.resolveProfileId());
    }

    @Test
    void resolveProfileIdThrows409WhenOperatorHasNoBusinessProfile() {
        when(businessProfileRepository.findFirstByUserId(operatorId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                currentBusinessProfile::resolveProfileId);
        assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void resolveOrValidateWithNullDerivesTheCallersOwnProfileId() {
        UUID profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessProfileId(profileId);
        when(businessProfileRepository.findFirstByUserId(operatorId)).thenReturn(Optional.of(profile));

        assertEquals(profileId, currentBusinessProfile.resolveOrValidate(null));
    }

    @Test
    void resolveOrValidateWithOwnProfileIdSucceeds() {
        UUID profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessProfileId(profileId);
        when(businessProfileRepository.findFirstByUserId(operatorId)).thenReturn(Optional.of(profile));

        assertEquals(profileId, currentBusinessProfile.resolveOrValidate(profileId));
    }

    @Test
    void resolveOrValidateWithAnotherOperatorsProfileIdThrows403() {
        UUID ownProfileId = UUID.randomUUID();
        UUID someoneElsesProfileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessProfileId(ownProfileId);
        when(businessProfileRepository.findFirstByUserId(operatorId)).thenReturn(Optional.of(profile));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> currentBusinessProfile.resolveOrValidate(someoneElsesProfileId));
        assertEquals(403, ex.getStatusCode().value());
    }
}
