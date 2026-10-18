package com.ceview.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Email-verification behaviour of {@link AuthController}: the password rule, the verification
 * code on sign-up, takeover of an unverified sign-up, Google auto-verification, change-email and
 * password reset. Same no-Spring-context style as {@link AuthControllerTest}.
 */
class AuthControllerEmailVerificationTest {

    private final MsmeOperatorRepository repo = mock(MsmeOperatorRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final JwtService jwt = mock(JwtService.class);
    private final CurrentOperator currentOperator = new CurrentOperator(repo);
    private final EmailCodeService emailCodes = mock(EmailCodeService.class);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private AuthController controller() {
        return new AuthController(repo, encoder, jwt, Optional.empty(), currentOperator, emailCodes,
            new PhoneVerificationService(Optional.empty()));
    }

    private AuthController controller(FirebaseAuth firebaseAuth) {
        return new AuthController(repo, encoder, jwt, Optional.of(firebaseAuth), currentOperator, emailCodes,
            new PhoneVerificationService(Optional.of(firebaseAuth)));
    }

    private static MsmeOperator operator(String email) {
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(UUID.randomUUID());
        op.setEmail(email);
        op.setFirstName("Ana");
        op.setPasswordHash("hashed");
        op.setContactNumber("0917");
        return op;
    }

    private void stubSaveAssignsId() {
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> {
            MsmeOperator o = inv.getArgument(0);
            if (o.getOperatorId() == null) o.setOperatorId(UUID.randomUUID());
            return o;
        });
        when(jwt.issue(any(), any())).thenReturn("jwt-token");
    }

