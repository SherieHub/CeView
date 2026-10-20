package com.ceview.email;

/**
 * The two transactional emails. Inline-styled HTML (email clients ignore stylesheets) plus a
 * plain-text twin. Colors follow the CeView brand palette (deep teal header, amber code).
 */
public final class EmailTemplates {

    private static final String BRAND = "CeView";

    private EmailTemplates() {}

    public static EmailMessage verificationCode(String to, String firstName, String code, int ttlMinutes) {
        return build(to,
            "Your CeView verification code",
            "Verify your email",
            "Hi " + name(firstName) + ", enter this code in CeView to confirm your email address.",
            code, ttlMinutes,
            "If you did not create a CeView account, you can safely ignore this email.");
    }

    public static EmailMessage passwordReset(String to, String firstName, String code, int ttlMinutes) {
        return build(to,
            "Reset your CeView password",
            "Reset your password",
            "Hi " + name(firstName) + ", enter this code in CeView to choose a new password.",
            code, ttlMinutes,
            "If you did not ask to reset your password, you can safely ignore this email. Your password has not changed.");
    }

    private static EmailMessage build(String to, String subject, String heading, String intro,
                                      String code, int ttlMinutes, String footer) {
        String expiry = "This code expires in " + ttlMinutes + " minutes. Never share it with anyone.";
        String text = BRAND + "\n\n" + heading + "\n\n" + intro + "\n\nYour code: " + code + "\n\n"
            + expiry + "\n\n" + footer + "\n";
        String html = """
            <!doctype html>
            <html><body style="margin:0;padding:24px;background:#f4f7f7;font-family:Arial,Helvetica,sans-serif;color:#1f2d2d;">
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr><td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;">
                  <tr><td style="background:#0f4c4c;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold;">%s</td></tr>
                  <tr><td style="padding:28px;">
                    <h1 style="margin:0 0 12px;font-size:20px;color:#0f4c4c;">%s</h1>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">%s</p>
                    <p style="margin:0 0 20px;text-align:center;">
                      <span style="display:inline-block;padding:14px 24px;border-radius:8px;background:#fff4e0;color:#8a5200;font-size:32px;font-weight:bold;letter-spacing:8px;">%s</span>
                    </p>
                    <p style="margin:0 0 16px;font-size:13px;color:#4a5a5a;">%s</p>
                    <p style="margin:0;font-size:12px;color:#7a8888;">%s</p>
                  </td></tr>
                </table>
              </td></tr></table>
            </body></html>
            """.formatted(BRAND, escape(heading), escape(intro), code, escape(expiry), escape(footer));
        return new EmailMessage(to, subject, html, text);
    }

    private static String name(String firstName) {
        return firstName == null || firstName.isBlank() ? "there" : firstName.trim();
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
