package com.ceview.module1.uniquenessscoring.dto;

import org.springframework.lang.Nullable;

import java.util.List;

/** DTOs for Transaction 1.2 — Uniqueness Scoring Dashboard. */
public class UniquenessDtos {

    public record UniquenessRequest(
        /** UUID of the already-saved profile, or null for unsaved drafts.
         *  Passed to FastAPI so the corpus query can exclude the caller's own embedding. */
        @Nullable String businessProfileId,
        String businessName,
        List<String> categories,
        List<String> coreServices,
        String description,
        String uvp
    ) {}

    /**
     * The uniqueness result as rendered on onboarding Step 5.
     *
     * <p>TWO RULES THAT THE TYPES CANNOT EXPRESS, and that this response has
     * previously been got wrong:
     *
     * <ol>
     *   <li>{@code overallScore} equals {@code semanticPercentile}. Nothing
     *       else feeds it.</li>
     *   <li>{@code categoryScore} is <b>not</b> a component of
     *       {@code overallScore}. It is a classification-confidence indicator,
     *       displayed beside the score rather than inside it.</li>
     * </ol>
     *
     * <p>Both rules exist because {@code categoryScore} is a <i>normalised
     * share</i> that sums to 100 across the operator's selected categories:
     * keeping one category yields ~100 mechanically, keeping three yields ~33
     * each. Averaging it into the headline made the score move by tens of
     * points based on how many chips an operator happened to leave selected.
     * It is also not comparable across different numbers of selected
     * categories, so it must never be charted or trended as if it were.
     *
     * <p>See docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/.
     */
    public record UniquenessResponse(
        /** The headline. Always equal to semanticPercentile. */
        int overallScore,

        /** Raw distinctiveness 0-100 (scaled mean cosine distance), retained
         *  for continuity and shown as a subordinate diagnostic. Compressed by
         *  the encoder — see semanticPercentile for the interpretable figure. */
        int semanticsScore,

        /** Classification confidence for the selected categories. NOT part of
         *  overallScore; see the record javadoc. */
        int categoryScore,

        /** Rank of this business against its cohort's own distance
         *  distribution. Self-calibrating, so it stays interpretable even
         *  though raw distances cluster in a narrow band. */
        int semanticPercentile,

        /** How many businesses were actually compared against. Rendered
         *  alongside the score — a percentile without its comparison set is
         *  unreadable. */
        int cohortSize,

        /** Median semanticsScore within that cohort. */
        int cohortMedianScore,

        /** The categories the cohort was drawn from — the operator's selected
         *  categories, echoed back so the UI can name them without guessing. */
        List<String> cohortCategories,

        /** "dense" | "moderate" | "sparse" — derived from the category's share
         *  of the corpus, never from a hardcoded list of category names.
         *  Drives the always-visible density explainer on Step 5. */
        String categoryDensity,

        /** False when the cohort is below the comparison floor. The UI renders
         *  a distinct state for this rather than a number; it is a valid
         *  response, not an error. Previously this case silently returned 100,
         *  indistinguishable from a genuinely outstanding score. */
        boolean sufficientCohort,

        String descriptionFeedback,
        String categoryFeedback
    ) {}
}
