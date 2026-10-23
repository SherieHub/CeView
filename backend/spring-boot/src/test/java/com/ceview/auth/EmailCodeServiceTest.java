package com.ceview.auth;

import com.ceview.email.EmailMessage;
import com.ceview.email.EmailSendException;
import com.ceview.email.EmailSender;
import com.ceview.testsupport.MutableClock;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rules of the emailed 6-digit code: TTL, attempt lock, resend cooldown, hourly cap, supersession
 * and the stored-as-a-hash guarantee. The repository is mocked; the derived query names are
 * exercised for real by {@code EmailVerificationFlowIntegrationTest}.
 */
class EmailCodeServiceTest {

    private static final Instant START = Instant.parse("2026-10-18T08:00:00Z");
    private static final EmailCode.Purpose VERIFY = EmailCode.Purpose.VERIFY_EMAIL;

    private final EmailCodeRepository codes = mock(EmailCodeRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final EmailSender sender = mock(EmailSender.class);
    private final MutableClock clock = new MutableClock(START);
    private final EmailCodeService service = new EmailCodeService(
        codes, encoder, sender, clock, Duration.ofMinutes(10), 5, Duration.ofSeconds(60), 5);

    private final MsmeOperator op = operator();

    private static MsmeOperator operator() {
        MsmeOperator o = new MsmeOperator();
        o.setOperatorId(UUID.randomUUID());
        o.setEmail("ana@example.com");
        o.setFirstName("Ana");
        return o;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private EmailCode stored(String code, OffsetDateTime createdAt) {
        EmailCode c = new EmailCode();
        c.setOperatorId(op.getOperatorId());
        c.setPurpose(VERIFY);
        c.setEmail(op.getEmail());
        c.setCodeHash(encoder.encode(code));
        c.setCreatedAt(createdAt);
        c.setExpiresAt(createdAt.plusMinutes(10));
        return c;
    }

    private void activeCodeIs(EmailCode code) {
        when(codes.findFirstByOperatorIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(op.getOperatorId(), VERIFY))
            .thenReturn(Optional.of(code));
    }

    private void lastCodeCreatedAt(OffsetDateTime createdAt) {
        when(codes.findFirstByOperatorIdAndPurposeOrderByCreatedAtDesc(op.getOperatorId(), VERIFY))
            .thenReturn(Optional.of(stored("111111", createdAt)));
    }

    private static AuthFlowException failure(Executable call) {
        return assertThrows(AuthFlowException.class, call);
    }

    /** Pulls the 6 digits out of the email the service handed to the sender. */
    private String emailedCode() {
        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        Matcher m = Pattern.compile("Your code: (\\d{6})").matcher(sent.getValue().text());
        assertTrue(m.find(), "email text carries the code");
        return m.group(1);
    }

    private EmailCode savedCode() {
        ArgumentCaptor<EmailCode> saved = ArgumentCaptor.forClass(EmailCode.class);
        verify(codes).save(saved.capture());
        return saved.getValue();
    }

    // ---- issue() ----

    @Test
    void issueEmailsASixDigitCodeAndStoresOnlyItsHash() {
        service.issue(op, VERIFY);

        String code = emailedCode();
        EmailCode row = savedCode();
        assertEquals(6, code.length());
        assertTrue(code.chars().allMatch(Character::isDigit));
        assertTrue(!row.getCodeHash().contains(code), "the plain code is never stored");
        assertTrue(encoder.matches(code, row.getCodeHash()));
        assertEquals(op.getOperatorId(), row.getOperatorId());
        assertEquals("ana@example.com", row.getEmail());
        assertEquals(now().plusMinutes(10), row.getExpiresAt());
        assertEquals(0, row.getAttempts());
    }

    @Test
    void issueAddressesTheEmailToTheOperator() {
        service.issue(op, VERIFY);

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        assertEquals("ana@example.com", sent.getValue().to());
        assertEquals("Your CeView verification code", sent.getValue().subject());
    }

    @Test
    void issueUsesTheResetTemplateForPasswordReset() {
        service.issue(op, EmailCode.Purpose.RESET_PASSWORD);

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        assertEquals("Reset your CeView password", sent.getValue().subject());
    }

    @Test
    void issueSupersedesTheEarlierActiveCode() {
        EmailCode old = stored("111111", now().minusMinutes(5));
        activeCodeIs(old);

        service.issue(op, VERIFY);

        assertEquals(now(), old.getConsumedAt());
    }

    @Test
    void issueIsRefusedDuringTheResendCooldown() {
        lastCodeCreatedAt(now().minusSeconds(30));

        AuthFlowException e = failure(() -> service.issue(op, VERIFY));

        assertEquals(429, e.status());
        assertEquals("RESEND_COOLDOWN", e.code());
        assertEquals(30L, e.details().get("retryAfterSeconds"));
        verify(sender, never()).send(any());
        verify(codes, never()).save(any());
    }

    @Test
    void issueIsAllowedOnceTheCooldownHasPassed() {
        lastCodeCreatedAt(now().minusSeconds(61));

        assertDoesNotThrow(() -> service.issue(op, VERIFY));
        verify(sender).send(any());
    }

    @Test
    void issueIsRefusedOnceTheHourlyCapIsReached() {
        List<EmailCode> recent = List.of(
            stored("1", now().minusMinutes(50)), stored("2", now().minusMinutes(40)),
            stored("3", now().minusMinutes(30)), stored("4", now().minusMinutes(20)),
            stored("5", now().minusMinutes(10)));
        when(codes.findByOperatorIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(
            any(), any(), any())).thenReturn(recent);

        AuthFlowException e = failure(() -> service.issue(op, VERIFY));

        assertEquals(429, e.status());
        assertEquals("SEND_LIMIT", e.code());
        assertEquals(600L, e.details().get("retryAfterSeconds"), "the oldest send leaves the hour in 10 minutes");
        verify(sender, never()).send(any());
    }

    @Test
    void issueIgnoringCooldownSkipsTheCooldownButNotTheHourlyCap() {
        lastCodeCreatedAt(now().minusSeconds(5));
        assertDoesNotThrow(() -> service.issueIgnoringCooldown(op, VERIFY));

        List<EmailCode> five = List.of(
            stored("1", now().minusMinutes(50)), stored("2", now().minusMinutes(40)),
            stored("3", now().minusMinutes(30)), stored("4", now().minusMinutes(20)),
            stored("5", now().minusMinutes(10)));
        when(codes.findByOperatorIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(
            any(), any(), any())).thenReturn(five);
        assertEquals("SEND_LIMIT", failure(() -> service.issueIgnoringCooldown(op, VERIFY)).code());
    }

    @Test
    void issueReportsAFailedSendAs503() {
        doThrow(new EmailSendException("provider down")).when(sender).send(any());

        AuthFlowException e = failure(() -> service.issue(op, VERIFY));

        assertEquals(503, e.status());
        assertEquals("EMAIL_SEND_FAILED", e.code());
    }

    // ---- verify() ----

    @Test
    void verifyConsumesTheCodeOnAMatch() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        activeCodeIs(active);

        service.verify(op, VERIFY, "123456");

        assertEquals(now(), active.getConsumedAt());
        verify(codes).save(active);
    }

    @Test
    void verifyTrimsWhitespaceAroundThePastedCode() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        activeCodeIs(active);

        assertDoesNotThrow(() -> service.verify(op, VERIFY, " 123456 "));
    }

