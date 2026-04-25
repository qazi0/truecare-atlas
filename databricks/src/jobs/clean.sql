-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Phase 1: Bronze -> Silver Cleaning
-- MAGIC
-- MAGIC Transforms `workspace.default.health_india` (10,000 Indian medical facilities)
-- MAGIC into `workspace.default.silver_facility` with the following fixes:
-- MAGIC
-- MAGIC 1. **String 'null' -> SQL NULL** across all string columns
-- MAGIC 2. **Pincode normalization** — strip `.0`, zero-pad to 6 digits, validate `^[1-9][0-9]{5}$`
-- MAGIC 3. **State canonicalization** — map city/district/abbreviation aliases to 36 official state/UT names
-- MAGIC 4. **JSON array parsing** — specialties, procedures, equipment, capabilities, phones, websites
-- MAGIC 5. **Numeric string cleanup** — strip `.0` suffix, cast to INT/DOUBLE
-- MAGIC 6. **Boolean normalization** — `'true'`/`'false'`/`'null'` to proper BOOLEAN
-- MAGIC 7. **Capability anchor extraction** — bed counts, doctor counts, establishment year from free text
-- MAGIC 8. **Deterministic facility_id** — MD5 of name + city + state
-- MAGIC 9. **Data quality flags** — array of issue tags per row

-- COMMAND ----------

-- Cell 2: State alias lookup table
-- Every alias is case-sensitive and matched exactly as found in the data.

