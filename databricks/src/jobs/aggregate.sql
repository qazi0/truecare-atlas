-- Databricks notebook source
-- Phase 4: State and pincode capability aggregates for the desert map
-- Reads from gold_facility_trust (which has both capabilities and trust scores)

-- COMMAND ----------

-- State-level aggregates: capability counts per state
CREATE OR REPLACE TABLE workspace.default.gold_state_aggregates AS

SELECT
  state_canon,
  COUNT(*) AS total_facilities,
  SUM(CASE WHEN trust_score >= 70 THEN 1 ELSE 0 END) AS high_trust_count,
  SUM(CASE WHEN trust_score < 40 THEN 1 ELSE 0 END) AS low_trust_count,
  ROUND(AVG(trust_score), 1) AS avg_trust_score,

  SUM(CAST(has_icu AS INT)) AS icu_claimed,
  SUM(CASE WHEN has_icu AND trust_score >= 70 THEN 1 ELSE 0 END) AS icu_verified,
  SUM(CAST(has_nicu AS INT)) AS nicu_claimed,
  SUM(CASE WHEN has_nicu AND trust_score >= 70 THEN 1 ELSE 0 END) AS nicu_verified,
  SUM(CAST(has_dialysis AS INT)) AS dialysis_claimed,
  SUM(CASE WHEN has_dialysis AND trust_score >= 70 THEN 1 ELSE 0 END) AS dialysis_verified,
  SUM(CAST(has_oncology AS INT)) AS oncology_claimed,
  SUM(CASE WHEN has_oncology AND trust_score >= 70 THEN 1 ELSE 0 END) AS oncology_verified,
  SUM(CAST(has_emergency_surgery AS INT)) AS emergency_surgery_claimed,
  SUM(CAST(has_24x7 AS INT)) AS h24x7_claimed,
  SUM(CAST(has_maternity AS INT)) AS maternity_claimed,
  SUM(CASE WHEN has_maternity AND trust_score >= 70 THEN 1 ELSE 0 END) AS maternity_verified,
  SUM(CAST(has_blood_bank AS INT)) AS blood_bank_claimed,
  SUM(CAST(has_trauma AS INT)) AS trauma_claimed,
  SUM(CASE WHEN has_trauma AND trust_score >= 70 THEN 1 ELSE 0 END) AS trauma_verified,
  SUM(CAST(has_cardiac_cath_lab AS INT)) AS cardiac_cath_lab_claimed

FROM workspace.default.gold_facility_trust
GROUP BY state_canon

-- COMMAND ----------

-- Pincode-level aggregates: for high-zoom map points
CREATE OR REPLACE TABLE workspace.default.gold_pincode_aggregates AS

SELECT
  pincode,
  state_canon,
  FIRST(city) AS city,
  ROUND(AVG(latitude), 6) AS centroid_lat,
  ROUND(AVG(longitude), 6) AS centroid_lng,
  COUNT(*) AS total_facilities,
  ROUND(AVG(trust_score), 1) AS avg_trust_score,

  SUM(CAST(has_icu AS INT)) AS icu_count,
  SUM(CAST(has_nicu AS INT)) AS nicu_count,
  SUM(CAST(has_dialysis AS INT)) AS dialysis_count,
  SUM(CAST(has_oncology AS INT)) AS oncology_count,
  SUM(CAST(has_24x7 AS INT)) AS h24x7_count,
  SUM(CAST(has_maternity AS INT)) AS maternity_count,
  SUM(CAST(has_blood_bank AS INT)) AS blood_bank_count,
  SUM(CAST(has_trauma AS INT)) AS trauma_count,
  SUM(CAST(has_emergency_surgery AS INT)) AS emergency_surgery_count,
  SUM(CAST(has_cardiac_cath_lab AS INT)) AS cardiac_cath_lab_count

FROM workspace.default.gold_facility_trust
WHERE pincode IS NOT NULL
GROUP BY pincode, state_canon

-- COMMAND ----------

-- Verification
SELECT 'state_aggregates' AS tbl, COUNT(*) AS rows FROM workspace.default.gold_state_aggregates
UNION ALL
SELECT 'pincode_aggregates', COUNT(*) FROM workspace.default.gold_pincode_aggregates
