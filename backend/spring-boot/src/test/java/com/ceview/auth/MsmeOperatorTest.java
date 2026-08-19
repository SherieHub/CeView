package com.ceview.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers {@link MsmeOperator#isProfileCompleted()}, the single derived source of truth for
 * whether an operator (particularly one provisioned via Google sign-in with no contact number
 * yet) still needs to go through the "complete your profile" step.
 */
class MsmeOperatorTest {

    @Test
    void profileIsCompletedWhenContactNumberIsPresent() {
        MsmeOperator op = new MsmeOperator();
        op.setContactNumber("09171234567");

        assertTrue(op.isProfileCompleted());
    }

    @Test
    void profileIsNotCompletedWhenContactNumberIsNull() {
        MsmeOperator op = new MsmeOperator();
        op.setContactNumber(null);

        assertFalse(op.isProfileCompleted());
    }

    @Test
    void profileIsNotCompletedWhenContactNumberIsBlank() {
        MsmeOperator op = new MsmeOperator();
        op.setContactNumber("   ");

        assertFalse(op.isProfileCompleted());
    }
}
