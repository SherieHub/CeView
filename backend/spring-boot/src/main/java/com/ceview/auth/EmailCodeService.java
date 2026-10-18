package com.ceview.auth;

import com.ceview.email.EmailMessage;
import com.ceview.email.EmailSendException;
import com.ceview.email.EmailSender;
import com.ceview.email.EmailTemplates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Issues and checks the 6-digit emailed codes behind email verification and password reset.
 *
 * <p>Rules (all configurable under {@code ceview.email-code}): a code is 6 random digits stored only
 * as a BCrypt hash, valid for {@code ttl}, locked after {@code max-attempts} wrong guesses, and
 * superseded when a new one is issued. A resend must wait {@code resend-cooldown}, and an operator
 * can be sent at most {@code max-sends-per-hour} codes per purpose per hour.
 */
@Service
public class EmailCodeService {

    private static final Duration SEND_WINDOW = Duration.ofHours(1);

    private final EmailCodeRepository codes;
    private final PasswordEncoder encoder;
    private final EmailSender sender;
    private final Clock clock;
    private final Duration ttl;
    private final int maxAttempts;
    private final Duration resendCooldown;
    private final int maxSendsPerHour;
    private final SecureRandom random = new SecureRandom();

    public EmailCodeService(
        EmailCodeRepository codes,
        PasswordEncoder encoder,
        EmailSender sender,
        Clock clock,
        @Value("${ceview.email-code.ttl:10m}") Duration ttl,
        @Value("${ceview.email-code.max-attempts:5}") int maxAttempts,
        @Value("${ceview.email-code.resend-cooldown:60s}") Duration resendCooldown,
        @Value("${ceview.email-code.max-sends-per-hour:5}") int maxSendsPerHour
    ) {
        this.codes = codes;
        this.encoder = encoder;
        this.sender = sender;
        this.clock = clock;
        this.ttl = ttl;
        this.maxAttempts = maxAttempts;
        this.resendCooldown = resendCooldown;
        this.maxSendsPerHour = maxSendsPerHour;
    }

    public Duration resendCooldown() { return resendCooldown; }

    /**
     * Emails a fresh code and invalidates any earlier one for the same purpose. Rolls back (so the
     * old code stays valid and no cooldown is burnt) if the email cannot be sent.
     *
     * @throws AuthFlowException 429 {@code RESEND_COOLDOWN} / {@code SEND_LIMIT}, or 503 {@code EMAIL_SEND_FAILED}
     */
    @Transactional
    public void issue(MsmeOperator op, EmailCode.Purpose purpose) {
        doIssue(op, purpose, true);
    }

    /**
     * Same as {@link #issue} but skips the resend cooldown (the hourly cap still applies). For
     * the address-change flow, where the code goes to a different address than the last one and
     * making the user wait out the old address's cooldown would only be an obstacle.
     */
    @Transactional
    public void issueIgnoringCooldown(MsmeOperator op, EmailCode.Purpose purpose) {
        doIssue(op, purpose, false);
    }

