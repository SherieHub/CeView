#!/usr/bin/env python3
"""Per-category cosine-distance calibration report over the seeded uniqueness corpus.

WHY THIS EXISTS
02-scoring-math.md Task 6 replaces the old ``min(mean_dist / 0.5, 1) * 100``
scaling with a percentile transform. This report measures what the per-category
within-cohort distance distributions in the *seeded* corpus actually look like,
so that choice is grounded in the real data rather than assumed. It reads only
the V26 / ``uniqueness-corpus.sql`` corpus — it does NOT import Task 6's code,
and it can be run before Task 6 lands (to justify it) or after (to confirm it
worked; see "AFTER TASK 6" below).

WHAT IT REPORTS, per category
  - n businesses, and the number of unordered pairs among them
  - the pairwise cosine-distance distribution: min, median, mean, p90, max
  - the score range the OLD formula would have produced: for each business,
    ``min(mean_distance_to_cohort / 0.5, 1) * 100``; the range is [min, max]
    across the category's businesses. This quantifies the compression band.
  - the density tier the category falls in

If the observed per-category score ranges are wide (say one category spanning
~20–80) rather than compressed into a narrow low band, that CONTRADICTS the
premise of Task 6 and is called out in the output and the written findings —
the plan would need revisiting before it ships.

HOW TO RUN
Inside the fastapi container, which already has psycopg2 and DATABASE_URL:

    docker exec -i ceview-fastapi python - < scripts/uniqueness-calibration-report.py

Or locally, against a database that has the corpus imported (migrate V26, then
psql -f the dump — see RUNNING.md §5a):

    DATABASE_URL=postgresql://ceview:ceview@localhost:5433/ceview \
        python scripts/uniqueness-calibration-report.py

    python scripts/uniqueness-calibration-report.py --self-test

        Run the distance-math assertions and exit. No database needed.

    python scripts/uniqueness-calibration-report.py --from-dump

        Read the vectors straight out of the committed SQL — V26 for the
        id -> category map, db/dump/uniqueness-corpus.sql for the vectors —
        and run the identical analysis with no database at all. This is what
        keeps the findings reproducible from a plain checkout; a --from-dump
        run and a live DB run over the same corpus produce the same numbers.

OUTPUT
  - stdout: the table and the verdict
  - docs/module-1/uniqueness-calibration.md: the committed findings, rewritten
    in full on every run so the numbers in the repo always match a real corpus.

AFTER TASK 6
Re-run this once Task 6 (percentile transform) has merged. The acceptance
criterion for the whole plan is that per-category *score* distributions then
span a usable range instead of clustering in the old ~20–80 band. Append the
new run under the "After Task 6" heading in the findings doc.
"""
from __future__ import annotations

import math
import os
import re
import statistics
import sys
from pathlib import Path

# Importable whether launched from the repo root or from backend/fastapi-sbert
# (mirrors scripts/generate-reference-corpus.py).
for candidate in (Path.cwd(), Path.cwd() / "backend" / "fastapi-sbert", Path("/app")):
    if (candidate / "app" / "services" / "embedding_store.py").exists():
        sys.path.insert(0, str(candidate))
        break

REPO_ROOT = Path(__file__).resolve().parents[1]
FINDINGS_PATH = Path("docs/module-1/uniqueness-calibration.md")
V26_PATH = REPO_ROOT / "backend/spring-boot/src/main/resources/db/migration/V26__module1_reference_corpus.sql"
DUMP_PATH = REPO_ROOT / "backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql"

# The old semantic-distinctiveness scaling: mean cosine distance to the cohort,
# with 0.5 treated as a perfect score. Duplicated here on purpose — this report
# measures what it *would* produce and must not move if the live formula changes.
OLD_FORMULA_PERFECT_DISTANCE = 0.5

SELECT_REFERENCE_EMBEDDINGS = """
    SELECT p.categories,
           p.business_name,
           e.embedding_vector::text,
           e.embedding_model_version
    FROM   tbl_business_embedding e
    JOIN   tbl_business_profile p USING (business_profile_id)
    WHERE  p.is_reference = TRUE
    ORDER  BY p.categories, p.business_name
"""


# ── distance math (pure, dependency-free, self-tested) ─────────────────────────

