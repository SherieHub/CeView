package com.ceview.auth;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Resolves the {@code business_profile_id} that belongs to the currently-authenticated
 * operator, so Module 2/3/4 controllers can scope reads/writes to "my own data" instead
 * of trusting a client-supplied {@code profileId} query/path param.
 *
 * <p>Mirrors {@link CurrentOperator}'s role one layer up: {@code CurrentOperator} turns
 * the JWT into an operator UUID, this turns that operator UUID into their business
 * profile UUID (each operator has at most one profile today — see
 * {@link BusinessProfileRepository#findFirstByUserId}).
 */
@Component
public class CurrentBusinessProfile {

    private final CurrentOperator currentOperator;
    private final BusinessProfileRepository businessProfileRepository;

    public CurrentBusinessProfile(CurrentOperator currentOperator,
                                   BusinessProfileRepository businessProfileRepository) {
        this.currentOperator = currentOperator;
        this.businessProfileRepository = businessProfileRepository;
    }

    /**
     * @return the authenticated operator's business profile id.
     * @throws ResponseStatusException 401 (via {@link CurrentOperator}) if there's no
     *         authenticated operator, or 409 if the operator hasn't created a business
     *         profile yet — mirrors the "profile not ready" 409 convention already used
     *         by {@code ForecastingController.ensure()} for the same underlying condition.
     */
    public UUID resolveProfileId() {
        UUID operatorId = currentOperator.resolve();
        return businessProfileRepository.findFirstByUserId(operatorId)
                .map(BusinessProfile::getBusinessProfileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "operator " + operatorId + " has no business profile yet"));
    }

    /**
     * Derives the caller's own profile id when the client omitted one (null), or —
     * when the client supplied one — validates it against the id resolved from the JWT.
     * A mismatch means the client is trying to read/act on another operator's profile,
     * which is rejected outright rather than silently substituted.
     *
     * @throws ResponseStatusException 403 if {@code suppliedProfileId} doesn't belong
     *         to the authenticated operator; 409/401 per {@link #resolveProfileId()}.
     */
    public UUID resolveOrValidate(UUID suppliedProfileId) {
        UUID resolved = resolveProfileId();
        if (suppliedProfileId != null && !suppliedProfileId.equals(resolved)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "profileId does not belong to the authenticated operator");
        }
        return resolved;
    }
}
