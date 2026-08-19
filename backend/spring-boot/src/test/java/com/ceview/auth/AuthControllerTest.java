package com.ceview.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Direct unit coverage for {@link AuthController} — no Spring context, mirroring the style
 * of {@link CurrentOperatorTest}. Covers the three ways a session can be established
 * (password register/login, and Google sign-in with its account-linking/provisioning rules)
 * and the profileCompleted flag each of them must report consistently.
 */
class AuthControllerTest {

    private final MsmeOperatorRepository repo = mock(MsmeOperatorRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final JwtService jwt = mock(JwtService.class);
    private final CurrentOperator currentOperator = new CurrentOperator();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private AuthController newController(Optional<FirebaseAuth> firebaseAuth) {
        return new AuthController(repo, encoder, jwt, firebaseAuth, currentOperator);
    }

    private void authenticateAs(UUID operatorId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));
    }

    // ---- register/login: profileCompleted must reflect contactNumber ----

    @Test
    void registerReturnsProfileCompletedTrueWhenContactNumberProvided() {
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.empty());
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> {
            MsmeOperator o = inv.getArgument(0);
            o.setOperatorId(UUID.randomUUID());
            return o;
        });
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.empty());

        ResponseEntity<?> response = controller.register(
            new AuthController.RegisterRequest("Ana", "Cruz", "a@b.com", "pw", "0917"));

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(Boolean.TRUE, body.get("profileCompleted"));
    }

    @Test
    void loginReturnsProfileCompletedFalseWhenOperatorHasNoContactNumber() {
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(UUID.randomUUID());
        op.setEmail("a@b.com");
        op.setPasswordHash("hashed");
        op.setContactNumber(null);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));
        when(encoder.matches("pw", "hashed")).thenReturn(true);
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.empty());

        ResponseEntity<?> response = controller.login(new AuthController.LoginRequest("a@b.com", "pw"));

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(Boolean.FALSE, body.get("profileCompleted"));
    }

    // ---- google(): unconfigured Firebase ----

    @Test
    void googleReturns503WhenFirebaseIsNotConfigured() {
        AuthController controller = newController(Optional.empty());

        ResponseEntity<?> response = controller.google(new AuthController.GoogleAuthRequest("some-id-token"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
    }

    // ---- google(): invalid token ----

    @Test
    void googleReturns401WhenTokenVerificationFails() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        when(firebaseAuth.verifyIdToken(anyString())).thenThrow(mock(FirebaseAuthException.class));
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(new AuthController.GoogleAuthRequest("bad-token"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    // ---- google(): brand-new user, no existing row ----

    @Test
    void googleProvisionsNewOperatorWhenNoExistingRowMatches() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-1");
        when(token.getEmail()).thenReturn("new@example.com");
        when(token.isEmailVerified()).thenReturn(true);
        when(token.getName()).thenReturn("Juan Dela Cruz");
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        when(repo.findByGoogleUid("google-uid-1")).thenReturn(Optional.empty());
        when(repo.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> {
            MsmeOperator o = inv.getArgument(0);
            if (o.getOperatorId() == null) o.setOperatorId(UUID.randomUUID());
            return o;
        });
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(new AuthController.GoogleAuthRequest("good-token"));

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(Boolean.FALSE, body.get("profileCompleted"));
        assertNotNull(body.get("operatorId"));
        assertEquals("jwt-token", body.get("token"));
    }

    // ---- google(): verified email matches an existing password account -> auto-link ----

    @Test
    void googleLinksToExistingOperatorWhenVerifiedEmailMatches() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-2");
        when(token.getEmail()).thenReturn("existing@example.com");
        when(token.isEmailVerified()).thenReturn(true);
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        when(repo.findByGoogleUid("google-uid-2")).thenReturn(Optional.empty());

        UUID existingId = UUID.randomUUID();
        MsmeOperator existing = new MsmeOperator();
        existing.setOperatorId(existingId);
        existing.setEmail("existing@example.com");
        existing.setContactNumber("0917");
        when(repo.findByEmail("existing@example.com")).thenReturn(Optional.of(existing));
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> {
            MsmeOperator o = inv.getArgument(0);
            if (o.getOperatorId() == null) o.setOperatorId(UUID.randomUUID());
            return o;
        });
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.of(firebaseAuth));

        ResponseEntity<?> response = controller.google(new AuthController.GoogleAuthRequest("good-token"));

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(existingId.toString(), body.get("operatorId").toString());
        assertEquals(Boolean.TRUE, body.get("profileCompleted"));
        assertEquals("google-uid-2", existing.getGoogleUid());
        verify(repo).save(existing);
    }

    // ---- google(): email not verified -> does not link, creates a new row instead ----

    @Test
    void googleDoesNotLinkWhenEmailIsUnverifiedEvenIfItMatches() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("google-uid-3");
        when(token.getEmail()).thenReturn("existing@example.com");
        when(token.isEmailVerified()).thenReturn(false);
        when(token.getName()).thenReturn(null);
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        when(repo.findByGoogleUid("google-uid-3")).thenReturn(Optional.empty());
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> {
            MsmeOperator o = inv.getArgument(0);
            if (o.getOperatorId() == null) o.setOperatorId(UUID.randomUUID());
            return o;
        });
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
        AuthController controller = newController(Optional.of(firebaseAuth));

        controller.google(new AuthController.GoogleAuthRequest("good-token"));

        verify(repo, org.mockito.Mockito.never()).findByEmail(anyString());
    }

    // ---- completeProfile(): the one-time step Google signups (or any incomplete account) go through ----

    @Test
    void completeProfileSetsContactNumberAndReportsProfileCompletedTrue() {
        UUID operatorId = UUID.randomUUID();
        authenticateAs(operatorId);
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setContactNumber(null);
        when(repo.findById(operatorId)).thenReturn(Optional.of(op));
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> inv.getArgument(0));
        AuthController controller = newController(Optional.empty());

        ResponseEntity<?> response = controller.completeProfile(
            new AuthController.CompleteProfileRequest("09171234567"));

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(Boolean.TRUE, body.get("profileCompleted"));
        assertEquals("09171234567", op.getContactNumber());
        verify(repo).save(op);
    }
}