def cosine_distance(a: list[float], b: list[float]) -> float:
    """1 - cosine similarity. 0.0 = identical direction, 1.0 = orthogonal."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        raise ValueError("cosine_distance undefined for a zero vector")
    return 1.0 - dot / (na * nb)


def pairwise_distances(vectors: list[list[float]]) -> list[float]:
    """Every unordered pair's cosine distance — n*(n-1)/2 values."""
    out: list[float] = []
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            out.append(cosine_distance(vectors[i], vectors[j]))
    return out


def per_business_mean_distance(vectors: list[list[float]]) -> list[float]:
    """For each business, its mean cosine distance to the others in its cohort.

    This is the quantity the old formula scaled — one score per business.
    """
    means: list[float] = []
    for i, vi in enumerate(vectors):
        others = [cosine_distance(vi, vj) for j, vj in enumerate(vectors) if j != i]
        means.append(statistics.fmean(others) if others else 0.0)
    return means


def old_formula_score(mean_distance: float) -> float:
    """min(mean_distance / 0.5, 1) * 100 — the pre-percentile distinctiveness score."""
    return min(mean_distance / OLD_FORMULA_PERFECT_DISTANCE, 1.0) * 100.0


def summarize(values: list[float]) -> dict[str, float]:
    """min / median / mean / p90 / max of a non-empty list."""
    if not values:
        raise ValueError("summarize needs at least one value")
    ordered = sorted(values)
    if len(ordered) >= 2:
        # linear-interpolation p90, consistent with numpy's default percentile
        pos = 0.9 * (len(ordered) - 1)
        lo = math.floor(pos)
        hi = math.ceil(pos)
        p90 = ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)
    else:
        p90 = ordered[0]
    return {
        "min": ordered[0],
        "median": statistics.median(ordered),
        "mean": statistics.fmean(ordered),
        "p90": p90,
        "max": ordered[-1],
    }


# ── density tiers ─────────────────────────────────────────────────────────────
#
# Derived from each category's business count, NOT from a hardcoded list of
# category names. These cutoffs reproduce V26's documented grouping (12 -> dense,
# 9 -> moderate, 5 -> sparse); the authoritative tier boundaries belong to
# 02-scoring-math.md Task 8 and this report should be reconciled with them.

def density_tier(n: int) -> str:
    if n >= 10:
        return "dense"
    if n >= 6:
        return "moderate"
    return "sparse"


# ── data loading ─────────────────────────────────────────────────────────────

def load_corpus() -> dict[str, list[tuple[str, list[float]]]]:
    """{category: [(business_name, vector), ...]} for every is_reference row.

    A reference row with a comma-joined multi-category value is counted under
    each category it lists; V26 seeds one category per row, so that is the
    common case.
    """
    import json

    from app.services import embedding_store  # noqa: E402  (deferred: needs sys.path)

    conn = embedding_store._connect()
    try:
        cur = conn.cursor()
        cur.execute(SELECT_REFERENCE_EMBEDDINGS)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    if not rows:
        raise SystemExit(
            "No is_reference embeddings found. Apply V26 and import "
            "db/dump/uniqueness-corpus.sql first (see RUNNING.md §5a)."
        )

    versions = {version for _, _, _, version in rows}
    if len(versions) > 1:
        raise SystemExit(
            f"Refusing to report on a mixed-scheme corpus: {sorted(versions)}. "
            "Vectors built with different embedding_model_versions are not "
            "comparable — regenerate with scripts/generate-reference-corpus.py --all."
        )

    by_category: dict[str, list[tuple[str, list[float]]]] = {}
    for categories, name, vec_text, _version in rows:
        parsed = json.loads(vec_text)
        if not (isinstance(parsed, list) and len(parsed) == 768):
            raise SystemExit(f"malformed embedding for {name!r} (len={len(parsed)})")
        vector = [float(x) for x in parsed]
        for category in (c.strip() for c in (categories or "").split(",") if c.strip()):
            by_category.setdefault(category, []).append((name, vector))
    return by_category


# ── data loading — from the committed SQL, no database ────────────────────────

def _split_sql_tuple(body: str) -> list[str]:
    """Split one ``(a, 'b,c', NULL)`` VALUES tuple into its top-level fields.

    Respects single-quoted string literals with ``''`` escaping, so commas and
    parentheses inside prose do not split a field.
    """
    fields: list[str] = []
    buf: list[str] = []
    in_str = False
    i = 0
    while i < len(body):
        ch = body[i]
        if in_str:
            if ch == "'" and i + 1 < len(body) and body[i + 1] == "'":
                buf.append("'")
                i += 2
                continue
            if ch == "'":
                in_str = False
                buf.append(ch)
            else:
                buf.append(ch)
        elif ch == "'":
            in_str = True
            buf.append(ch)
        elif ch == ",":
            fields.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
        i += 1
    if buf:
        fields.append("".join(buf).strip())
    return fields


