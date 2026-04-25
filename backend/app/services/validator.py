"""Validator Agent — second-pass LLM cross-references capabilities against medical standards."""

import asyncio
import json

from app.schemas import ValidationFinding, ValidatorResult
from app.services.databricks_sql import query_facility_by_id
from app.services.databricks_fm import chat_completion

MEDICAL_STANDARDS_RUBRIC = """\
You are a medical facility validator. Given a facility's claimed capabilities and evidence, \
assess whether each high-acuity claim is plausible based on standard medical requirements.

## Medical standards reference (Indian Clinical Establishment Standards + NABH):

1. **ICU**: Requires intensivist or anesthesiologist on staff, ventilators, multi-parameter \
monitors, defibrillator, minimum 5 beds dedicated to critical care.
2. **NICU**: Requires neonatologist OR pediatrician with neonatal training, incubators, \
phototherapy units, neonatal ventilator. Minimum Level II NICU needs 24/7 nursing.
3. **Oncology**: Requires medical oncologist OR onco-surgeon OR radiation oncologist. \
Equipment: linear accelerator (for radiation) OR chemotherapy infusion setup. \
Pathology lab for biopsy processing.
4. **Emergency Surgery**: Requires at least one surgeon, one anesthesiologist, equipped OT \
(operating theatre), blood bank OR blood storage unit, post-op recovery area.
5. **Cardiac Cath Lab**: Requires interventional cardiologist, catheterization lab with \
fluoroscopy, IABP capability, cardiac surgery backup (on-site or transfer agreement).
6. **Dialysis**: Requires nephrologist (on-call acceptable), dialysis machines, water \
treatment plant (RO), trained dialysis technicians.
7. **Blood Bank**: Requires pathologist, blood bank technician, component separation \
equipment, cold chain storage. Licensed by CDSCO/State Drug Controller.
8. **Trauma Center**: Requires emergency physician, surgeon, orthopedic surgeon on call, \
imaging (X-ray + CT minimum), 24/7 availability.
9. **24/7 Emergency**: Requires at least one doctor available round-the-clock, emergency \
room with basic resuscitation equipment, ambulance coordination.
10. **Maternity**: Requires obstetrician/gynecologist, labor room, newborn resuscitation \
setup. For C-section capability: OT + anesthesiologist.

## Your task

For each claimed capability that is TRUE, assess:
- Is there supporting evidence (staff, equipment, procedures) in the facility data?
- Does the facility type plausibly support this capability?
- Are there contradictions (e.g., Ayurvedic clinic claiming allopathic surgery)?

Return a JSON object with this exact structure:
{
  "overall_assessment": "plausible" | "questionable" | "implausible",
  "findings": [
    {
      "capability": "has_icu",
      "claimed": true,
      "plausible": true,
      "reasoning": "brief explanation",
      "evidence_for": ["list of supporting evidence"],
      "evidence_against": ["list of contradicting evidence"]
    }
  ],
  "medical_standards_checked": ["list of standards referenced"],
  "recommendation": "one sentence recommendation for the NGO planner"
}

Return ONLY raw JSON. No markdown fences, no explanation outside the JSON.
"""

_CLAIMED_CAPS = [
    "has_icu", "has_nicu", "has_dialysis", "has_oncology",
    "has_emergency_surgery", "has_24x7", "has_maternity",
    "has_blood_bank", "has_anesthesia", "has_trauma", "has_cardiac_cath_lab",
]


async def validate_facility(facility_id: str) -> ValidatorResult:
    loop = asyncio.get_running_loop()
    facility = await loop.run_in_executor(None, query_facility_by_id, facility_id)

    claimed = {}
    if facility.capabilities:
        for cap in _CLAIMED_CAPS:
            cap_obj = getattr(facility.capabilities, cap, None)
            if cap_obj and cap_obj.value:
                evidence = cap_obj.evidence_quote or "no specific evidence"
                claimed[cap] = evidence

    if not claimed:
        return ValidatorResult(
            facility_id=facility_id,
            facility_name=facility.name,
            overall_assessment="no high-acuity claims to validate",
            findings=[],
            medical_standards_checked=[],
            recommendation="Facility has no high-acuity capability claims. No validation needed.",
        )

    facility_context = (
        f"Facility: {facility.name}\n"
        f"Type: {facility.facility_type or 'unknown'}\n"
        f"Location: {facility.city}, {facility.state}\n"
        f"Description: {facility.description or 'none'}\n"
        f"Trust Score: {facility.trust_score}/100\n"
        f"Specialties: {', '.join(facility.specialties) if facility.specialties else 'none'}\n"
        f"Procedures: {', '.join(facility.procedures) if facility.procedures else 'none'}\n"
        f"Equipment: {', '.join(facility.equipment) if facility.equipment else 'none'}\n"
        f"Capability text: {', '.join(facility.capability_text) if facility.capability_text else 'none'}\n\n"
        f"Claimed capabilities with evidence:\n"
    )
    for cap, evidence in claimed.items():
        facility_context += f"  - {cap}: {evidence}\n"

    messages = [
        {"role": "system", "content": MEDICAL_STANDARDS_RUBRIC},
        {"role": "user", "content": facility_context},
    ]

    response = await chat_completion(messages=messages, tools=None)
    content = response["choices"][0]["message"].get("content", "")

    # Strip markdown fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0]
    content = content.strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return ValidatorResult(
            facility_id=facility_id,
            facility_name=facility.name,
            overall_assessment="validation failed — LLM response could not be parsed",
            findings=[],
            medical_standards_checked=[],
            recommendation="Retry validation or review manually.",
        )

    findings = []
    for f in parsed.get("findings", []):
        findings.append(ValidationFinding(
            capability=f.get("capability", ""),
            claimed=f.get("claimed", True),
            plausible=f.get("plausible", False),
            reasoning=f.get("reasoning", ""),
            evidence_for=f.get("evidence_for", []),
            evidence_against=f.get("evidence_against", []),
        ))

    return ValidatorResult(
        facility_id=facility_id,
        facility_name=facility.name,
        overall_assessment=parsed.get("overall_assessment", "unknown"),
        findings=findings,
        medical_standards_checked=parsed.get("medical_standards_checked", []),
        recommendation=parsed.get("recommendation", ""),
    )
