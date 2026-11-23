package com.ceview.module1.businessinput;

import com.ceview.module1.businessinput.dto.BusinessProfileDto;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Server-side rules for the structured Business Story / UVP answers. Mirrors
 * frontend/components/module-1/structured-profile/profileTemplates.ts (MIN_CHARS,
 * structuredValid, withLegacyFlags) — change both together.
 */
public final class StructuredInputs {

    static final int MIN_SHORT = 3;
    static final int MIN_LONG = 20;

    private StructuredInputs() {}

    /**
     * All-or-nothing: every answer blank (a profile from before structured inputs) or every answer
     * meeting its minimum, counted after trimming. When answers are given, the composed paragraphs
     * must not be blank either.
     *
     * @throws ResponseStatusException 400 naming the first offending field
     */
    public static void validate(BusinessProfileDto in) {
        Map<String, Integer> minimums = new LinkedHashMap<>();
        Map<String, String> answers = new LinkedHashMap<>();
        put(answers, minimums, "storyBusinessType", in.storyBusinessType(), MIN_SHORT);
        put(answers, minimums, "storyLocation", in.storyLocation(), MIN_SHORT);
        put(answers, minimums, "storyExperience", in.storyExperience(), MIN_LONG);
        put(answers, minimums, "storyFacilities", in.storyFacilities(), MIN_LONG);
        put(answers, minimums, "uvpDistinguisher", in.uvpDistinguisher(), MIN_LONG);
        put(answers, minimums, "uvpSupportingFact", in.uvpSupportingFact(), MIN_LONG);
        put(answers, minimums, "uvpGuestBenefit", in.uvpGuestBenefit(), MIN_LONG);

        if (answers.values().stream().allMatch(StructuredInputs::isBlank)) return;

        for (var answer : answers.entrySet()) {
            int min = minimums.get(answer.getKey());
            if (trimmedLength(answer.getValue()) < min) {
                throw badRequest(answer.getKey() + " must be at least " + min
                    + " characters (structured answers are all required, or all blank)");
            }
        }
        if (isBlank(in.description())) throw badRequest("description must not be blank when structured answers are given");
        if (isBlank(in.uvp())) throw badRequest("uvp must not be blank when structured answers are given");
    }

    /**
     * Whether a paragraph counts as hand-edited: flagged so by the client, or prose with no answers
     * behind it — which no template produced, so nothing may overwrite it.
     */
    public static boolean edited(Boolean flagged, String paragraph, String... answers) {
        if (Boolean.TRUE.equals(flagged)) return true;
        if (isBlank(paragraph)) return false;
        for (String a : answers) if (!isBlank(a)) return false;
        return true;
    }

    private static void put(Map<String, String> answers, Map<String, Integer> minimums,
                            String name, String value, int min) {
        answers.put(name, value);
        minimums.put(name, min);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static int trimmedLength(String s) {
        return s == null ? 0 : s.strip().length();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