def _unquote(sql_literal: str) -> str:
    s = sql_literal.strip()
    if s.startswith("'") and s.endswith("'"):
        return s[1:-1].replace("''", "'")
    return s


def _iter_values_tuples(sql: str, insert_marker: str):
    """Yield each ``( … )`` tuple that follows the VALUES of *insert_marker*."""
    start = sql.index(insert_marker)
    scan = sql.index("VALUES", start) + len("VALUES")
    depth = 0
    in_str = False
    buf: list[str] = []
    i = scan
    while i < len(sql):
        ch = sql[i]
        if in_str:
            if ch == "'" and i + 1 < len(sql) and sql[i + 1] == "'":
                buf.append("''")
                i += 2
                continue
            buf.append(ch)
            if ch == "'":
                in_str = False
        elif ch == "'":
            in_str = True
            buf.append(ch)
        elif ch == "(":
            depth += 1
            if depth == 1:
                buf = []
            else:
                buf.append(ch)
        elif ch == ")":
            depth -= 1
            if depth == 0:
                yield "".join(buf)
            else:
                buf.append(ch)
        elif ch == ";" and depth == 0:
            return
        elif depth >= 1:
            buf.append(ch)
        i += 1


# V26 column order for tbl_business_profile inserts.
_V26_ID = 0
_V26_NAME = 2
_V26_CATEGORIES = 7

_DUMP_ROW = re.compile(
    r"VALUES\s*\(\s*gen_random_uuid\(\)\s*,\s*'([0-9a-fA-F-]{36})'\s*,\s*'(\[[^\]]*\])'::vector\s*,\s*'([^']*)'"
)


def load_corpus_from_dump() -> dict[str, list[tuple[str, list[float]]]]:
    """Same shape as load_corpus(), built from V26 + the committed vector dump.

    V26 seeds the profile text (id -> name, category); the dump seeds the
    vectors (id -> embedding). Joined here so the report needs neither a
    database nor the E5 encoder.
    """
    if not V26_PATH.exists() or not DUMP_PATH.exists():
        raise SystemExit(f"expected {V26_PATH} and {DUMP_PATH} to exist")

    v26 = V26_PATH.read_text(encoding="utf-8")
    meta: dict[str, tuple[str, list[str]]] = {}
    for tuple_body in _iter_values_tuples(v26, "INSERT INTO tbl_business_profile"):
        cols = _split_sql_tuple(tuple_body)
        if len(cols) < 8:
            continue
        profile_id = _unquote(cols[_V26_ID])
        name = _unquote(cols[_V26_NAME])
        categories = [c.strip() for c in _unquote(cols[_V26_CATEGORIES]).split(",") if c.strip()]
        meta[profile_id] = (name, categories)

    dump = DUMP_PATH.read_text(encoding="utf-8")
    versions: set[str] = set()
    vectors: dict[str, list[float]] = {}
    for match in _DUMP_ROW.finditer(dump):
        profile_id, vec_text, version = match.group(1), match.group(2), match.group(3)
        versions.add(version)
        parsed = [float(x) for x in vec_text[1:-1].split(",") if x.strip()]
        if len(parsed) != 768:
            raise SystemExit(f"dump vector for {profile_id} has {len(parsed)} dims, expected 768")
        vectors[profile_id] = parsed

    if not vectors:
        raise SystemExit(f"no embedding INSERTs matched in {DUMP_PATH}")
    if len(versions) > 1:
        raise SystemExit(f"dump holds mixed embedding_model_versions: {sorted(versions)}")

    missing = [pid for pid in vectors if pid not in meta]
    if missing:
        raise SystemExit(f"dump has vectors with no V26 text row: {missing[:3]}…")

    by_category: dict[str, list[tuple[str, list[float]]]] = {}
    for profile_id, vector in vectors.items():
        name, categories = meta[profile_id]
        for category in categories:
            by_category.setdefault(category, []).append((name, vector))
    return by_category


# ── report assembly ──────────────────────────────────────────────────────────

