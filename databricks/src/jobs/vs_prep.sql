-- Databricks notebook source
-- Phase 4b: Prepare Vector Search source table
-- Joins gold_facility_capabilities + gold_facility_trust into a single table
-- with CDF enabled for delta-sync indexing.
-- NOTE: decimal columns (latitude, longitude) excluded — VS doesn't support decimal types.
-- The backend joins them back from silver_facility at query time.

-- COMMAND ----------

ALTER TABLE workspace.default.gold_facility_capabilities
SET TBLPROPERTIES (delta.enableChangeDataFeed = true);

-- COMMAND ----------

ALTER TABLE workspace.default.gold_facility_trust
SET TBLPROPERTIES (delta.enableChangeDataFeed = true);

-- COMMAND ----------

CREATE OR REPLACE TABLE workspace.default.vs_facility_search
TBLPROPERTIES (delta.enableChangeDataFeed = true)
AS
SELECT
  c.facility_id,
  c.name,
  c.facility_type_id,
  c.state_canon,
  c.city,
  c.pincode,
  c.has_icu,
  c.has_nicu,
  c.has_dialysis,
  c.has_oncology,
  c.has_emergency_surgery,
  c.has_24x7,
  c.has_maternity,
  c.has_blood_bank,
  c.has_anesthesia,
  c.has_trauma,
  c.has_cardiac_cath_lab,
  c.facility_class,
  c.capabilities_caption,
  c.search_text,
  COALESCE(t.trust_score, 0) AS trust_score,
  COALESCE(t.trust_score_bucket, 'unknown') AS trust_score_bucket
FROM workspace.default.gold_facility_capabilities c
LEFT JOIN workspace.default.gold_facility_trust t
  ON c.facility_id = t.facility_id;
