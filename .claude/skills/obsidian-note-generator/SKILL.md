---
name: obsidian-note-generator
description: Use when generating structured Obsidian notes from source material such as PDFs, books, or study guides — for hierarchical topic organization, certification study, or visual mental mapping across sections and subsections.
---

# Obsidian Note Generator

## Overview
For every section (or subsection), produce **two paired outputs inside a dedicated folder**: a `.md` reading note for linear study and a `.canvas` mental map for visual navigation. Both are always generated together — never one without the other.

---

## Output Structure (Per Section)

```
My Mind/Certifications/<Topic>/
  Section 2 - Cloud Concepts/
    Section 2 - Cloud Concepts.md       ← reading note
    Section 2 - Cloud Concepts.canvas   ← mental map
  Section 3 - Azure Architecture/
    Section 3 - Azure Architecture.md
    Section 3 - Azure Architecture.canvas
```

- One **folder** per section (or subsection if the section is large)
- Folder name = Section number + title, e.g., `Section 2 - Cloud Concepts`
- Both files inside share the same base name as the folder
- All vault paths are relative — never absolute

---

## Required Inputs

| Input | Purpose |
|---|---|
| Source material (PDF, text) | Raw content to extract and summarize |
| Section/subsection boundaries | Which pages or headings map to which folder |
| Vault save path | Vault-relative parent folder |
| Color preference | Monotone (default) unless user specifies |
| Hierarchy depth | As many levels as content requires — never fixed |

**Before building:** If section boundaries or subsection breakdown are unclear, ask the user. Do not assume.

---

## Output 1 — Reading Note (`.md`)

### Format

```markdown
---
tags:
  - <topic>
  - <certification>
  - <section-keyword>
section: <number>
---

# Section N — Title

## Main Topic
- **Sub-concept**
      - Definition: 2–3 sentence explanation of the concept's purpose.

## Another Main Topic
- **Sub-concept**
      - Definition: ...

---
*Connected notes:* [[Next Section Folder/Next Section.md]]
```

### Markdown Rules

- **YAML frontmatter** — always include `tags` and `section` fields
- **`##` headers** — one per major topic cluster (mirrors L1 in canvas)
- **`- **Term**`** — bold bullet for each named concept (mirrors L2 in canvas)
  - **Indented definition** — 2–3 sentences directly below the term bullet
- **Hard limit** — never exceed 3 sentences per definition; if more is needed, add a nested sub-bullet
- **Connected notes** — always link to the next section's `.md` at the bottom
- Do not copy verbatim text — always rewrite into concise definitions

---

## Output 2 — Mental Map (`.canvas`)

### Hierarchy Levels

| Level | Role | Content |
|---|---|---|
| **L0** | Root | Section title + exam weight/overview — 1 card, center-top |
| **L1** | Branch | Major topic cluster — title + one-sentence description |
| **L2** | Leaf | `### Term` header + 2–3 sentence definition |
| **L3+** | Sub-leaf | Add only when a concept has distinct sub-concepts that clutter L2 |

**Depth rule:** Use as many levels as content needs to stay neat. Never cap at L2. Never add levels without content reason.

**Self-contained rule:** If a topic is simple with no children, embed the definition in the L1 card and skip L2.

### Card Content Rules

- **L0 / L1:** Title + one-sentence cluster description. No full definitions.
- **L2+:** `### Term Name` header + 2–3 sentences max.
- **Service/tool cards:** Add `**Examples:**` line after the definition.
- **Hard limit:** 3 sentences per card. More content → break into child cards.

### Color Rules

- **Default (monotone):** Omit `color` field entirely — Obsidian renders black and white.
- **If color is requested:** Use `"1"`–`"6"` only (Obsidian's 6 built-in slots).
  - One color per L1 branch; children inherit parent color.
  - `"1"` red · `"2"` orange · `"3"` yellow · `"4"` green · `"5"` teal · `"6"` purple
- Never use hex values — Obsidian Canvas does not support them.

### Layout & Positioning

```
L0 Root:   x=0, y=-200,  w=500, h=160    (center-top anchor)
L1 nodes:  y=80,          spaced 2000px apart center-to-center horizontally
L2 nodes:  y=370,         spaced 500px apart, centered under their L1 parent
L3+ nodes: add 300px vertically per additional level
```

**Overlap check (required):** After placing L2 nodes, verify:
```
rightmost_child_right_edge < next_branch_leftmost_child_left_edge
```
If they overlap, increase L1 spacing. 2000px handles most cases; go wider for branches with 4+ children.

**Edge rule:** All edges use `"fromSide": "bottom"` → `"toSide": "top"`. Root → all L1s. Each L1 → its direct children only.

---

## Do's

- Always produce both `.md` and `.canvas` — never one without the other
- Always wrap both files in a named section folder
- Use `###` headers in canvas cards so terms read at any zoom level
- Add emoji to canvas headers for fast visual scanning at low zoom
- Mirror the same hierarchy depth in both outputs
- Self-contain simple leaf concepts in their L1 card (canvas) or term bullet (md)
- Link the `.md` note to the next section at the bottom

## Don'ts

- Don't produce only a canvas or only a note — both are required per section
- Don't place files loose in the parent folder — always use a section subfolder
- Don't use absolute paths anywhere in vault file references
- Don't exceed 3 sentences per card or definition
- Don't cap hierarchy at a fixed depth — let content decide
- Don't assign colors unless the user requests them
- Don't cram multiple sections into one folder or one canvas

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Only canvas, no `.md` note | Always generate both outputs |
| Files dumped in parent folder | Wrap in `Section N - Title/` subfolder |
| Canvas cards overlap at L2 | Increase L1 center-to-center spacing (2000px+) |
| Definitions exceed 3 sentences | Cut to 3; push extras into L3 child cards / sub-bullets |
| Absolute paths in file/link references | Always use vault-relative paths |
| Hex color values in canvas | Use `"1"`–`"6"` only, or omit color entirely |
| Fixed depth regardless of content | Ask: does this concept have distinct sub-parts? If yes, add a level |
