-- Databricks notebook source
-- Phase 3: Trust Scorer — Rules R1-R8 over gold_facility_capabilities + silver_facility
-- Produces workspace.default.gold_facility_trust with per-facility trust score and flags.

-- COMMAND ----------

-- Rule severity weights (higher = more severe deduction)
-- R1 Anesthesia gap: 25
-- R2 NICU staffing gap: 25
-- R3 Cancer specialty gap: 25
-- R4 24/7 gap: 12
-- R5 Bed-count contradiction: 18
-- R6 Modality contradiction: 35
-- R7 Scrape artifact density: 12
-- R8 Evidence sparsity: 15

CREATE OR REPLACE TABLE workspace.default.gold_facility_trust AS

WITH joined AS (
  SELECT
    g.facility_id,
    g.name,
    g.facility_type_id,
    g.state_canon,
    g.city,
    g.pincode,
    g.latitude,
    g.longitude,
    g.facility_class,
    g.capabilities_caption,

    -- Gold capability flags
    g.has_icu, g.has_nicu, g.has_dialysis, g.has_oncology,
    g.has_emergency_surgery, g.has_24x7, g.has_maternity,
    g.has_blood_bank, g.has_anesthesia, g.has_trauma,
    g.has_cardiac_cath_lab,

    -- Gold details for evidence
    g.has_icu_detail, g.has_nicu_detail, g.has_oncology_detail,
    g.has_emergency_surgery_detail, g.has_24x7_detail, g.has_maternity_detail,
    g.has_anesthesia_detail, g.has_trauma_detail,

    -- Silver source fields
    s.description,
    s.specialties,
    s.capabilities,
    s.procedures,
    s.equipment,
    s.capacity,
    s.parsed_bed_count,
    s.number_doctors,
    s.data_quality_flags,
    g.search_text,
    g.extraction_success
  FROM workspace.default.gold_facility_capabilities g
  JOIN workspace.default.silver_facility s ON g.facility_id = s.facility_id
),

rules AS (
  SELECT
    j.*,

    -- R1: Anesthesia gap — claims advanced surgery but no anesthesia evidence
    CASE
      WHEN (has_emergency_surgery OR has_cardiac_cath_lab OR has_oncology)
        AND NOT has_anesthesia
      THEN true ELSE false
    END AS r1_anesthesia_gap,

    -- R2: NICU staffing gap — claims NICU but no neonatologist/pediatrician evidence
    CASE
      WHEN has_nicu
        AND NOT (
          LOWER(COALESCE(CAST(capabilities AS STRING), '')) LIKE '%neonatolog%'
          OR LOWER(COALESCE(CAST(capabilities AS STRING), '')) LIKE '%pediatric%'
          OR LOWER(COALESCE(CAST(procedures AS STRING), '')) LIKE '%neonat%'
          OR LOWER(COALESCE(description, '')) LIKE '%neonatolog%'
          OR LOWER(COALESCE(description, '')) LIKE '%paediatr%'
        )
      THEN true ELSE false
    END AS r2_nicu_staffing_gap,

    -- R3: Cancer specialty gap — claims oncology but no oncologist/chemo/linac evidence
    CASE
      WHEN has_oncology
        AND NOT (
          LOWER(COALESCE(CAST(capabilities AS STRING), '')) LIKE '%oncolog%'
          OR LOWER(COALESCE(CAST(procedures AS STRING), '')) LIKE '%chemotherap%'
          OR LOWER(COALESCE(CAST(procedures AS STRING), '')) LIKE '%radiotherap%'
          OR LOWER(COALESCE(CAST(equipment AS STRING), '')) LIKE '%linac%'
          OR LOWER(COALESCE(CAST(equipment AS STRING), '')) LIKE '%chemo%'
          OR LOWER(COALESCE(description, '')) LIKE '%oncolog%'
        )
      THEN true ELSE false
    END AS r3_cancer_specialty_gap,

    -- R4: 24/7 gap — claims 24/7 but no emergency dept evidence and capacity unknown
    CASE
      WHEN has_24x7
        AND capacity IS NULL
        AND NOT (
          LOWER(COALESCE(CAST(capabilities AS STRING), '')) LIKE '%emergency%'
          OR LOWER(COALESCE(CAST(capabilities AS STRING), '')) LIKE '%casualty%'
          OR LOWER(COALESCE(description, '')) LIKE '%emergency%'
        )
      THEN true ELSE false
    END AS r4_24x7_gap,

    -- R5: Bed-count contradiction — parsed_bed_count vs capacity disagree >25%
    CASE
      WHEN capacity IS NOT NULL AND parsed_bed_count IS NOT NULL
        AND capacity > 0 AND parsed_bed_count > 0
        AND ABS(capacity - parsed_bed_count) > 0.25 * GREATEST(capacity, parsed_bed_count)
      THEN true ELSE false
    END AS r5_bed_count_contradiction,

    -- R6: Modality contradiction — traditional medicine description + allopathic specialty claims
    CASE
      WHEN (
        LOWER(COALESCE(description, '')) LIKE '%ayurved%'
        OR LOWER(COALESCE(description, '')) LIKE '%siddha%'
        OR LOWER(COALESCE(description, '')) LIKE '%homeopath%'
        OR LOWER(COALESCE(description, '')) LIKE '%unani%'
        OR facility_class = 'traditional_medicine'
      )
      AND (has_oncology OR has_cardiac_cath_lab OR has_trauma OR has_icu OR has_nicu)
      THEN true ELSE false
    END AS r6_modality_contradiction,

    -- R7: Scrape artifact density — equipment has >50% non-medical strings
    CASE
      WHEN SIZE(equipment) > 2
        AND (
          SIZE(FILTER(equipment, x ->
            LOWER(x) LIKE '%image%' OR LOWER(x) LIKE '%photo%'
            OR LOWER(x) LIKE '%signage%' OR LOWER(x) LIKE '%building%'
            OR LOWER(x) LIKE '%facade%' OR LOWER(x) LIKE '%distance%'
            OR LOWER(x) LIKE '%corridor%' OR LOWER(x) LIKE '%logo%'
          )) * 1.0 / SIZE(equipment)
        ) > 0.5
      THEN true ELSE false
    END AS r7_scrape_artifact_density,

    -- R8: Evidence sparsity — total chars across text fields below threshold
    CASE
      WHEN (
        LENGTH(COALESCE(description, ''))
        + LENGTH(COALESCE(CAST(capabilities AS STRING), ''))
        + LENGTH(COALESCE(CAST(procedures AS STRING), ''))
        + LENGTH(COALESCE(CAST(equipment AS STRING), ''))
      ) < 50
      THEN true ELSE false
    END AS r8_evidence_sparsity

  FROM joined j
),

