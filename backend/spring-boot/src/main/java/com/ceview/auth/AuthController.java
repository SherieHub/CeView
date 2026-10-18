package com.ceview.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final MsmeOperatorRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final Optional<FirebaseAuth> firebaseAuth;
    private final CurrentOperator currentOperator;
    private final EmailCodeService emailCodes;

    public AuthController(
        MsmeOperatorRepository repo,
        PasswordEncoder encoder,
        JwtService jwt,
        Optional<FirebaseAuth> firebaseAuth,
        CurrentOperator currentOperator,
        EmailCodeService emailCodes
    ) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.firebaseAuth = firebaseAuth;
        this.currentOperator = currentOperator;
        this.emailCodes = emailCodes;
    }

    public record RegisterRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        @NotBlank String password,
        @NotBlank String contactNumber
    ) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record GoogleAuthRequest(@NotBlank String idToken, @NotBlank String intent) {}

    public record CompleteProfileRequest(@NotBlank String contactNumber) {}

    public record VerifyCodeRequest(@NotBlank String code) {}

    public record ChangeEmailRequest(@NotBlank @Email String email) {}

    public record PasswordResetRequest(@NotBlank @Email String email) {}

    public record PasswordResetConfirmRequest(
        @NotBlank @Email String email,
        @NotBlank String code,
        @NotBlank String newPassword
    ) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest req) {
        PasswordPolicy.require(req.password());

        Optional<MsmeOperator> existing = repo.findByEmail(req.email());
        if (existing.isPresent()) {
            if (!isTakeoverEligible(existing.get())) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "email already registered",
                    "code", "EMAIL_TAKEN"));
            }
            // A sign-up that never verified: whoever typed the address may not own it, and the
            // real owner must not be locked out. Unverified accounts cannot reach any data route,
            // so deleting one loses nothing; its old JWT 401s because the operator row is gone.
            emailCodes.discardAll(existing.get().getOperatorId());
            repo.delete(existing.get());
        }

        var op = new MsmeOperator();
        op.setFirstName(req.firstName());
        op.setLastName(req.lastName());
        op.setEmail(req.email());
        op.setPasswordHash(encoder.encode(req.password()));
        op.setContactNumber(req.contactNumber());
        repo.save(op);

        try {
            emailCodes.issue(op, EmailCode.Purpose.VERIFY_EMAIL);
        } catch (AuthFlowException ignored) {
            // Sign-up itself succeeded; the verify page will let the user request the code again.
        }
        return sessionResponse(op);
    }

    /**
     * An existing row may be replaced by a new registration only if it is a password account that
     * never verified and was created after email verification shipped. Accounts that predate the
     * feature may hold real data, and Google accounts are verified by Google.
     */
    private static boolean isTakeoverEligible(MsmeOperator op) {
        return !op.isEmailVerified()
            && !op.isCreatedBeforeVerification()
            && op.getGoogleUid() == null
            && op.getPasswordHash() != null;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest req) {
        return repo.findByEmail(req.email())
            .filter(o -> o.getPasswordHash() != null && encoder.matches(req.password(), o.getPasswordHash()))
            .<ResponseEntity<?>>map(this::sessionResponse)
            .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "invalid credentials")));
    }

    /**
     * Verifies a Firebase ID token (obtained client-side after a Google sign-in) and either
     * links it to an existing operator matched by verified email, or provisions a brand-new
     * operator from the Google profile. Either way, ends by minting the same CeView JWT that
     * /register and /login produce — nothing downstream of that point knows or cares how the
     * session was established.
     *
     * <p>{@code req.intent()} ("login" or "register", matching the frontend's active tab) gates
     * which of those outcomes is allowed: "register" rejects with 409 if this Google account is
     * already linked to an operator, and "login" rejects with 404 if no operator matches by
     * either Google UID or verified email — see the intent branching below.
     *
     * <p>Google has already proven ownership of the address ({@code email_verified}), so this
     * path also marks the operator's email verified with no code. When that links an existing
     * <em>unverified</em> password account, the password is cleared: whoever set it may never have
     * owned the address, and only the real owner (via Google) should get in afterwards.
     */
    @PostMapping("/google")
    public ResponseEntity<?> google(@RequestBody @Valid GoogleAuthRequest req) {
        if (!"login".equals(req.intent()) && !"register".equals(req.intent())) {
            return ResponseEntity.badRequest().body(Map.of("error", "invalid intent"));
        }

        if (firebaseAuth.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "Google sign-in is not configured"));
        }

        FirebaseToken decoded;
        try {
            decoded = firebaseAuth.get().verifyIdToken(req.idToken());
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(401).body(Map.of("error", "invalid Google credential"));
        }

        String googleUid = decoded.getUid();
        String email = decoded.getEmail();
        boolean isRegister = "register".equals(req.intent());

        Optional<MsmeOperator> byGoogleUid = repo.findByGoogleUid(googleUid);

        if (isRegister && byGoogleUid.isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "google_account_already_registered",
                "message", "This Google account is already registered. Please sign in instead."
            ));
        }

        MsmeOperator op;
        if (byGoogleUid.isPresent()) {
            op = byGoogleUid.get();
            if (decoded.isEmailVerified() && !op.isEmailVerified()
                    && email != null && email.equalsIgnoreCase(op.getEmail())) {
                op.setEmailVerifiedAt(OffsetDateTime.now());
                op = repo.save(op);
            }
        } else {
            Optional<MsmeOperator> byEmail = (decoded.isEmailVerified() && email != null)
                ? repo.findByEmail(email)
                : Optional.empty();

            if (!isRegister && byEmail.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "google_account_not_registered",
                    "message", "No account found for this Google account. Please create an account first."
                ));
            }

            MsmeOperator o;
            if (byEmail.isPresent()) {
                o = byEmail.get();
                o.setGoogleUid(googleUid);
                if (!o.isEmailVerified()) {
                    o.setEmailVerifiedAt(OffsetDateTime.now());
                    o.setPasswordHash(null);
                }
            } else {
                o = new MsmeOperator();
                String[] names = splitDisplayName(decoded.getName(), email);
                o.setFirstName(names[0]);
                o.setLastName(names[1]);
                o.setEmail(email);
                o.setGoogleUid(googleUid);
                if (decoded.isEmailVerified()) {
                    o.setEmailVerifiedAt(OffsetDateTime.now());
                }
                // passwordHash and contactNumber are left null — the frontend routes this
                // operator through the "complete your profile" step (see profileCompleted below).
            }
            op = repo.save(o);
        }

        return sessionResponse(op);
    }

    /**
     * The one-time "complete your profile" step: fills in the contactNumber that a
     * Google-provisioned operator (or any other account missing it) still needs, after
     * which {@link ProfileCompletionFilter} stops blocking their other requests.
     */
    @PatchMapping("/profile")
    public ResponseEntity<?> completeProfile(@RequestBody @Valid CompleteProfileRequest req) {
        UUID operatorId = currentOperator.resolve();
        MsmeOperator op = repo.findById(operatorId)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                HttpStatus.NOT_FOUND, "operator not found"));
        op.setContactNumber(req.contactNumber());
        repo.save(op);
        return ResponseEntity.ok(Map.of("profileCompleted", op.isProfileCompleted()));
    }

    // ---- email verification (authenticated; allowed while unverified) ----

    /** Emails a fresh code to the signed-in operator's address. */
    @PostMapping("/email-verification/send")
    public ResponseEntity<?> sendVerificationCode() {
        MsmeOperator op = currentOp();
        if (op.isEmailVerified()) {
            throw new AuthFlowException(409, "ALREADY_VERIFIED", "Your email is already verified.");
        }
        emailCodes.issue(op, EmailCode.Purpose.VERIFY_EMAIL);
        return ResponseEntity.accepted().body(codeSentBody(op));
    }

    @PostMapping("/email-verification/verify")
    public ResponseEntity<?> verifyEmail(@RequestBody @Valid VerifyCodeRequest req) {
        MsmeOperator op = currentOp();
        if (!op.isEmailVerified()) {
            emailCodes.verify(op, EmailCode.Purpose.VERIFY_EMAIL, req.code());
            op.setEmailVerifiedAt(OffsetDateTime.now());
            repo.save(op);
        }
        return ResponseEntity.ok(Map.of("emailVerified", true));
    }

    /**
     * Fixes a mistyped address from the verify screen. Only while unverified, and never onto an
     * address another account already uses. Codes sent to the old address are discarded and a new
     * one goes to the new address immediately.
     */
    @PatchMapping("/email")
    public ResponseEntity<?> changeEmail(@RequestBody @Valid ChangeEmailRequest req) {
        MsmeOperator op = currentOp();
        if (op.isEmailVerified()) {
            throw new AuthFlowException(409, "ALREADY_VERIFIED", "A verified email can no longer be changed here.");
        }
        String newEmail = req.email().trim();
        if (newEmail.equalsIgnoreCase(op.getEmail())) {
            throw new AuthFlowException(400, "SAME_EMAIL", "That is already your email address.");
        }
        if (repo.findByEmail(newEmail).isPresent()) {
            throw new AuthFlowException(400, "EMAIL_TAKEN", "That email is already in use.");
        }
        op.setEmail(newEmail);
        repo.save(op);
        emailCodes.invalidateAll(op.getOperatorId());
        emailCodes.issueIgnoringCooldown(op, EmailCode.Purpose.VERIFY_EMAIL);
        return ResponseEntity.ok(Map.of("email", op.getEmail()));
    }

    // ---- password reset (public) ----

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(@RequestBody @Valid PasswordResetRequest req) {
        MsmeOperator op = repo.findByEmail(req.email())
            .orElseThrow(() -> new AuthFlowException(404, "ACCOUNT_NOT_FOUND", "No account found with that email."));
        requireResettable(op);
        emailCodes.issue(op, EmailCode.Purpose.RESET_PASSWORD);
        return ResponseEntity.accepted().body(codeSentBody(op));
    }

    /**
     * Completes a reset: the emailed code proves ownership, so the password is replaced, the email
     * is marked verified, and the caller is signed straight in.
     */
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@RequestBody @Valid PasswordResetConfirmRequest req) {
        PasswordPolicy.require(req.newPassword());
        MsmeOperator op = repo.findByEmail(req.email())
            .orElseThrow(() -> new AuthFlowException(404, "ACCOUNT_NOT_FOUND", "No account found with that email."));
        requireResettable(op);
        emailCodes.verify(op, EmailCode.Purpose.RESET_PASSWORD, req.code());
        op.setPasswordHash(encoder.encode(req.newPassword()));
        if (!op.isEmailVerified()) {
            op.setEmailVerifiedAt(OffsetDateTime.now());
        }
        repo.save(op);
        return sessionResponse(op);
    }

    private static void requireResettable(MsmeOperator op) {
        if (op.getPasswordHash() == null) {
            throw new AuthFlowException(409, "GOOGLE_ACCOUNT",
                "This account uses Google sign-in. Use Continue with Google instead.");
        }
    }

    private MsmeOperator currentOp() {
        UUID operatorId = currentOperator.resolve();
        return repo.findById(operatorId)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                HttpStatus.NOT_FOUND, "operator not found"));
    }

    private Map<String, Object> codeSentBody(MsmeOperator op) {
        return Map.of(
            "sentTo", op.getEmail(),
            "resendAvailableInSeconds", emailCodes.resendCooldown().toSeconds());
    }

    /** Renders {@link AuthFlowException} as {@code {error, code, ...details}} with its status. */
    @ExceptionHandler(AuthFlowException.class)
    public ResponseEntity<?> authFlow(AuthFlowException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        body.put("code", e.code());
        body.putAll(e.details());
        ResponseEntity.BodyBuilder response = ResponseEntity.status(e.status());
        if (e.details().get("retryAfterSeconds") instanceof Number seconds) {
            response.header("Retry-After", String.valueOf(seconds.longValue()));
        }
        return response.body(body);
    }

    private ResponseEntity<?> sessionResponse(MsmeOperator op) {
        return ResponseEntity.ok(Map.of(
            "operatorId", op.getOperatorId(),
            "token", jwt.issue(op.getOperatorId(), op.getEmail()),
            "profileCompleted", op.isProfileCompleted(),
            "emailVerified", op.isEmailVerified()
        ));
    }

    static String[] splitDisplayName(String name, String email) {
        if (name != null && !name.isBlank()) {
            String trimmed = name.trim();
            int sp = trimmed.indexOf(' ');
            if (sp < 0) return new String[]{trimmed, ""};
            return new String[]{trimmed.substring(0, sp), trimmed.substring(sp + 1).trim()};
        }
        String local = (email != null && email.contains("@")) ? email.substring(0, email.indexOf('@')) : "Google";
        return new String[]{local, "User"};
    }
}
