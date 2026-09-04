package com.ceview.ai;

import java.util.Map;

/**
 * A FastAPI dependency failure, carried to the browser without re-wording.
 *
 * <p>The `cause` string is authored by the service that knows why (see each
 * service's app/unavailable.py) and passes through Spring untouched. The only
 * thing Spring adds is its own hop on `stage`, so the chain is visible.
 *
 * <p>Note {@code getCause2()} rather than {@code getCause()} — {@link Throwable}
 * already owns that name for a different purpose.
 */
public class AiDependencyException extends RuntimeException {

    private final int status;
    private final String code;
    private final String dependency;
    private final String causeText;
    private final String stage;

    private AiDependencyException(
            int status, String code, String message, String dependency, String causeText, String stage) {
        super(message);
        this.status = status;
        this.code = code;
        this.dependency = dependency;
        this.causeText = causeText;
        this.stage = stage;
    }

    /**
     * Builds one from a FastAPI error body. A body that does not carry the
     * contract still produces an exception naming the transport failure — it is
     * never collapsed into a generic "something went wrong".
     *
     * <p>The {@code cause} taken from the body is passed through unmodified by
     * design and must not be truncated or re-worded: FastAPI authored it and is the
     * hop that knows why. The truncation in {@link #unreachable(String, Throwable)}
     * is deliberately asymmetric with this — it applies only where Spring itself
     * authors the cause from an unbounded exception message.
     */
    public static AiDependencyException fromBody(int status, Map<String, Object> body, String springPath) {
        String code = str(body, "code");
        String upstreamStage = str(body, "stage");

        if (code == null) {
            return new AiDependencyException(
                    status,
                    "AI_SERVICE_UNREACHABLE",
                    "The AI service did not respond with a usable error.",
                    "fastapi",
                    "HTTP " + status + " with no unavailability body",
                    "spring/" + springPath);
        }

        return new AiDependencyException(
                status,
                code,
                str(body, "message"),
                str(body, "dependency"),
                str(body, "cause"),
                upstreamStage == null
                        ? "spring/" + springPath
                        : upstreamStage + " -> spring/" + springPath);
    }

    /**
     * The service never answered at all — connection refused, DNS failure, socket
     * reset. There is no body to pass through, so Spring authors the cause itself;
     * this is the one place it is allowed to, because it is the hop that knows.
     *
     * <p>Carries the same {@code AI_SERVICE_UNREACHABLE} code as a contract-less
     * HTTP response, so the frontend sees one code for "the service did not answer
     * usefully", and {@code dependency = "fastapi"} — which the docs map to
     * "run {@code docker compose ps}, then {@code docker compose logs <service>}".
     */
    public static AiDependencyException unreachable(String springPath, Throwable failure) {
        return new AiDependencyException(
                503,
                "AI_SERVICE_UNREACHABLE",
                "The AI service could not be reached.",
                "fastapi",
                truncate(failure),
                "spring/" + springPath);
    }

    /**
     * The service accepted the connection and then said nothing until the call's
     * timeout expired. The caller has already authored the cause — it knows which
     * bound expired — so unlike a raw exception message it is used verbatim.
     *
     * <p>Named distinctly from {@link #unreachable(String, Throwable)} rather than
     * overloaded on it: that overload truncates to 200 chars, this one does not, and
     * the two are selected only by argument type. A future {@code unreachable(path,
     * ex.getMessage())} would silently skip the truncation this class documents as
     * deliberate — the distinct name makes that mistake harder to make by accident.
     */
    public static AiDependencyException unreachableAfterTimeout(String springPath, String cause) {
        return new AiDependencyException(
                503,
                "AI_SERVICE_UNREACHABLE",
                "The AI service could not be reached.",
                "fastapi",
                cause,
                "spring/" + springPath);
    }

    /**
     * Mirrors the truncation established in fastapi-sbert's AgentLLMModel: the
     * exception type name plus at most 200 characters of its message. A connection
     * exception's text reaches the browser, and can be long.
     */
    private static String truncate(Throwable failure) {
        if (failure == null) return "unknown transport failure";
        String detail = failure.getMessage() == null ? "" : failure.getMessage();
        if (detail.length() > 200) detail = detail.substring(0, 200) + "… (truncated)";
        return failure.getClass().getSimpleName() + ": " + detail;
    }

    private static String str(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof String s ? s : null;
    }

    public Map<String, Object> toBody() {
        return Map.of(
                "code", code,
                "message", getMessage() == null ? "" : getMessage(),
                "dependency", dependency == null ? "" : dependency,
                "cause", causeText == null ? "" : causeText,
                "stage", stage == null ? "" : stage);
    }

    public int getStatus()        { return status; }
    public String getCode()       { return code; }
    public String getDependency() { return dependency; }
    public String getCause2()     { return causeText; }
    public String getStage()      { return stage; }
}