scored AS (
  SELECT
    r.*,

    -- Composite deduction
    (
      CASE WHEN r1_anesthesia_gap THEN 25 ELSE 0 END
      + CASE WHEN r2_nicu_staffing_gap THEN 25 ELSE 0 END
      + CASE WHEN r3_cancer_specialty_gap THEN 25 ELSE 0 END
      + CASE WHEN r4_24x7_gap THEN 12 ELSE 0 END
      + CASE WHEN r5_bed_count_contradiction THEN 18 ELSE 0 END
      + CASE WHEN r6_modality_contradiction THEN 35 ELSE 0 END
      + CASE WHEN r7_scrape_artifact_density THEN 12 ELSE 0 END
      + CASE WHEN r8_evidence_sparsity THEN 15 ELSE 0 END
    ) AS total_deduction,

    -- Number of flags triggered
    (
      CAST(r1_anesthesia_gap AS INT) + CAST(r2_nicu_staffing_gap AS INT)
      + CAST(r3_cancer_specialty_gap AS INT) + CAST(r4_24x7_gap AS INT)
      + CAST(r5_bed_count_contradiction AS INT) + CAST(r6_modality_contradiction AS INT)
      + CAST(r7_scrape_artifact_density AS INT) + CAST(r8_evidence_sparsity AS INT)
    ) AS flag_count

  FROM rules r
)

SELECT
  facility_id,
  name,
  facility_type_id,
  state_canon,
  city,
  pincode,
  latitude,
  longitude,
  facility_class,
  capabilities_caption,

  has_icu, has_nicu, has_dialysis, has_oncology,
  has_emergency_surgery, has_24x7, has_maternity,
  has_blood_bank, has_anesthesia, has_trauma,
  has_cardiac_cath_lab,

  -- Trust score clamped [0, 100]
  GREATEST(0, LEAST(100, 100 - total_deduction)) AS trust_score,

  -- Trust bucket for vector search filter
  CASE
    WHEN 100 - total_deduction >= 80 AND flag_count = 0 THEN 'high'
    WHEN 100 - total_deduction >= 40 THEN 'mid'
    ELSE 'low'
  END AS trust_score_bucket,

  -- Individual rule flags
  r1_anesthesia_gap,
  r2_nicu_staffing_gap,
  r3_cancer_specialty_gap,
  r4_24x7_gap,
  r5_bed_count_contradiction,
  r6_modality_contradiction,
  r7_scrape_artifact_density,
  r8_evidence_sparsity,
  flag_count,
  total_deduction,

  -- Flag array for easy iteration in the UI
  FILTER(ARRAY(
    CASE WHEN r1_anesthesia_gap THEN 'R1:anesthesia_gap' END,
    CASE WHEN r2_nicu_staffing_gap THEN 'R2:nicu_staffing_gap' END,
    CASE WHEN r3_cancer_specialty_gap THEN 'R3:cancer_specialty_gap' END,
    CASE WHEN r4_24x7_gap THEN 'R4:24x7_gap' END,
    CASE WHEN r5_bed_count_contradiction THEN 'R5:bed_count_contradiction' END,
    CASE WHEN r6_modality_contradiction THEN 'R6:modality_contradiction' END,
    CASE WHEN r7_scrape_artifact_density THEN 'R7:scrape_artifact_density' END,
    CASE WHEN r8_evidence_sparsity THEN 'R8:evidence_sparsity' END
  ), x -> x IS NOT NULL) AS flags,

  -- Capability details with evidence (for trust panel)
  has_icu_detail, has_nicu_detail, has_oncology_detail,
  has_emergency_surgery_detail, has_24x7_detail, has_maternity_detail,
  has_anesthesia_detail, has_trauma_detail,

  search_text,
  extraction_success

FROM scored

-- COMMAND ----------

-- Verification: trust score distribution and flag counts
SELECT
  trust_score_bucket,
  COUNT(*) AS cnt,
  ROUND(AVG(trust_score), 1) AS avg_score,
  ROUND(AVG(flag_count), 2) AS avg_flags,
  SUM(CASE WHEN r6_modality_contradiction THEN 1 ELSE 0 END) AS modality_contradictions,
  SUM(CASE WHEN r1_anesthesia_gap THEN 1 ELSE 0 END) AS anesthesia_gaps,
  SUM(CASE WHEN r2_nicu_staffing_gap THEN 1 ELSE 0 END) AS nicu_gaps
FROM workspace.default.gold_facility_trust
GROUP BY trust_score_bucket
ORDER BY trust_score_bucket