def build_report(by_category: dict[str, list[tuple[str, list[float]]]]) -> dict:
    total = sum(len(v) for v in by_category.values())
    categories = []
    for category, members in sorted(by_category.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        vectors = [vec for _, vec in members]
        n = len(vectors)
        if n < 2:
            categories.append({
                "category": category, "n": n, "pairs": 0, "distances": None,
                "old_score_range": None, "tier": density_tier(n),
                "note": "too few rows to form a pair",
            })
            continue
        distances = summarize(pairwise_distances(vectors))
        business_scores = [old_formula_score(m) for m in per_business_mean_distance(vectors)]
        categories.append({
            "category": category,
            "n": n,
            "pairs": n * (n - 1) // 2,
            "distances": distances,
            "old_score_range": (min(business_scores), max(business_scores)),
            "tier": density_tier(n),
            "share": n / total if total else 0.0,
        })
    highest_old_score = max(
        (c["old_score_range"][1] for c in categories if c["old_score_range"]), default=0.0
    )
    return {
        "total": total,
        "categories": categories,
        # The premise of Task 6 is that the old formula compresses every cohort
        # into a narrow low band. If the best any business can score against its
        # own cohort is still well under half-marks, that premise holds.
        "compression_confirmed": highest_old_score < 50.0,
        "highest_old_score": highest_old_score,
    }


def render_findings(report: dict, source: str) -> str:
    lines: list[str] = []
    w = lines.append
    w("# Uniqueness scoring — corpus calibration")
    w("")
    w("> Generated by `scripts/uniqueness-calibration-report.py` over the seeded")
    w("> reference corpus (`V26__module1_reference_corpus.sql` +")
    w("> `db/dump/uniqueness-corpus.sql`). Re-run it after any change to the corpus,")
    w("> the embedding scheme, or `ml_classifier._build_text`, and after")
    w("> 02-scoring-math.md Task 6 merges. Do not hand-edit the numbers.")
    w(">")
    w(f"> Source for this revision: **{source}**.")
    w("")
    w(f"Corpus size: **{report['total']}** reference businesses.")
    w("")
    w("## Per-category within-cohort cosine distance")
    w("")
    w("| Category | n | pairs | min | median | mean | p90 | max | old-formula score range | tier |")
    w("|---|--:|--:|--:|--:|--:|--:|--:|--:|---|")
    for c in report["categories"]:
        if not c["distances"]:
            w(f"| {c['category']} | {c['n']} | 0 | — | — | — | — | — | — | {c['tier']} |")
            continue
        d = c["distances"]
        lo, hi = c["old_score_range"]
        w(
            f"| {c['category']} | {c['n']} | {c['pairs']} "
            f"| {d['min']:.4f} | {d['median']:.4f} | {d['mean']:.4f} "
            f"| {d['p90']:.4f} | {d['max']:.4f} "
            f"| {lo:.1f} – {hi:.1f} | {c['tier']} |"
        )
    w("")
    w("`old-formula score range` is `min(mean_distance / 0.5, 1) × 100` applied to")
    w("each business's *own* mean distance to its cohort — the actual score the old")
    w("`semanticsScore` would have handed the least- and most-distinct business in")
    w("the category. (The table in `00-index.md` runs the same formula over the")
    w("min/max *pairwise* distances instead, so its range is wider; both show the")
    w("same compression.) This is the metric the plan replaces with a percentile rank.")
    w("")
    w("## Verdict")
    w("")
    if report["compression_confirmed"]:
        w(
            f"**Compression confirmed.** The most distinct business in any category "
            f"scores only **{report['highest_old_score']:.1f}** against its own cohort "
            f"under the old formula. Same-domain profiles sit in a narrow distance "
            f"band this encoder cannot widen (see "
            f"`00-index.md` → *CORRECTION — the E5 prefix is not the cause*), so a "
            f"percentile rank against the cohort's own distribution — Task 6 — is "
            f"doing 100% of the interpretive work. Nothing downstream may assume the "
            f"raw score spread is usable."
        )
    else:
        w(
            f"**⚠️ Premise not supported — flag to Dev B.** At least one category's "
            f"old-formula score reaches **{report['highest_old_score']:.1f}**, i.e. the "
            f"raw distance spread is not as compressed as 02-scoring-math.md assumes. "
            f"Task 6 needs revisiting before it ships — a percentile transform on top "
            f"of an already-usable spread would distort more than it fixes."
        )
    w("")
    w("## Density tiers")
    w("")
    w("Derived from each category's share of the corpus (count-based cutoffs:")
    w("`n ≥ 10` dense, `6–9` moderate, `≤ 5` sparse), reproducing V26's documented")
    w("grouping. The authoritative boundaries belong to 02-scoring-math.md Task 8;")
    w("reconcile this table with that task's output.")
    w("")
    w("| Tier | Categories |")
    w("|---|---|")
    for tier in ("dense", "moderate", "sparse"):
        names = [c["category"] for c in report["categories"] if c["tier"] == tier]
        w(f"| {tier} | {', '.join(names) if names else '—'} |")
    w("")
    w("## After Task 6")
    w("")
    w("_Not yet run against the percentile transform. Re-run this script once")
    w("02-scoring-math.md Task 6 has merged and record the new per-category score")
    w("distributions here — the whole-plan acceptance criterion is that they span a")
    w("usable range instead of the old narrow band._")
    w("")
    return "\n".join(lines)


# ── self-test ────────────────────────────────────────────────────────────────

def _self_test() -> None:
    assert abs(cosine_distance([1.0, 0.0], [1.0, 0.0])) < 1e-12
    assert abs(cosine_distance([1.0, 0.0], [0.0, 1.0]) - 1.0) < 1e-12
    assert abs(cosine_distance([1.0, 0.0], [1.0, 1.0]) - (1.0 - 1.0 / math.sqrt(2))) < 1e-12

    assert old_formula_score(0.5) == 100.0
    assert old_formula_score(1.0) == 100.0          # clamped
    assert old_formula_score(0.1) == 20.0
    assert old_formula_score(0.0) == 0.0

    assert pairwise_distances([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]]).__len__() == 3

    s = summarize([1.0, 2.0, 3.0, 4.0, 5.0])
    assert s["min"] == 1.0 and s["max"] == 5.0
    assert s["mean"] == 3.0 and s["median"] == 3.0
    assert abs(s["p90"] - 4.6) < 1e-9

    means = per_business_mean_distance([[1.0, 0.0], [1.0, 0.0], [0.0, 1.0]])
    assert abs(means[0] - means[1]) < 1e-12          # the two identical vectors are symmetric

    assert density_tier(12) == "dense"
    assert density_tier(9) == "moderate"
    assert density_tier(5) == "sparse"

    print("self-test: all assertions passed")


