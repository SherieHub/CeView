package com.ceview.security;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * The whole email-verification stack against a real Spring context and H2: register, the
 * server-side gate, the emailed code (read through the test-support hook), verify, change-email,
 * password reset and takeover of an unverified sign-up. Unit tests cover each rule in isolation;
 * this proves the pieces are wired together (filter order, security permits, JPA mappings and the
 * derived repository queries).
 */
@SpringBootTest(properties = "ceview.test-support.enabled=true")
@AutoConfigureMockMvc
class EmailVerificationFlowIntegrationTest {

    private static final String PASSWORD = "Passw0rd1";

    @Autowired
    private MockMvc mvc;

    private static String uniqueEmail() {
        return "flow-" + System.nanoTime() + "@example.com";
    }

    private static String registerJson(String email, String password) {
        return "{\"firstName\":\"Ana\",\"lastName\":\"Cruz\",\"email\":\"" + email + "\","
            + "\"password\":\"" + password + "\",\"contactNumber\":\"09171234567\"}";
    }

    /** Registers and returns the response body JSON. */
    private String register(String email) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(registerJson(email, PASSWORD)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    }

    private String codeSentTo(String email) throws Exception {
        String body = mvc.perform(get("/api/test-support/email-codes/latest").param("email", email))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.code");
    }

    private static String bearer(String registerBody) {
        return "Bearer " + JsonPath.<String>read(registerBody, "$.token");
    }

    private void verifyEmail(String authHeader, String code) throws Exception {
        mvc.perform(post("/api/auth/email-verification/verify").header("Authorization", authHeader)
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.emailVerified").value(true));
    }

    @Test
    void registrationEmailsACodeAndTheGateBlocksTheApiUntilItIsEntered() throws Exception {
        String email = uniqueEmail();
        String body = register(email);
        String auth = bearer(body);
        assertEquals(false, JsonPath.<Boolean>read(body, "$.emailVerified"));

        mvc.perform(get("/api/business-profile").header("Authorization", auth))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));

        verifyEmail(auth, codeSentTo(email));

        mvc.perform(get("/api/business-profile").header("Authorization", auth))
            .andExpect(status().isOk());
    }

    @Test
    void aWrongCodeIsCountedAndDoesNotVerify() throws Exception {
        String email = uniqueEmail();
        String auth = bearer(register(email));
        String right = codeSentTo(email);
        String wrong = right.equals("000000") ? "111111" : "000000";

        mvc.perform(post("/api/auth/email-verification/verify").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + wrong + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_CODE"))
            .andExpect(jsonPath("$.attemptsRemaining").value(4));

        mvc.perform(get("/api/business-profile").header("Authorization", auth))
            .andExpect(status().isForbidden());

        verifyEmail(auth, right);
    }

    @Test
    void aSecondCodeRequestInsideTheCooldownIsRefusedWithRetryAfter() throws Exception {
        String email = uniqueEmail();
        String auth = bearer(register(email));

        mvc.perform(post("/api/auth/email-verification/send").header("Authorization", auth))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RESEND_COOLDOWN"))
            .andExpect(header().exists("Retry-After"));
    }

    @Test
    void verifyingTwiceIsHarmlessAndSendingToAVerifiedAccountIsRefused() throws Exception {
        String email = uniqueEmail();
        String auth = bearer(register(email));
        String code = codeSentTo(email);
        verifyEmail(auth, code);
        verifyEmail(auth, code);

        mvc.perform(post("/api/auth/email-verification/send").header("Authorization", auth))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ALREADY_VERIFIED"));
    }

    @Test
    void aWeakPasswordIsRejectedAtRegistration() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(registerJson(uniqueEmail(), "password")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("WEAK_PASSWORD"));
    }

    @Test
    void aVerifiedEmailCannotBeRegisteredAgain() throws Exception {
        String email = uniqueEmail();
        String auth = bearer(register(email));
        verifyEmail(auth, codeSentTo(email));

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(registerJson(email, PASSWORD)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void anUnverifiedSignUpIsReplacedByAFreshRegistrationAndItsOldSessionDies() throws Exception {
        String email = uniqueEmail();
        String squatter = register(email);
        String owner = register(email);

        assertNotEquals(JsonPath.<String>read(squatter, "$.operatorId"), JsonPath.<String>read(owner, "$.operatorId"));
        mvc.perform(post("/api/auth/email-verification/send").header("Authorization", bearer(squatter)))
            .andExpect(status().isUnauthorized());

        verifyEmail(bearer(owner), codeSentTo(email));
    }

    @Test
    void changingEmailMovesTheCodeToTheNewAddress() throws Exception {
        String typo = uniqueEmail();
        String right = uniqueEmail();
        String auth = bearer(register(typo));
        String oldCode = codeSentTo(typo);

        mvc.perform(patch("/api/auth/email").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + right + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value(right));

        // The code mailed to the old address no longer works, even though it is still unexpired.
        mvc.perform(post("/api/auth/email-verification/verify").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + oldCode + "\"}"))
            .andExpect(status().isBadRequest());

        verifyEmail(auth, codeSentTo(right));
    }

    @Test
    void changingEmailToOneAnotherAccountUsesIsRejected() throws Exception {
        String taken = uniqueEmail();
        register(taken);
        String auth = bearer(register(uniqueEmail()));

        mvc.perform(patch("/api/auth/email").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + taken + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void passwordResetByCodeSetsANewPasswordVerifiesTheEmailAndSignsIn() throws Exception {
        String email = uniqueEmail();
        register(email); // left unverified on purpose: a reset also proves ownership

        mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"))
            .andExpect(status().isAccepted());
        String code = codeSentTo(email);

        String session = mvc.perform(post("/api/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\",\"newPassword\":\"Brand9NewPass\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.emailVerified").value(true))
            .andReturn().getResponse().getContentAsString();

        mvc.perform(get("/api/business-profile").header("Authorization", bearer(session)))
            .andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"Brand9NewPass\"}"))
            .andExpect(status().isOk());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void passwordResetForAnUnknownEmailIs404() throws Exception {
        mvc.perform(post("/api/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + uniqueEmail() + "\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_FOUND"));
    }

    @Test
    void theTestSupportHookIsReachableWithoutAToken() throws Exception {
        mvc.perform(get("/api/test-support/email-codes/latest").param("email", "nobody-" + System.nanoTime() + "@example.com"))
            .andExpect(status().isNotFound());
    }
}
