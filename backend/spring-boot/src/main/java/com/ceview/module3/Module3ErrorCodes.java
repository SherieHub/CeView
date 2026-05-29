package com.ceview.module3;

/**
 * Shared error codes for Module 3. Mirrors FastAPI's app/errors.py and the
 * frontend banner output so a single failure surfaces with the same string
 * everywhere it is logged or rendered.
 */
public final class Module3ErrorCodes {
    private Module3ErrorCodes() {}

    // ─── Submodule 3.1 — Content Generation ──────────────────────────────────
    public static final String MOD31_CONTENT_PROFILE_NOT_FOUND  = "MOD31_CONTENT_PROFILE_NOT_FOUND";
    public static final String MOD31_CONTENT_GENERATION_FAILED  = "MOD31_CONTENT_GENERATION_FAILED";
    public static final String MOD31_CONTENT_STORED             = "MOD31_CONTENT_STORED";
    public static final String MOD31_CONTENT_APPROVED           = "MOD31_CONTENT_APPROVED";
    public static final String MOD31_SERP_UNAVAILABLE           = "MOD31_SERP_UNAVAILABLE";

    // ─── Submodule 3.2 — Creative Direction ──────────────────────────────────
    public static final String MOD32_CREATIVE_GENERATION_FAILED  = "MOD32_CREATIVE_GENERATION_FAILED";
    public static final String MOD32_CREATIVE_MISSING_DEPENDENCY = "MOD32_CREATIVE_MISSING_DEPENDENCY";
    public static final String MOD32_CREATIVE_STORED             = "MOD32_CREATIVE_STORED";
    public static final String MOD32_CREATIVE_APPROVED           = "MOD32_CREATIVE_APPROVED";

    // ─── Shared gateway / deserialisation errors ──────────────────────────────
    public static final String MOD3_CONTENT_GATEWAY_TIMEOUT     = "MOD3_CONTENT_GATEWAY_TIMEOUT";
    public static final String MOD3_CONTENT_GATEWAY_5XX         = "MOD3_CONTENT_GATEWAY_5XX";
    public static final String MOD3_CONTENT_DESERIALIZE_FAIL    = "MOD3_CONTENT_DESERIALIZE_FAIL";

    public static final String MOD3_CREATIVE_GATEWAY_TIMEOUT    = "MOD3_CREATIVE_GATEWAY_TIMEOUT";
    public static final String MOD3_CREATIVE_GATEWAY_5XX        = "MOD3_CREATIVE_GATEWAY_5XX";
    public static final String MOD3_CREATIVE_DESERIALIZE_FAIL   = "MOD3_CREATIVE_DESERIALIZE_FAIL";

    public static final String MOD3_COMPLIANCE_GATEWAY_TIMEOUT  = "MOD3_COMPLIANCE_GATEWAY_TIMEOUT";
    public static final String MOD3_COMPLIANCE_GATEWAY_5XX      = "MOD3_COMPLIANCE_GATEWAY_5XX";
    public static final String MOD3_COMPLIANCE_VALIDATION       = "MOD3_COMPLIANCE_VALIDATION";
    public static final String MOD3_COMPLIANCE_STORED           = "MOD3_COMPLIANCE_STORED";
    public static final String MOD33_OMCS_AGENT_FAILED          = "MOD33_OMCS_AGENT_FAILED";
}