# ── entrypoint ───────────────────────────────────────────────────────────────

def main() -> None:
    if "--self-test" in sys.argv:
        _self_test()
        return

    if "--from-dump" in sys.argv:
        source = "committed SQL (V26 + db/dump/uniqueness-corpus.sql), no database"
        print(f"reading corpus from {DUMP_PATH.name} + {V26_PATH.name}")
        by_category = load_corpus_from_dump()
    else:
        source = "live database (tbl_business_embedding)"
        print(f"DATABASE_URL: {'set' if os.environ.get('DATABASE_URL') else 'MISSING'}")
        by_category = load_corpus()

    report = build_report(by_category)

    print(f"\n{report['total']} reference businesses\n")
    header = f"{'category':<28} {'n':>3} {'min':>7} {'median':>7} {'mean':>7} {'p90':>7} {'max':>7}  old-score range"
    print(header)
    print("-" * len(header))
    for c in report["categories"]:
        if not c["distances"]:
            print(f"{c['category']:<28} {c['n']:>3}  (too few for a pair)")
            continue
        d = c["distances"]
        lo, hi = c["old_score_range"]
        print(
            f"{c['category']:<28} {c['n']:>3} "
            f"{d['min']:>7.4f} {d['median']:>7.4f} {d['mean']:>7.4f} {d['p90']:>7.4f} {d['max']:>7.4f}"
            f"  {lo:5.1f} – {hi:5.1f}   [{c['tier']}]"
        )

    verdict = (
        "compression confirmed — percentile ranking must do the work"
        if report["compression_confirmed"]
        else "PREMISE NOT SUPPORTED — flag to Dev B (see findings doc)"
    )
    print(f"\nverdict: {verdict}")

    out = REPO_ROOT / FINDINGS_PATH
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_findings(report, source), encoding="utf-8", newline="\n")
    print(f"wrote {FINDINGS_PATH}")


if __name__ == "__main__":
    main()
