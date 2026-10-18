package com.ceview.email;

/** A transactional email: HTML body plus a plain-text fallback. */
public record EmailMessage(String to, String subject, String html, String text) {}