    private void doIssue(MsmeOperator op, EmailCode.Purpose purpose, boolean enforceCooldown) {
        OffsetDateTime now = OffsetDateTime.now(clock);

        if (enforceCooldown) {
            codes.findFirstByOperatorIdAndPurposeOrderByCreatedAtDesc(op.getOperatorId(), purpose)
                .filter(last -> last.getCreatedAt().plus(resendCooldown).isAfter(now))
                .ifPresent(last -> {
                    throw tooMany("RESEND_COOLDOWN", "Please wait before requesting another code.",
                        secondsUntil(now, last.getCreatedAt().plus(resendCooldown)));
                });
        }

        List<EmailCode> recent = codes.findByOperatorIdAndPurposeAndCreatedAtAfterOrderByCreatedAtAsc(
            op.getOperatorId(), purpose, now.minus(SEND_WINDOW));
        if (recent.size() >= maxSendsPerHour) {
            throw tooMany("SEND_LIMIT", "Too many codes requested. Try again later.",
                secondsUntil(now, recent.get(0).getCreatedAt().plus(SEND_WINDOW)));
        }

        codes.findFirstByOperatorIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(op.getOperatorId(), purpose)
            .ifPresent(active -> active.setConsumedAt(now));

        String code = String.format("%06d", random.nextInt(1_000_000));
        EmailCode row = new EmailCode();
        row.setOperatorId(op.getOperatorId());
        row.setPurpose(purpose);
        row.setEmail(op.getEmail());
        row.setCodeHash(encoder.encode(code));
        row.setCreatedAt(now);
        row.setExpiresAt(now.plus(ttl));
        codes.save(row);

        int ttlMinutes = (int) Math.max(1, ttl.toMinutes());
        EmailMessage message = purpose == EmailCode.Purpose.VERIFY_EMAIL
            ? EmailTemplates.verificationCode(op.getEmail(), op.getFirstName(), code, ttlMinutes)
            : EmailTemplates.passwordReset(op.getEmail(), op.getFirstName(), code, ttlMinutes);
        try {
            sender.send(message);
        } catch (EmailSendException e) {
            throw new AuthFlowException(503, "EMAIL_SEND_FAILED",
                "We could not send the email right now. Please try again shortly.");
        }
    }

    /**
     * Checks {@code submitted} against the operator's active code and consumes it on a match.
     * Wrong guesses are counted even though an exception is thrown, hence {@code noRollbackFor}.
     *
     * @throws AuthFlowException 400 {@code NO_ACTIVE_CODE} / {@code CODE_EXPIRED} / {@code CODE_LOCKED} /
     *         {@code INVALID_CODE}
     */
    @Transactional(noRollbackFor = AuthFlowException.class)
    public void verify(MsmeOperator op, EmailCode.Purpose purpose, String submitted) {
        OffsetDateTime now = OffsetDateTime.now(clock);

        EmailCode active = codes
            .findFirstByOperatorIdAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(op.getOperatorId(), purpose)
            .filter(c -> c.getEmail().equalsIgnoreCase(op.getEmail()))
            .orElseThrow(() -> new AuthFlowException(400, "NO_ACTIVE_CODE",
                "There is no active code. Request a new one."));

        if (!now.isBefore(active.getExpiresAt())) {
            throw new AuthFlowException(400, "CODE_EXPIRED", "That code has expired. Request a new one.");
        }
        if (active.getAttempts() >= maxAttempts) {
            throw new AuthFlowException(400, "CODE_LOCKED", "Too many wrong attempts. Request a new code.");
        }

        if (submitted == null || !encoder.matches(submitted.trim(), active.getCodeHash())) {
            active.setAttempts(active.getAttempts() + 1);
            codes.save(active);
            throw new AuthFlowException(400, "INVALID_CODE", "That code is not correct.",
                Map.of("attemptsRemaining", Math.max(0, maxAttempts - active.getAttempts())));
        }

        active.setConsumedAt(now);
        codes.save(active);
    }

    /** Drops every outstanding code, e.g. after the operator changes their email address. */
    @Transactional
    public void invalidateAll(UUID operatorId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        codes.findByOperatorIdAndConsumedAtIsNull(operatorId).forEach(c -> c.setConsumedAt(now));
    }

    /** Removes every code row for an operator that is about to be deleted. */
    @Transactional
    public void discardAll(UUID operatorId) {
        codes.deleteByOperatorId(operatorId);
    }

    private static AuthFlowException tooMany(String code, String message, long retryAfterSeconds) {
        return new AuthFlowException(429, code, message, Map.of("retryAfterSeconds", retryAfterSeconds));
    }

    private static long secondsUntil(OffsetDateTime now, OffsetDateTime later) {
        return Math.max(1, (long) Math.ceil(Duration.between(now, later).toMillis() / 1000.0));
    }
}
