# Data Analysis — TrueCare Atlas

## Source

- **Table**: `workspace.default.health_india` (10,000 rows, 41 columns)
- **Source file**: `VF_Hackathon_Dataset_India_Large.xlsx` (4.9 MB)
- **Warehouse**: Serverless Starter Warehouse (2X-Small)
- All values stored as `string`; literal `"null"` token used instead of SQL `NULL`

## Column Groups

- **Identity**: name, phone_numbers, officialPhone, email, websites, officialWebsite, yearEstablished
- **Address**: address_line1/2/3, address_city, address_stateOrRegion, address_zipOrPostcode, latitude, longitude
- **Categorical**: facilityTypeId, operatorTypeId, affiliationTypeIds
- **Unstructured claims**: description, specialties (JSON array), procedure (JSON array), equipment (JSON array), capability (JSON array)
- **Operational anchors**: numberDoctors (6.4%), capacity (0.97%), yearEstablished (7.9%)
- **Social signal**: facebookLink, twitterLink, linkedinLink, instagramLink, recency_of_page_update, etc.

## Population Density

| Field | Populated | Notes |
|---|---|---|
| specialties | 100% | Avg 2.9 items, max 32. Often over-claims. |
| description | 90.6% | Avg ~110 chars. Promotional copy. |
| capability | 64.2% | Avg 4.78 items. Mix of claims and scrape artifacts. |
| procedure | 34.0% | Avg 3.97 items. |
| equipment | 16.0% | Often photo descriptions, not actual equipment. |
| numberDoctors | 6.4% | 635 of 10K. |
| capacity | 0.97% | 97 of 10K — essentially absent as structured data. |

## Facility Type Distribution

| Type | Count |
|---|---|
| clinic | 6,011 |
| hospital | 2,789 |
| dentist | 740 |
| doctor | 276 |
| farmacy | 166 |
| pharmacy | 18 |

Note: "farmacy" misspelling must be normalized. Dataset is 99.3% private facilities.

## High-Acuity Capability Claims

| Capability | Claims | % of 10K |
|---|---|---|
| 24/7 / emergency | 979 | 9.8% |
| Maternity / obstetrics | 859 | 8.6% |
| Cardiology / cardiac | 484 | 4.8% |
| Oncology / cancer | 278 | 2.8% |
| Trauma | 188 | 1.9% |
| ICU / intensive care | 180 | 1.8% |
| Neonatal / NICU | 81 | 0.8% |
| Dialysis | 28 | 0.3% |

## Key Data Quality Issues

1. `"null"` string literal instead of SQL `NULL` everywhere
2. JSON-encoded array strings need `from_json` parsing
3. State field corrupted — 100+ variants need canonical mapping to 28 states + 8 UTs
4. Pincodes stored as `"500013.0"` (float-as-string)
5. Equipment arrays contain photo-extraction noise
6. Capability items embed structured facts in prose ("Has 40 beds")
7. Internal contradictions between capability text and structured columns
8. Specialty inflation (e.g., Ayurvedic hospital claiming medicalOncology)

## Geographic Coverage

- 2,321 unique cities, 3,737 unique pincodes
- 100% of rows have valid lat/long inside India bounding box
- Top 5 states: Maharashtra (1,506), UP (1,058), Gujarat (838), Tamil Nadu (630), Kerala (597)
