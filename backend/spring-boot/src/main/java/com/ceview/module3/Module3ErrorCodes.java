package com.ceview.module3;

/**
 * Shared error codes for Module 3. Mirrors FastAPI's app/errors.py and the
 * frontend banner output so a single failure surfaces with the same string
 * everywhere it is logged or rendered.
 */
public final class Module3ErrorCodes {
    private Module3ErrorCodes() {}

    public static final String MOD3_CONTENT_GATEWAY_TIMEOUT = "MOD3_CONTENT_GATEWAY_TIMEOUT";
    public static final String MOD3_CONTENT_GATEWAY_5XX = "MOD3_CONTENT_GATEWAY_5XX";
    public static final String MOD3_CONTENT_DESERIALIZE_FAIL = "MOD3_CONTENT_DESERIALIZE_FAIL";

    public static final String MOD3_COMPLIANCE_GATEWAY_TIMEOUT = "MOD3_COMPLIANCE_GATEWAY_TIMEOUT";
    public static final String MOD3_COMPLIANCE_GATEWAY_5XX = "MOD3_COMPLIANCE_GATEWAY_5XX";
    public static final String MOD3_COMPLIANCE_VALIDATION = "MOD3_COMPLIANCE_VALIDATION";
}
