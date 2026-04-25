"""LLM prompts for capability extraction and trust scoring."""

CAPABILITY_EXTRACTION_SYSTEM = """\
You are a medical facility auditor analyzing Indian healthcare facility records.
Given a facility's structured and unstructured data, extract capability flags.

RULES:
- Set value=true ONLY if there is explicit textual evidence in the provided fields.
- Copy the exact verbatim quote that supports each true flag into evidence_quote (max 120 chars).
- Set source_field to whichever field the evidence came from.
- Confidence: "high" = explicit named service/department, "medium" = strongly implied, "low" = weakly implied or inferred from facility type alone.
- If no evidence exists for a capability, set value=false, evidence_quote=null, source_field=null, confidence="low".
- Do NOT hallucinate capabilities. A dental clinic does not have an ICU unless explicitly stated.
- facility_class: classify based on all available evidence (bed count, specialties breadth, facility type).
- capabilities_caption: one sentence summarizing what this facility actually offers, for use as a search embedding. Be factual, not promotional.\
"""


def build_extraction_user_prompt(row: dict) -> str:
    parts = [f"FACILITY: {row.get('name', 'Unknown')}"]
    parts.append(f"TYPE: {row.get('facility_type_id', 'unknown')}")

    if row.get("description"):
        parts.append(f"DESCRIPTION: {row['description']}")

    if row.get("specialties"):
        specs = row["specialties"]
        if isinstance(specs, list):
            specs = ", ".join(specs)
        parts.append(f"SPECIALTIES: {specs}")

    if row.get("capabilities"):
        caps = row["capabilities"]
        if isinstance(caps, list):
            caps = " | ".join(caps)
        parts.append(f"CAPABILITIES: {caps}")

    if row.get("procedures"):
        procs = row["procedures"]
        if isinstance(procs, list):
            procs = " | ".join(procs)
        parts.append(f"PROCEDURES: {procs}")

    if row.get("equipment"):
        equip = row["equipment"]
        if isinstance(equip, list):
            equip = " | ".join(equip)
        parts.append(f"EQUIPMENT: {equip}")

    if row.get("capacity"):
        parts.append(f"BED_CAPACITY: {row['capacity']}")
    if row.get("parsed_bed_count"):
        parts.append(f"PARSED_BED_COUNT: {row['parsed_bed_count']}")
    if row.get("number_doctors"):
        parts.append(f"NUMBER_DOCTORS: {row['number_doctors']}")

    parts.append("\nExtract capability flags for this facility.")
    return "\n".join(parts)


# SQL-inlined version of the system prompt (escaped for CONCAT in ai_query)
CAPABILITY_EXTRACTION_SYSTEM_SQL = CAPABILITY_EXTRACTION_SYSTEM.replace("'", "\\'")