CREATE OR REPLACE TEMPORARY VIEW state_alias_map AS
SELECT alias, canonical FROM VALUES
  -- Maharashtra
  ('Mumbai', 'Maharashtra'),
  ('Pune', 'Maharashtra'),
  ('Thane', 'Maharashtra'),
  ('Solapur', 'Maharashtra'),
  ('Navi Mumbai', 'Maharashtra'),
  ('Beed', 'Maharashtra'),
  ('Nagpur', 'Maharashtra'),
  ('Mh', 'Maharashtra'),
  ('Dudhani', 'Maharashtra'),
  ('Ambernath', 'Maharashtra'),
  ('Chandrapur', 'Maharashtra'),
  ('Kalyan', 'Maharashtra'),
  ('Mira Bhayander', 'Maharashtra'),
  ('Chinchwad', 'Maharashtra'),
  ('Pimpri-chinchwad', 'Maharashtra'),
  ('Jalgaon District', 'Maharashtra'),
  ('Pune-411044', 'Maharashtra'),
  ('Pune, Maharashtra', 'Maharashtra'),
  ('Navi Mumbai, Maharashtra', 'Maharashtra'),

  -- Uttar Pradesh
  ('Up', 'Uttar Pradesh'),
  ('U.p.', 'Uttar Pradesh'),
  ('Ghaziabad', 'Uttar Pradesh'),
  ('Lucknow', 'Uttar Pradesh'),
  ('Allahabad', 'Uttar Pradesh'),
  ('Gautam Buddha Nagar', 'Uttar Pradesh'),
  ('Kalyanpur Kanpur', 'Uttar Pradesh'),
  ('Ayodhya', 'Uttar Pradesh'),
  ('Azamgarh', 'Uttar Pradesh'),
  ('Ambedkar Nagar', 'Uttar Pradesh'),
  ('Moradabad', 'Uttar Pradesh'),
  ('Varanasi', 'Uttar Pradesh'),
  ('Aligarh', 'Uttar Pradesh'),
  ('Faizabad', 'Uttar Pradesh'),

  -- Tamil Nadu
  ('Chennai', 'Tamil Nadu'),
  ('Tamilnadu', 'Tamil Nadu'),
  ('Salem', 'Tamil Nadu'),
  ('Tiruvallur-602001', 'Tamil Nadu'),
  ('Erode', 'Tamil Nadu'),
  ('Vellore', 'Tamil Nadu'),
  ('Thoothukudi', 'Tamil Nadu'),
  ('Thanjavur', 'Tamil Nadu'),

  -- Karnataka
  ('Bengaluru', 'Karnataka'),
  ('Bangalore', 'Karnataka'),
  ('Chikmagalur', 'Karnataka'),
  ('Belgaum', 'Karnataka'),
  ('Udupi', 'Karnataka'),
  ('Ka', 'Karnataka'),

  -- Kerala
  ('Ernakulam', 'Kerala'),
  ('Thrissur', 'Kerala'),
  ('Malappuram', 'Kerala'),
  ('Kochi', 'Kerala'),
  ('Kannur', 'Kerala'),
  ('Alappuzha', 'Kerala'),
  ('Palakkad', 'Kerala'),
  ('Thiruvananthapuram', 'Kerala'),
  ('Pathanamthitta', 'Kerala'),
  ('Chittur', 'Kerala'),
  ('Malappuram, Kerala', 'Kerala'),

  -- West Bengal
  ('Kolkata', 'West Bengal'),
  ('Hooghly', 'West Bengal'),
  ('Howrah', 'West Bengal'),
  ('North 24 Parganas', 'West Bengal'),
  ('Birbhum', 'West Bengal'),
  ('Paschim Medinipur', 'West Bengal'),
  ('Alipurduar', 'West Bengal'),
  ('Murshidabad', 'West Bengal'),
  ('Dinajpur', 'West Bengal'),
  ('Rajarhat', 'West Bengal'),
  ('Durgapur', 'West Bengal'),
  ('Kharagpur', 'West Bengal'),
  ('Puruliya', 'West Bengal'),
  ('Chakdah', 'West Bengal'),

  -- Gujarat
  ('Ahmedabad', 'Gujarat'),
  ('Surat', 'Gujarat'),
  ('Mehsana', 'Gujarat'),
  ('Bharuch', 'Gujarat'),
  ('Gandhinagar', 'Gujarat'),
  ('Rajkot', 'Gujarat'),
  ('Surendranagar District', 'Gujarat'),
  ('Veraval', 'Gujarat'),
  ('Gj', 'Gujarat'),

  -- Haryana
  ('Gurugram', 'Haryana'),
  ('Nit', 'Haryana'),
  ('Nuh', 'Haryana'),
  ('Jhajjar', 'Haryana'),
  ('Kurukshetra', 'Haryana'),
  ('Charkhi Dadri, Haryana', 'Haryana'),
  ('Fatehabad, Haryana', 'Haryana'),

  -- Punjab
  ('Punjab Region', 'Punjab'),
  ('Ludhiana', 'Punjab'),
  ('Patiala', 'Punjab'),
  ('Ropar', 'Punjab'),
  ('Amritsar', 'Punjab'),
  ('Gurdaspur', 'Punjab'),
  ('Sangrur', 'Punjab'),
  ('Mohali', 'Punjab'),
  ('Zirakpur', 'Punjab'),

  -- Delhi
  ('New Delhi', 'Delhi'),
  ('North West Delhi', 'Delhi'),
  ('National Capital Territory Of Delhi', 'Delhi'),
  ('Nct', 'Delhi'),
  ('West Delhi', 'Delhi'),
  ('Delhi Division', 'Delhi'),
  ('Delhi Ncr', 'Delhi'),
  ('Safdarjung Enclave', 'Delhi'),
  ('Sector 56', 'Delhi'),
  ('Ncr', 'Delhi'),

  -- Rajasthan
  ('Jaipur', 'Rajasthan'),
  ('Jodhpur', 'Rajasthan'),
  ('Durgapura', 'Rajasthan'),
  ('Rajsamand, Rajasthan', 'Rajasthan'),
  ('Pali-rajasthan', 'Rajasthan'),
  ('Sikar', 'Rajasthan'),
  ('Churu', 'Rajasthan'),
  ('Udaipur', 'Rajasthan'),

  -- Telangana
  ('Hyderabad', 'Telangana'),
  ('Secunderabad', 'Telangana'),
  ('Telangana State', 'Telangana'),
  ('Karimnagar', 'Telangana'),
  ('Mandamarri', 'Telangana'),

  -- Bihar
  ('Gaya', 'Bihar'),
  ('Jehanabad, Bihar', 'Bihar'),
  ('Sitamarhi', 'Bihar'),
  ('Saran', 'Bihar'),
  ('Supaul', 'Bihar'),
  ('Aurangabad-bihar', 'Bihar'),
  ('Khaira', 'Bihar'),

  -- Jammu and Kashmir
  ('Jammu And Kashmir', 'Jammu and Kashmir'),
  ('Jammu & Kashmir', 'Jammu and Kashmir'),
  ('J&k', 'Jammu and Kashmir'),
  ('Kupwara', 'Jammu and Kashmir'),
  ('Anantnag', 'Jammu and Kashmir'),
  ('Ganderbal', 'Jammu and Kashmir'),

  -- Andhra Pradesh
  ('Andhrapradesh', 'Andhra Pradesh'),
  ('Kurnool', 'Andhra Pradesh'),
  ('Rajahmundry', 'Andhra Pradesh'),
  ('Chittoor', 'Andhra Pradesh'),
  ('Prakasam District', 'Andhra Pradesh'),

  -- Madhya Pradesh
  ('Madhyapradesh', 'Madhya Pradesh'),
  ('Guna, Madhya Pradesh', 'Madhya Pradesh'),
  ('Dhar District, Madhya Pradesh', 'Madhya Pradesh'),
  ('Jabalpur', 'Madhya Pradesh'),
  ('Singrauli', 'Madhya Pradesh'),
  ('Thatipur', 'Madhya Pradesh'),

  -- Chhattisgarh
  ('Durg', 'Chhattisgarh'),
  ('Raipur', 'Chhattisgarh'),
  ('Bhilai', 'Chhattisgarh'),
  ('Chattisgarh', 'Chhattisgarh'),

  -- Jharkhand
  ('Bokaro', 'Jharkhand'),
  ('Bokaro Steel City, Jharkhand', 'Jharkhand'),

  -- Puducherry
  ('Pondicherry', 'Puducherry'),

  -- Assam
  ('Silchar', 'Assam'),
  ('Golaghat', 'Assam'),
  ('Darrang', 'Assam'),
  ('Sibsagar', 'Assam'),
  ('Barpeta, Assam', 'Assam'),

  -- Uttarakhand
  ('Uttaranchal', 'Uttarakhand'),
  ('Mukteshwar', 'Uttarakhand'),
  ('Ut', 'Uttarakhand'),

  -- Tripura
  ('West Tripura', 'Tripura'),

  -- Dadra and Nagar Haveli and Daman and Diu
  ('Ut Of Dadra & Nagar Haveli And Daman Diu', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('Daman And Diu', 'Dadra and Nagar Haveli and Daman and Diu')

AS t(alias, canonical);

-- COMMAND ----------

-- Cell 3: Main Silver table creation

CREATE OR REPLACE TABLE workspace.default.silver_facility AS

WITH nullified AS (
  SELECT
    -- Nullify every string column (string 'null' -> SQL NULL)
    NULLIF(name, 'null')                                      AS name,
    NULLIF(phone_numbers, 'null')                             AS phone_numbers_raw,
    NULLIF(officialPhone, 'null')                             AS official_phone,
    NULLIF(email, 'null')                                     AS email,
    NULLIF(websites, 'null')                                  AS websites_raw,
    NULLIF(officialWebsite, 'null')                           AS official_website,
    NULLIF(yearEstablished, 'null')                           AS year_established_raw,
    NULLIF(facebookLink, 'null')                              AS facebook_link,
    NULLIF(twitterLink, 'null')                               AS twitter_link,
    NULLIF(linkedinLink, 'null')                              AS linkedin_link,
    NULLIF(instagramLink, 'null')                             AS instagram_link,
    NULLIF(address_line1, 'null')                             AS address_line1,
    NULLIF(address_line2, 'null')                             AS address_line2,
    NULLIF(address_line3, 'null')                             AS address_line3,
    NULLIF(address_city, 'null')                              AS address_city,
    NULLIF(address_stateOrRegion, 'null')                     AS state_raw,
    NULLIF(address_zipOrPostcode, 'null')                     AS pincode_raw,
    NULLIF(address_country, 'null')                           AS address_country,
    NULLIF(address_countryCode, 'null')                       AS address_country_code,
    NULLIF(facilityTypeId, 'null')                            AS facility_type_id,
    NULLIF(operatorTypeId, 'null')                            AS operator_type_id,
    NULLIF(affiliationTypeIds, 'null')                        AS affiliation_type_ids_raw,
    NULLIF(description, 'null')                               AS description,
    NULLIF(numberDoctors, 'null')                             AS number_doctors_raw,
    NULLIF(capacity, 'null')                                  AS capacity_raw,
    NULLIF(specialties, 'null')                               AS specialties_raw,
    NULLIF(procedure, 'null')                                 AS procedures_raw,
    NULLIF(equipment, 'null')                                 AS equipment_raw,
    NULLIF(capability, 'null')                                AS capability_raw,
    NULLIF(recency_of_page_update, 'null')                    AS recency_of_page_update,
    NULLIF(distinct_social_media_presence_count, 'null')      AS social_media_count_raw,
    NULLIF(affiliated_staff_presence, 'null')                 AS affiliated_staff_presence_raw,
    NULLIF(custom_logo_presence, 'null')                      AS custom_logo_presence_raw,
    NULLIF(number_of_facts_about_the_organization, 'null')    AS number_of_facts_raw,
    NULLIF(post_metrics_most_recent_social_media_post_date, 'null') AS most_recent_post_date_raw,
    NULLIF(post_metrics_post_count, 'null')                   AS post_count_raw,
    NULLIF(engagement_metrics_n_followers, 'null')            AS n_followers_raw,
    NULLIF(engagement_metrics_n_likes, 'null')                AS n_likes_raw,
    NULLIF(engagement_metrics_n_engagements, 'null')          AS n_engagements_raw,
    latitude,
    longitude
  FROM workspace.default.health_india
),

cleaned AS (
  SELECT
    -- Pass-through from nullified
    n.*,

    -- City: trim, collapse whitespace, title-case
    INITCAP(TRIM(REGEXP_REPLACE(n.address_city, '\\s+', ' '))) AS city_clean,

    -- Pincode: strip .0, zero-pad to 6, leave as string for regex validation
    LPAD(
      REGEXP_REPLACE(n.pincode_raw, '\\.0$', ''),
      6, '0'
    ) AS pincode_clean,

    -- Year established: strip .0, cast to INT
    CAST(REGEXP_REPLACE(n.year_established_raw, '\\.0$', '') AS INT) AS year_established,

    -- Parse JSON arrays
    FROM_JSON(n.phone_numbers_raw, 'ARRAY<STRING>')          AS phone_numbers_parsed,
    FROM_JSON(n.websites_raw, 'ARRAY<STRING>')               AS websites_parsed,
    FROM_JSON(n.specialties_raw, 'ARRAY<STRING>')            AS specialties_parsed,
    FROM_JSON(n.procedures_raw, 'ARRAY<STRING>')             AS procedures_parsed,
    FROM_JSON(n.equipment_raw, 'ARRAY<STRING>')              AS equipment_parsed,
    FROM_JSON(n.capability_raw, 'ARRAY<STRING>')             AS capabilities_parsed,
    FROM_JSON(n.affiliation_type_ids_raw, 'ARRAY<STRING>')   AS affiliation_type_ids_parsed,

    -- Numeric columns: strip .0 suffix, cast
    CAST(REGEXP_REPLACE(n.number_doctors_raw, '\\.0$', '') AS INT) AS number_doctors,
    CAST(REGEXP_REPLACE(n.capacity_raw, '\\.0$', '') AS INT)       AS capacity_int,
    CAST(REGEXP_REPLACE(n.social_media_count_raw, '\\.0$', '') AS INT) AS distinct_social_media_presence_count,
    CAST(REGEXP_REPLACE(n.number_of_facts_raw, '\\.0$', '') AS INT)    AS number_of_facts,
    CAST(REGEXP_REPLACE(n.post_count_raw, '\\.0$', '') AS INT)         AS post_count,
    CAST(REGEXP_REPLACE(n.n_followers_raw, '\\.0$', '') AS BIGINT)     AS n_followers,
    CAST(REGEXP_REPLACE(n.n_likes_raw, '\\.0$', '') AS BIGINT)         AS n_likes,
    CAST(REGEXP_REPLACE(n.n_engagements_raw, '\\.0$', '') AS BIGINT)   AS n_engagements,

    -- Boolean columns
    CASE
      WHEN LOWER(n.affiliated_staff_presence_raw) = 'true'  THEN true
      WHEN LOWER(n.affiliated_staff_presence_raw) = 'false' THEN false
      ELSE NULL
    END AS affiliated_staff_presence,

    CASE
      WHEN LOWER(n.custom_logo_presence_raw) = 'true'  THEN true
      WHEN LOWER(n.custom_logo_presence_raw) = 'false' THEN false
      ELSE NULL
    END AS custom_logo_presence,

    -- Recency of page update: try to parse as date
    TRY_CAST(n.recency_of_page_update AS DATE) AS most_recent_page_update,

    -- Most recent social media post date
    TRY_CAST(n.most_recent_post_date_raw AS DATE) AS most_recent_post_date,

    -- Geo validation: India bounding box
    CASE
      WHEN n.latitude BETWEEN 6.0 AND 37.5
       AND n.longitude BETWEEN 68.0 AND 97.5
      THEN true
      ELSE false
    END AS geo_valid,

    -- Capability anchor extraction: join array into single string, then regex
    -- First, build the capability text blob
    ARRAY_JOIN(FROM_JSON(n.capability_raw, 'ARRAY<STRING>'), ' ') AS capability_text

  FROM nullified n
),

anchors AS (
  SELECT
    c.*,

    -- Parse "Has X beds" or "X-bed" or "X beds"
    TRY_CAST(
      COALESCE(
        REGEXP_EXTRACT(c.capability_text, 'Has (\\d+) beds', 1),
        REGEXP_EXTRACT(c.capability_text, '(\\d+)-bed', 1),
        REGEXP_EXTRACT(c.capability_text, '(\\d+) beds', 1)
      ) AS INT
    ) AS parsed_bed_count,

    -- Parse "X doctors" or "X ophthalmologist" or "X physicians"
    TRY_CAST(
      COALESCE(
        REGEXP_EXTRACT(c.capability_text, '(\\d+) doctors', 1),
        REGEXP_EXTRACT(c.capability_text, '(\\d+) ophthalmologists?', 1),
        REGEXP_EXTRACT(c.capability_text, '(\\d+) physicians?', 1),
        REGEXP_EXTRACT(c.capability_text, '(\\d+) specialists?', 1)
      ) AS INT
    ) AS parsed_doctor_count,

    -- Parse "Established in YYYY"
    TRY_CAST(
      REGEXP_EXTRACT(c.capability_text, 'Established in (\\d{4})', 1)
      AS INT
    ) AS parsed_year_from_established,

    -- Parse "In operation for X years" -> 2026 - X
    TRY_CAST(
      REGEXP_EXTRACT(c.capability_text, 'In operation for (\\d+) years', 1)
      AS INT
    ) AS parsed_operation_years

  FROM cleaned c
),

final AS (
  SELECT
    a.*,

    -- Reconciled year established: prefer structured, fall back to text extraction
    COALESCE(
      a.year_established,
      a.parsed_year_from_established,
      CASE WHEN a.parsed_operation_years IS NOT NULL THEN 2026 - a.parsed_operation_years ELSE NULL END
    ) AS year_established_reconciled,

    -- Data quality flags
    FILTER(
      ARRAY(
        CASE WHEN a.name IS NULL THEN 'missing_name' END,
        CASE WHEN a.pincode_clean IS NULL OR NOT a.pincode_clean RLIKE '^[1-9][0-9]{5}$' THEN 'invalid_pincode' END,
        CAST(NULL AS STRING),
        CASE WHEN a.latitude IS NULL OR a.longitude IS NULL THEN 'missing_geo' END,
        CASE WHEN a.geo_valid = false AND a.latitude IS NOT NULL THEN 'geo_outside_india' END,
        CASE WHEN a.specialties_parsed IS NULL OR SIZE(a.specialties_parsed) = 0 THEN 'missing_specialties' END,
        CASE WHEN a.description IS NULL THEN 'missing_description' END,
        CASE WHEN a.parsed_bed_count IS NOT NULL
              AND a.capacity_int IS NOT NULL
              AND a.parsed_bed_count != a.capacity_int
             THEN 'capacity_mismatch' END,
        CASE WHEN a.year_established IS NOT NULL
              AND a.parsed_year_from_established IS NOT NULL
              AND a.year_established != a.parsed_year_from_established
             THEN 'year_established_mismatch' END,
        CASE WHEN a.year_established IS NOT NULL
              AND a.parsed_operation_years IS NOT NULL
              AND a.year_established != (2026 - a.parsed_operation_years)
             THEN 'year_established_mismatch' END,
        CASE WHEN a.official_phone IS NULL AND (a.phone_numbers_parsed IS NULL OR SIZE(a.phone_numbers_parsed) = 0) THEN 'missing_phone' END,
        CASE WHEN a.email IS NULL THEN 'missing_email' END
      ),
      x -> x IS NOT NULL
    ) AS data_quality_flags

  FROM anchors a
)

SELECT
  -- Deterministic facility ID
  md5(concat_ws('|',
    COALESCE(f.name, ''),
    COALESCE(f.city_clean, ''),
    COALESCE(COALESCE(sam.canonical, f.state_raw), '')
  )) AS facility_id,

  -- Identity
  f.name,
  f.description,

  -- Contact
  f.official_phone,
  f.email,
  f.official_website,
  f.phone_numbers_parsed                                     AS phone_numbers,
  f.websites_parsed                                          AS websites,

  -- Social links
  f.facebook_link,
  f.twitter_link,
  f.linkedin_link,
  f.instagram_link,

  -- Address
  f.address_line1,
  f.address_line2,
  f.address_line3,
  f.city_clean                                               AS city,
  f.state_raw,
  COALESCE(sam.canonical, f.state_raw)                       AS state_canon,
  CASE
    WHEN f.pincode_clean RLIKE '^[1-9][0-9]{5}$' THEN f.pincode_clean
    ELSE NULL
  END                                                        AS pincode,
  f.address_country,
  f.address_country_code,

  -- Geo
  f.latitude,
  f.longitude,
  f.geo_valid,

  -- Classification
  f.facility_type_id,
  f.operator_type_id,
  f.affiliation_type_ids_parsed                              AS affiliation_type_ids,

  -- Clinical arrays
  f.specialties_parsed                                       AS specialties,
  f.procedures_parsed                                        AS procedures,
  f.equipment_parsed                                         AS equipment,
  f.capabilities_parsed                                      AS capabilities,

  -- Structured numerics
  f.number_doctors,
  f.capacity_int                                             AS capacity,
  f.year_established_reconciled                              AS year_established,

  -- Anchor extractions from capability text
  f.parsed_bed_count,
  f.parsed_doctor_count,
  f.parsed_year_from_established,
  CASE
    WHEN f.parsed_operation_years IS NOT NULL THEN 2026 - f.parsed_operation_years
    ELSE NULL
  END                                                        AS parsed_year_from_operation,

  -- Social / engagement metrics
  f.distinct_social_media_presence_count,
  f.affiliated_staff_presence,
  f.custom_logo_presence,
  f.number_of_facts,
  f.most_recent_page_update,
  f.most_recent_post_date,
  f.post_count,
  f.n_followers,
  f.n_likes,
  f.n_engagements,

  -- Data quality: add unmapped_state flag here (after JOIN resolves alias)
  CASE
    WHEN f.state_raw IS NOT NULL
         AND sam.canonical IS NULL
         AND f.state_raw NOT IN (
           'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
           'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
           'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
           'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
           'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
           'Andaman and Nicobar Islands','Chandigarh','Delhi',
           'Dadra and Nagar Haveli and Daman and Diu','Jammu and Kashmir',
           'Ladakh','Lakshadweep','Puducherry'
         )
    THEN ARRAY_UNION(f.data_quality_flags, ARRAY('unmapped_state'))
    ELSE f.data_quality_flags
  END AS data_quality_flags

FROM final f
LEFT JOIN state_alias_map sam
  ON f.state_raw = sam.alias;

-- COMMAND ----------

-- Cell 4: Assertions

-- Assertion 1: Row count must be exactly 10,000
SELECT ASSERT_TRUE(
  (SELECT COUNT(*) FROM workspace.default.silver_facility) = 10000,
  CONCAT('Expected 10000 rows, got ', CAST((SELECT COUNT(*) FROM workspace.default.silver_facility) AS STRING))
);

-- COMMAND ----------

-- Assertion 2: All non-null states resolve to a canonical state/UT
SELECT ASSERT_TRUE(
  COUNT(*) = 0,
  CONCAT('Non-canonical states found: ', CAST(COUNT(*) AS STRING))
)
FROM workspace.default.silver_facility
WHERE state_canon IS NOT NULL
  AND state_canon NOT IN (
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi',
    'Dadra and Nagar Haveli and Daman and Diu', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'
  );

-- COMMAND ----------

-- Assertion 3: All non-null pincodes match the 6-digit Indian format
SELECT ASSERT_TRUE(
  COUNT(*) = 0,
  CONCAT('Invalid pincodes found: ', CAST(COUNT(*) AS STRING))
)
FROM workspace.default.silver_facility
WHERE pincode IS NOT NULL
  AND NOT pincode RLIKE '^[1-9][0-9]{5}$';

-- COMMAND ----------

-- Assertion 4: Top 15 states by population each have at least one facility
SELECT ASSERT_TRUE(
  COUNT(DISTINCT state_canon) = 15,
  CONCAT('Only ', CAST(COUNT(DISTINCT state_canon) AS STRING), ' of top-15 states present')
)
FROM workspace.default.silver_facility
WHERE state_canon IN (
  'Maharashtra', 'Uttar Pradesh', 'Gujarat', 'Tamil Nadu', 'Kerala',
  'Rajasthan', 'West Bengal', 'Karnataka', 'Delhi', 'Telangana',
  'Bihar', 'Haryana', 'Punjab', 'Madhya Pradesh', 'Andhra Pradesh'
);
