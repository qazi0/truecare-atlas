# Wow Moments — TrueCare Atlas

Three judge-facing moments, budgeted ≤2h each. Built in Phase 6.

## W1. Trust Score Ring Fill + Evidence Bullets (60 min)

On facility selection, an SVG `<circle>` ring grows from 0 → score over 900ms (stroke-dashoffset interpolation). Simultaneously, evidence bullets stagger-fade in at 100ms intervals, each with its underlined source quote. Judges watch the trust score build before their eyes, tied directly to cited reasons.

## W2. Desert Map Capability Bloom (90 min)

Initial state: India is pale grey ("capability desert"). User clicks a capability pill (e.g., Oncology). Choropleth bloom: each state's color interpolates from grey → scored color over 1.5s, regions filling roughly N→S (latitude-sorted). This single moment communicates "we turned 10K rows of mess into a usable, color-graded map" without a word.

## W3. Contradiction Tug-of-War (45 min)

On a flagged facility (e.g., Agasthiyar Siddha + medicalOncology), the trust panel renders contradicting quotes side-by-side. They "tug" each other: the supporting quote pulses green, the contradicting quote pulses red, with a tiny SVG arrow oscillating between them for 2 cycles then stilling. Beneath: the rule ID and explanation. This earns "your trust scorer is actually thinking" from the MIT Trust Center judge.
