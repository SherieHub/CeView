package com.ceview.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final MsmeOperatorRepository repo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(MsmeOperatorRepository repo, PasswordEncoder encoder, JwtService jwt) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record RegisterRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @Email String email,
        @NotBlank String password,
        String contactNumber
    ) {}

    public record LoginRequest(@Email String email, @NotBlank String password) {}

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
        return ResponseEntity.ok(Map.of(
            "operatorId", op.getOperatorId(),
            "token", jwt.issue(op.getOperatorId(), op.getEmail())
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequest req) {
        return repo.findByEmail(req.email())
            .filter(o -> encoder.matches(req.password(), o.getPasswordHash()))
            .map(o -> ResponseEntity.ok((Object) Map.of(
                "operatorId", o.getOperatorId(),
                "token", jwt.issue(o.getOperatorId(), o.getEmail())
            )))
            .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "invalid credentials")));
    }
}
