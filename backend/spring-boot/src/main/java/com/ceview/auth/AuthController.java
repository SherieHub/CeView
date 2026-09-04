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

    public AuthController(
        MsmeOperatorRepository repo,
        PasswordEncoder encoder,
        JwtService jwt,
        Optional<FirebaseAuth> firebaseAuth,
        CurrentOperator currentOperator
    ) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
        this.firebaseAuth = firebaseAuth;
        this.currentOperator = currentOperator;
    }

    public record RegisterRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @Email String email,
        @NotBlank String password,
        @NotBlank String contactNumber
    ) {}

    public record LoginRequest(@Email String email, @NotBlank String password) {}

    public record GoogleAuthRequest(@NotBlank String idToken, @NotBlank String intent) {}

    public record CompleteProfileRequest(@NotBlank String contactNumber) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody @Valid RegisterRequest req) {
        if (repo.findByEmail(req.email()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "email already registered"));
        }
        var op = new MsmeOperator();
        op.setFirstName(req.firstName());
        op.setLastName(req.lastName());
        op.setEmail(req.email());
        op.setPasswordHash(encoder.encode(req.password()));
        op.setContactNumber(req.contactNumber());
        repo.save(op);
        return sessionResponse(op);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest req) {
        return repo.findByEmail(req.email())
            .filter(o -> encoder.matches(req.password(), o.getPasswordHash()))
            .map(this::sessionResponse)
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
            } else {
                o = new MsmeOperator();
                String[] names = splitDisplayName(decoded.getName(), email);
                o.setFirstName(names[0]);
                o.setLastName(names[1]);
                o.setEmail(email);
                o.setGoogleUid(googleUid);
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

    private ResponseEntity<?> sessionResponse(MsmeOperator op) {
        return ResponseEntity.ok(Map.of(
            "operatorId", op.getOperatorId(),
            "token", jwt.issue(op.getOperatorId(), op.getEmail()),
            "profileCompleted", op.isProfileCompleted()
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
