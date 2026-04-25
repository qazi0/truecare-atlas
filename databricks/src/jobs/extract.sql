-- Databricks notebook source
-- Phase 2: Capability extraction (Silver → Gold) via ai_query
-- Extracts structured capability flags from free-text facility records using Llama 3.3 70B.

-- COMMAND ----------

-- Step 1: Run extraction over all 10K silver rows.
-- ai_query handles batching, retries, and rate limiting internally.
-- We strip markdown fences and parse the JSON response into a struct.

CREATE OR REPLACE TABLE workspace.default.gold_facility_capabilities AS

WITH raw_extraction AS (
  SELECT
    facility_id,
    name,
    facility_type_id,
    state_canon,
    city,
    pincode,
    latitude,
    longitude,
    description,
    CAST(specialties AS STRING) AS specialties_str,
    CAST(capabilities AS STRING) AS capabilities_str,
    CAST(procedures AS STRING) AS procedures_str,
    CAST(equipment AS STRING) AS equipment_str,
    capacity,
    number_doctors,
    TRIM(REGEXP_REPLACE(
      ai_query(
        'databricks-meta-llama-3-3-70b-instruct',
        CONCAT(
          'Extract capability flags from this Indian healthcare facility as JSON. Return ONLY raw JSON, no markdown fences, no explanation.\n\n',
          'RULES:\n',
          '- value=true ONLY with explicit textual evidence. Copy exact verbatim quote (max 120 chars) into evidence_quote.\n',
          '- confidence: high=explicit named service/department, medium=strongly implied, low=weakly implied or inferred from type alone.\n',
          '- No evidence → value=false, evidence_quote=null, confidence=low.\n',
          '- Do NOT hallucinate capabilities. A dental clinic does not have an ICU unless explicitly stated.\n',
          '- facility_class: one of tertiary_hospital|secondary_hospital|primary_hospital|specialty_clinic|general_clinic|dental_clinic|diagnostic_center|pharmacy|traditional_medicine|unknown\n',
          '- capabilities_caption: one factual sentence summarizing what this facility actually offers, for search indexing.\n\n',
          'JSON keys: has_icu,has_nicu,has_dialysis,has_oncology,has_emergency_surgery,has_24x7,has_maternity,has_blood_bank,has_anesthesia,has_trauma,has_cardiac_cath_lab (each {value:bool,evidence_quote:str|null,confidence:str}), facility_class:str, capabilities_caption:str\n\n',
          'FACILITY: ', name,
          ' | TYPE: ', facility_type_id,
          ' | DESC: ', COALESCE(description, 'N/A'),
          ' | SPECIALTIES: ', COALESCE(CAST(specialties AS STRING), 'N/A'),
          ' | CAPABILITIES: ', COALESCE(CAST(capabilities AS STRING), 'N/A'),
          ' | PROCEDURES: ', COALESCE(CAST(procedures AS STRING), 'N/A'),
          ' | EQUIPMENT: ', COALESCE(CAST(equipment AS STRING), 'N/A'),
          CASE WHEN capacity IS NOT NULL THEN CONCAT(' | BEDS: ', CAST(capacity AS STRING)) ELSE '' END,
          CASE WHEN number_doctors IS NOT NULL THEN CONCAT(' | DOCTORS: ', CAST(number_doctors AS STRING)) ELSE '' END
        )
      ),
      '(?s)^\\s*```json\\s*|\\s*```\\s*$', ''
    )) AS extraction_raw
  FROM workspace.default.silver_facility
),

parsed AS (
  SELECT
    r.*,
    from_json(
      r.extraction_raw,
      'STRUCT<
        has_icu: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_nicu: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_dialysis: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_oncology: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_emergency_surgery: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_24x7: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_maternity: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_blood_bank: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_anesthesia: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_trauma: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        has_cardiac_cath_lab: STRUCT<value: BOOLEAN, evidence_quote: STRING, confidence: STRING>,
        facility_class: STRING,
        capabilities_caption: STRING
      >'
    ) AS ext
  FROM raw_extraction r
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

  -- Flattened capability booleans (for vector search filters)
  COALESCE(ext.has_icu.value, false) AS has_icu,
  COALESCE(ext.has_nicu.value, false) AS has_nicu,
  COALESCE(ext.has_dialysis.value, false) AS has_dialysis,
  COALESCE(ext.has_oncology.value, false) AS has_oncology,
  COALESCE(ext.has_emergency_surgery.value, false) AS has_emergency_surgery,
  COALESCE(ext.has_24x7.value, false) AS has_24x7,
  COALESCE(ext.has_maternity.value, false) AS has_maternity,
  COALESCE(ext.has_blood_bank.value, false) AS has_blood_bank,
  COALESCE(ext.has_anesthesia.value, false) AS has_anesthesia,
  COALESCE(ext.has_trauma.value, false) AS has_trauma,
  COALESCE(ext.has_cardiac_cath_lab.value, false) AS has_cardiac_cath_lab,

  -- Full capability structs with evidence (for trust panel display)
  ext.has_icu AS has_icu_detail,
  ext.has_nicu AS has_nicu_detail,
  ext.has_dialysis AS has_dialysis_detail,
  ext.has_oncology AS has_oncology_detail,
  ext.has_emergency_surgery AS has_emergency_surgery_detail,
  ext.has_24x7 AS has_24x7_detail,
  ext.has_maternity AS has_maternity_detail,
  ext.has_blood_bank AS has_blood_bank_detail,
  ext.has_anesthesia AS has_anesthesia_detail,
  ext.has_trauma AS has_trauma_detail,
  ext.has_cardiac_cath_lab AS has_cardiac_cath_lab_detail,

  COALESCE(ext.facility_class, 'unknown') AS facility_class,
  ext.capabilities_caption,

  -- Searchable text blob for vector index embedding
  CONCAT_WS(' | ',
    name,
    COALESCE(description, ''),
    COALESCE(capabilities_str, ''),
    COALESCE(procedures_str, ''),
    COALESCE(specialties_str, ''),
    COALESCE(ext.capabilities_caption, '')
  ) AS search_text,

  -- Parse success flag
  CASE WHEN ext IS NOT NULL THEN true ELSE false END AS extraction_success,
  extraction_raw

FROM parsed

-- COMMAND ----------

-- Step 2: Verify extraction quality
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN extraction_success THEN 1 ELSE 0 END) AS parsed_ok,
  SUM(CASE WHEN has_icu THEN 1 ELSE 0 END) AS icu_claims,
  SUM(CASE WHEN has_nicu THEN 1 ELSE 0 END) AS nicu_claims,
  SUM(CASE WHEN has_24x7 THEN 1 ELSE 0 END) AS h24x7_claims,
  SUM(CASE WHEN has_maternity THEN 1 ELSE 0 END) AS maternity_claims,
  SUM(CASE WHEN has_oncology THEN 1 ELSE 0 END) AS oncology_claims,
  SUM(CASE WHEN has_emergency_surgery THEN 1 ELSE 0 END) AS emerg_surg_claims,
  SUM(CASE WHEN has_trauma THEN 1 ELSE 0 END) AS trauma_claims,
  SUM(CASE WHEN has_dialysis THEN 1 ELSE 0 END) AS dialysis_claims,
  SUM(CASE WHEN has_blood_bank THEN 1 ELSE 0 END) AS blood_bank_claims,
  SUM(CASE WHEN has_anesthesia THEN 1 ELSE 0 END) AS anesthesia_claims,
  SUM(CASE WHEN has_cardiac_cath_lab THEN 1 ELSE 0 END) AS cath_lab_claims
FROM workspace.default.gold_facility_capabilities