    private void signInAs(MsmeOperator op) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(op.getOperatorId().toString(), null, List.of()));
        when(repo.existsById(op.getOperatorId())).thenReturn(true);
        when(repo.findById(op.getOperatorId())).thenReturn(Optional.of(op));
        when(repo.save(any(MsmeOperator.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static AuthController.RegisterRequest registration(String email, String password) {
        return new AuthController.RegisterRequest("Ana", "Cruz", email, password, "0917", null, null);
    }

    private static AuthFlowException flowError(Executable call) {
        return assertThrows(AuthFlowException.class, call);
    }

    private static Map<?, ?> body(ResponseEntity<?> response) {
        return (Map<?, ?>) response.getBody();
    }

    // ---- register(): password rule ----

    @Test
    void registerRejectsPasswordsThatBreakThePolicy() {
        for (String weak : List.of("short1", "alllettersnodigit", "12345678", "")) {
            AuthFlowException e = flowError(() -> controller().register(registration("a@b.com", weak)));
            assertEquals("WEAK_PASSWORD", e.code());
            assertEquals(400, e.status());
        }
        verify(repo, never()).save(any(MsmeOperator.class));
    }

    @Test
    void registerRejectsPasswordsLongerThanBcryptCanUse() {
        String tooLong = "a1" + "x".repeat(71);

        assertEquals("WEAK_PASSWORD", flowError(() -> controller().register(registration("a@b.com", tooLong))).code());
    }

    // ---- register(): verification code ----

    @Test
    void registerReportsEmailNotVerifiedAndEmailsACode() {
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.empty());
        stubSaveAssignsId();

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(Boolean.FALSE, body(response).get("emailVerified"));
        verify(emailCodes).issue(any(MsmeOperator.class), eq(EmailCode.Purpose.VERIFY_EMAIL));
    }

    @Test
    void registerStillSucceedsWhenTheCodeEmailCannotBeSent() {
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.empty());
        stubSaveAssignsId();
        doThrow(new AuthFlowException(503, "EMAIL_SEND_FAILED", "down"))
            .when(emailCodes).issue(any(MsmeOperator.class), any());

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
    }

    // ---- register(): duplicate email / takeover of an unverified sign-up ----

    @Test
    void registerRejectsAnEmailBelongingToAVerifiedAccount() {
        MsmeOperator existing = operator("a@b.com");
        existing.setEmailVerifiedAt(OffsetDateTime.now());
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(existing));

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("EMAIL_TAKEN", body(response).get("code"));
        verify(repo, never()).delete(any(MsmeOperator.class));
    }

    @Test
    void registerNeverTakesOverAnAccountThatExistedBeforeVerificationShipped() {
        MsmeOperator legacy = operator("a@b.com");
        legacy.setCreatedBeforeVerification(true);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(legacy));

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("EMAIL_TAKEN", body(response).get("code"));
        verify(repo, never()).delete(any(MsmeOperator.class));
    }

    @Test
    void registerNeverTakesOverAGoogleAccount() {
        MsmeOperator google = operator("a@b.com");
        google.setGoogleUid("g-1");
        google.setPasswordHash(null);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(google));

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(repo, never()).delete(any(MsmeOperator.class));
    }

    @Test
    void registerReplacesAnUnverifiedPasswordSignUpCreatedAfterVerificationShipped() {
        MsmeOperator squatter = operator("a@b.com");
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(squatter));
        stubSaveAssignsId();

        ResponseEntity<?> response = controller().register(registration("a@b.com", "Passw0rd1"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(emailCodes).discardAll(squatter.getOperatorId());
        verify(repo).delete(squatter);
        assertNotEquals(squatter.getOperatorId(), body(response).get("operatorId"),
            "a fresh operator id is issued, so the squatter's old JWT stops working");
    }

    // ---- login ----

    @Test
    void loginReportsWhetherTheEmailIsVerified() {
        MsmeOperator op = operator("a@b.com");
        op.setEmailVerifiedAt(OffsetDateTime.now());
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));
        when(encoder.matches("pw", "hashed")).thenReturn(true);
        when(jwt.issue(any(), any())).thenReturn("jwt-token");

        ResponseEntity<?> response = controller().login(new AuthController.LoginRequest("a@b.com", "pw"));

        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
    }

    @Test
    void loginRejectsAGoogleOnlyAccountWithoutTouchingTheEncoder() {
        MsmeOperator op = operator("a@b.com");
        op.setPasswordHash(null);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));

        ResponseEntity<?> response = controller().login(new AuthController.LoginRequest("a@b.com", "pw"));

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verify(encoder, never()).matches(anyString(), anyString());
    }

    // ---- google(): Google already proved the address ----

    private FirebaseAuth googleAuth(String uid, String email, boolean emailVerified) throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = mock(FirebaseAuth.class);
        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn(uid);
        when(token.getEmail()).thenReturn(email);
        when(token.isEmailVerified()).thenReturn(emailVerified);
        when(token.getName()).thenReturn("Juan Dela Cruz");
        when(firebaseAuth.verifyIdToken("good-token")).thenReturn(token);
        return firebaseAuth;
    }

    private static AuthController.GoogleAuthRequest google(String intent) {
        return new AuthController.GoogleAuthRequest("good-token", intent);
    }

    @Test
    void googleMarksANewOperatorVerifiedWhenGoogleVerifiedTheEmail() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-new", "new@example.com", true);
        when(repo.findByGoogleUid("g-new")).thenReturn(Optional.empty());
        when(repo.findByEmail("new@example.com")).thenReturn(Optional.empty());
        stubSaveAssignsId();

        ResponseEntity<?> response = controller(firebaseAuth).google(google("register"));

        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
    }

    @Test
    void googleLeavesANewOperatorUnverifiedWhenGoogleDidNotVerifyTheEmail() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-unv", "new@example.com", false);
        when(repo.findByGoogleUid("g-unv")).thenReturn(Optional.empty());
        stubSaveAssignsId();

        ResponseEntity<?> response = controller(firebaseAuth).google(google("register"));

        assertEquals(Boolean.FALSE, body(response).get("emailVerified"));
    }

    @Test
    void googleLinkingAnUnverifiedPasswordAccountVerifiesItAndDropsThePassword() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-link", "a@b.com", true);
        MsmeOperator existing = operator("a@b.com");
        when(repo.findByGoogleUid("g-link")).thenReturn(Optional.empty());
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(existing));
        stubSaveAssignsId();

        ResponseEntity<?> response = controller(firebaseAuth).google(google("login"));

        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
        assertEquals("g-link", existing.getGoogleUid());
        assertNull(existing.getPasswordHash(), "a password set before the address was proven must not survive");
    }

    @Test
    void googleLinkingAnAlreadyVerifiedAccountKeepsItsPassword() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-keep", "a@b.com", true);
        MsmeOperator existing = operator("a@b.com");
        existing.setEmailVerifiedAt(OffsetDateTime.now());
        when(repo.findByGoogleUid("g-keep")).thenReturn(Optional.empty());
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(existing));
        stubSaveAssignsId();

        controller(firebaseAuth).google(google("login"));

        assertEquals("hashed", existing.getPasswordHash());
    }

    @Test
    void googleVerifiesAnAlreadyLinkedUnverifiedOperatorWhenTheEmailMatches() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-old", "a@b.com", true);
        MsmeOperator linked = operator("a@b.com");
        linked.setGoogleUid("g-old");
        when(repo.findByGoogleUid("g-old")).thenReturn(Optional.of(linked));
        stubSaveAssignsId();

        ResponseEntity<?> response = controller(firebaseAuth).google(google("login"));

        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
    }

    @Test
    void googleDoesNotVerifyAnAlreadyLinkedOperatorWhoseGoogleEmailDiffers() throws FirebaseAuthException {
        FirebaseAuth firebaseAuth = googleAuth("g-old", "changed@gmail.com", true);
        MsmeOperator linked = operator("a@b.com");
        linked.setGoogleUid("g-old");
        when(repo.findByGoogleUid("g-old")).thenReturn(Optional.of(linked));
        stubSaveAssignsId();

        ResponseEntity<?> response = controller(firebaseAuth).google(google("login"));

        assertEquals(Boolean.FALSE, body(response).get("emailVerified"));
    }

    // ---- email-verification/send and /verify ----

    @Test
    void sendVerificationCodeEmailsTheSignedInOperator() {
        MsmeOperator op = operator("a@b.com");
        signInAs(op);
        when(emailCodes.resendCooldown()).thenReturn(Duration.ofSeconds(60));

        ResponseEntity<?> response = controller().sendVerificationCode();

        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        assertEquals("a@b.com", body(response).get("sentTo"));
        assertEquals(60L, body(response).get("resendAvailableInSeconds"));
        verify(emailCodes).issue(op, EmailCode.Purpose.VERIFY_EMAIL);
    }

    @Test
    void sendVerificationCodeRefusesWhenAlreadyVerified() {
        MsmeOperator op = operator("a@b.com");
        op.setEmailVerifiedAt(OffsetDateTime.now());
        signInAs(op);

        AuthFlowException e = flowError(() -> controller().sendVerificationCode());

        assertEquals("ALREADY_VERIFIED", e.code());
        assertEquals(409, e.status());
        verify(emailCodes, never()).issue(any(), any());
    }

    @Test
    void verifyEmailMarksTheOperatorVerifiedOnAGoodCode() {
        MsmeOperator op = operator("a@b.com");
        signInAs(op);

        ResponseEntity<?> response = controller().verifyEmail(new AuthController.VerifyCodeRequest("123456"));

        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
        verify(emailCodes).verify(op, EmailCode.Purpose.VERIFY_EMAIL, "123456");
        assertTrue(op.isEmailVerified());
        verify(repo).save(op);
    }

    @Test
    void verifyEmailLeavesTheOperatorUnverifiedWhenTheCodeIsWrong() {
        MsmeOperator op = operator("a@b.com");
        signInAs(op);
        doThrow(new AuthFlowException(400, "INVALID_CODE", "no", Map.of("attemptsRemaining", 4)))
            .when(emailCodes).verify(any(), any(), anyString());

        AuthFlowException e = flowError(() -> controller().verifyEmail(new AuthController.VerifyCodeRequest("000000")));

        assertEquals("INVALID_CODE", e.code());
        assertFalse(op.isEmailVerified());
    }

    @Test
    void verifyEmailIsIdempotentOnceVerified() {
        MsmeOperator op = operator("a@b.com");
        op.setEmailVerifiedAt(OffsetDateTime.now());
        signInAs(op);

        ResponseEntity<?> response = controller().verifyEmail(new AuthController.VerifyCodeRequest("123456"));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(emailCodes, never()).verify(any(), any(), anyString());
    }

    // ---- PATCH /email ----

    @Test
    void changeEmailMovesTheAccountAndSendsACodeToTheNewAddress() {
        MsmeOperator op = operator("typo@b.com");
        signInAs(op);
        when(repo.findByEmail("right@b.com")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller().changeEmail(new AuthController.ChangeEmailRequest("right@b.com"));

        assertEquals("right@b.com", body(response).get("email"));
        assertEquals("right@b.com", op.getEmail());
        verify(emailCodes).invalidateAll(op.getOperatorId());
        verify(emailCodes).issueIgnoringCooldown(op, EmailCode.Purpose.VERIFY_EMAIL);
    }

    @Test
    void changeEmailRejectsAnAddressAnotherAccountUses() {
        MsmeOperator op = operator("typo@b.com");
        signInAs(op);
        when(repo.findByEmail("taken@b.com")).thenReturn(Optional.of(operator("taken@b.com")));

        AuthFlowException e = flowError(
            () -> controller().changeEmail(new AuthController.ChangeEmailRequest("taken@b.com")));

        assertEquals("EMAIL_TAKEN", e.code());
        assertEquals("typo@b.com", op.getEmail());
        verify(emailCodes, never()).issueIgnoringCooldown(any(), any());
    }

    @Test
    void changeEmailRejectsTheSameAddress() {
        MsmeOperator op = operator("a@b.com");
        signInAs(op);

        AuthFlowException e = flowError(() -> controller().changeEmail(new AuthController.ChangeEmailRequest("A@B.com")));

        assertEquals("SAME_EMAIL", e.code());
    }

    @Test
    void changeEmailIsRefusedOnceVerified() {
        MsmeOperator op = operator("a@b.com");
        op.setEmailVerifiedAt(OffsetDateTime.now());
        signInAs(op);

        AuthFlowException e = flowError(() -> controller().changeEmail(new AuthController.ChangeEmailRequest("new@b.com")));

        assertEquals("ALREADY_VERIFIED", e.code());
        assertEquals(409, e.status());
    }

    // ---- password reset ----

    @Test
    void passwordResetRequestRejectsAnUnknownEmail() {
        when(repo.findByEmail("nobody@b.com")).thenReturn(Optional.empty());

        AuthFlowException e = flowError(
            () -> controller().requestPasswordReset(new AuthController.PasswordResetRequest("nobody@b.com")));

        assertEquals("ACCOUNT_NOT_FOUND", e.code());
        assertEquals(404, e.status());
        verify(emailCodes, never()).issue(any(), any());
    }

    @Test
    void passwordResetRequestRefusesAGoogleOnlyAccount() {
        MsmeOperator google = operator("a@b.com");
        google.setPasswordHash(null);
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(google));

        AuthFlowException e = flowError(
            () -> controller().requestPasswordReset(new AuthController.PasswordResetRequest("a@b.com")));

        assertEquals("GOOGLE_ACCOUNT", e.code());
        assertEquals(409, e.status());
        verify(emailCodes, never()).issue(any(), any());
    }

    @Test
    void passwordResetRequestEmailsAResetCode() {
        MsmeOperator op = operator("a@b.com");
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));
        when(emailCodes.resendCooldown()).thenReturn(Duration.ofSeconds(60));

        ResponseEntity<?> response = controller().requestPasswordReset(new AuthController.PasswordResetRequest("a@b.com"));

        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        verify(emailCodes).issue(op, EmailCode.Purpose.RESET_PASSWORD);
    }

    @Test
    void passwordResetConfirmRejectsAWeakNewPasswordBeforeSpendingTheCode() {
        AuthFlowException e = flowError(() -> controller().confirmPasswordReset(
            new AuthController.PasswordResetConfirmRequest("a@b.com", "123456", "weak")));

        assertEquals("WEAK_PASSWORD", e.code());
        verify(emailCodes, never()).verify(any(), any(), anyString());
    }

    @Test
    void passwordResetConfirmSetsThePasswordVerifiesTheEmailAndSignsIn() {
        MsmeOperator op = operator("a@b.com");
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));
        when(encoder.encode("NewPass123")).thenReturn("new-hash");
        stubSaveAssignsId();

        ResponseEntity<?> response = controller().confirmPasswordReset(
            new AuthController.PasswordResetConfirmRequest("a@b.com", "123456", "NewPass123"));

        verify(emailCodes).verify(op, EmailCode.Purpose.RESET_PASSWORD, "123456");
        assertEquals("new-hash", op.getPasswordHash());
        assertTrue(op.isEmailVerified(), "owning the inbox is proof enough to verify the address");
        assertEquals("jwt-token", body(response).get("token"));
        assertEquals(Boolean.TRUE, body(response).get("emailVerified"));
    }

    @Test
    void passwordResetConfirmKeepsThePasswordWhenTheCodeIsWrong() {
        MsmeOperator op = operator("a@b.com");
        when(repo.findByEmail("a@b.com")).thenReturn(Optional.of(op));
        doThrow(new AuthFlowException(400, "INVALID_CODE", "no")).when(emailCodes).verify(any(), any(), anyString());

        flowError(() -> controller().confirmPasswordReset(
            new AuthController.PasswordResetConfirmRequest("a@b.com", "000000", "NewPass123")));

        assertEquals("hashed", op.getPasswordHash());
        assertFalse(op.isEmailVerified());
    }

    // ---- AuthFlowException rendering ----

    @Test
    void authFlowExceptionsRenderTheirStatusCodeAndDetails() {
        ResponseEntity<?> response = controller().authFlow(
            new AuthFlowException(429, "RESEND_COOLDOWN", "wait", Map.of("retryAfterSeconds", 42L)));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("42", response.getHeaders().getFirst("Retry-After"));
        assertEquals("RESEND_COOLDOWN", body(response).get("code"));
        assertEquals("wait", body(response).get("error"));
        assertEquals(42L, body(response).get("retryAfterSeconds"));
    }
}