    @Test
    void verifyRejectsWhenThereIsNoActiveCode() {
        when(codes.findFirstByOperatorIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(any(), any()))
            .thenReturn(Optional.empty());

        assertEquals("NO_ACTIVE_CODE", failure(() -> service.verify(op, VERIFY, "123456")).code());
    }

    @Test
    void verifyRejectsACodeSentToAnAddressTheOperatorNoLongerHas() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        active.setEmail("old-address@example.com");
        activeCodeIs(active);

        assertEquals("NO_ACTIVE_CODE", failure(() -> service.verify(op, VERIFY, "123456")).code());
        assertNull(active.getConsumedAt());
    }

    @Test
    void verifyRejectsAnExpiredCodeEvenIfItIsRight() {
        activeCodeIs(stored("123456", now().minusMinutes(11)));

        AuthFlowException e = failure(() -> service.verify(op, VERIFY, "123456"));

        assertEquals("CODE_EXPIRED", e.code());
        assertEquals(400, e.status());
    }

    @Test
    void verifyTreatsTheExpiryInstantItselfAsExpired() {
        activeCodeIs(stored("123456", now().minusMinutes(10)));

        assertEquals("CODE_EXPIRED", failure(() -> service.verify(op, VERIFY, "123456")).code());
    }

    @Test
    void verifyCountsAWrongGuessAndReportsAttemptsRemaining() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        activeCodeIs(active);

        AuthFlowException e = failure(() -> service.verify(op, VERIFY, "000000"));

        assertEquals("INVALID_CODE", e.code());
        assertEquals(4, e.details().get("attemptsRemaining"));
        assertEquals(1, active.getAttempts());
        assertNull(active.getConsumedAt());
        verify(codes).save(active);
    }

    @Test
    void verifyReportsZeroAttemptsRemainingOnTheFinalWrongGuess() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        active.setAttempts(4);
        activeCodeIs(active);

        AuthFlowException e = failure(() -> service.verify(op, VERIFY, "000000"));

        assertEquals("INVALID_CODE", e.code());
        assertEquals(0, e.details().get("attemptsRemaining"));
    }

    @Test
    void verifyLocksTheCodeAfterTooManyWrongGuessesEvenForTheRightCode() {
        EmailCode active = stored("123456", now().minusMinutes(1));
        active.setAttempts(5);
        activeCodeIs(active);

        AuthFlowException e = failure(() -> service.verify(op, VERIFY, "123456"));

        assertEquals("CODE_LOCKED", e.code());
        assertNull(active.getConsumedAt());
    }

    @Test
    void verifyRejectsANullCode() {
        activeCodeIs(stored("123456", now().minusMinutes(1)));

        assertEquals("INVALID_CODE", failure(() -> service.verify(op, VERIFY, null)).code());
    }

    // ---- invalidateAll() / discardAll() ----

    @Test
    void invalidateAllConsumesEveryOutstandingCode() {
        EmailCode a = stored("111111", now().minusMinutes(2));
        EmailCode b = stored("222222", now().minusMinutes(1));
        when(codes.findByOperatorIdAndConsumedAtIsNull(op.getOperatorId())).thenReturn(List.of(a, b));

        service.invalidateAll(op.getOperatorId());

        assertEquals(now(), a.getConsumedAt());
        assertEquals(now(), b.getConsumedAt());
    }

    @Test
    void discardAllDeletesTheOperatorsCodes() {
        service.discardAll(op.getOperatorId());

        verify(codes).deleteByOperatorId(op.getOperatorId());
        assertNotNull(service.resendCooldown());
    }
}
