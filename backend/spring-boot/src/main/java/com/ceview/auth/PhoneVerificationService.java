package com.ceview.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Resolves the contact number to store for an operator. When Firebase is configured, the number
 * must come from the {@code phone_number} claim of a Firebase ID token (i.e. Google already
 * SMS-verified it) — a client-typed number is never trusted. When Firebase is not configured
 * (local H2, CI, e2e) the raw number is accepted as before, unverified.
 */
@Service
public class PhoneVerificationService {

    /** The number to persist, and whether it was verified via Firebase. */
    public record Resolved(String contactNumber, boolean verified) {}

    private final Optional<FirebaseAuth> firebaseAuth;

    public PhoneVerificationService(Optional<FirebaseAuth> firebaseAuth) {
        this.firebaseAuth = firebaseAuth;
    }

    /** Loose sanity check for unverified numbers: 7-20 chars of digits and common separators. */
    private static final java.util.regex.Pattern LOOSE_PHONE = java.util.regex.Pattern.compile("^\\+?[0-9 ()-]{7,20}$");

    /**
     * @param verifyLater the client could not send an SMS (quota, region, outage) and the user
     *                    chose to verify later: accept the typed number, recorded as unverified.
     *                    Ignored when a {@code phoneIdToken} is supplied.
     */
    public Resolved resolve(String phoneIdToken, String rawContactNumber, boolean verifyLater) {
        if (firebaseAuth.isEmpty()) {
            if (rawContactNumber == null || rawContactNumber.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contactNumber is required");
            }
            return new Resolved(rawContactNumber, false);
        }

        if (phoneIdToken == null || phoneIdToken.isBlank()) {
            if (verifyLater && rawContactNumber != null && LOOSE_PHONE.matcher(rawContactNumber.trim()).matches()) {
                return new Resolved(rawContactNumber.trim(), false);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "phone verification required");
        }
        FirebaseToken decoded;
        try {
            decoded = firebaseAuth.get().verifyIdToken(phoneIdToken);
        } catch (FirebaseAuthException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid phone verification");
        }
        Object phone = decoded.getClaims().get("phone_number");
        if (!(phone instanceof String s) || s.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "token has no verified phone number");
        }
        return new Resolved(s, true);
    }
}
