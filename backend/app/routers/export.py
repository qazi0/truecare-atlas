"""POST /api/export — NGO planning export: selected facilities as CSV or JSON."""

import csv
import io
import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from app.schemas import ExportFormat, ExportRequest, ExportRow
from app.services.databricks_sql import query_facilities_for_export

router = APIRouter(tags=["export"])

_CTRL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

_RULE_LABELS = {
    "r1_anesthesia_gap": "R1: Anesthesia gap",
    "r2_nicu_staffing_gap": "R2: NICU staffing gap",
    "r3_cancer_specialty_gap": "R3: Cancer specialty gap",
    "r4_24x7_gap": "R4: 24/7 gap",
    "r5_bed_count_contradiction": "R5: Bed count contradiction",
    "r6_modality_contradiction": "R6: Modality contradiction",
    "r7_scrape_artifact_density": "R7: Scrape artifacts",
    "r8_evidence_sparsity": "R8: Evidence sparsity",
}


def _build_export_row(row: dict) -> ExportRow:
    flags = [label for col, label in _RULE_LABELS.items() if row.get(col)]

    addr_parts = [row.get("address_line1"), row.get("address_line2"), row.get("address_line3")]
    address = ", ".join(p for p in addr_parts if p) or None

    phone_raw = row.get("phone_numbers")
    if phone_raw is not None and hasattr(phone_raw, "__iter__") and not isinstance(phone_raw, str):
        phone = ", ".join(str(x) for x in phone_raw)
    else:
        phone = str(phone_raw) if phone_raw else None

    specialties = row.get("specialties")
    if isinstance(specialties, list):
        specialties_str = "; ".join(str(s) for s in specialties if s)
    else:
        specialties_str = ""

    desc = row.get("description")
    if desc:
        desc = _CTRL_CHAR_RE.sub("", desc)

    return ExportRow(
        facility_id=row["facility_id"],
        name=row["name"],
        city=row.get("city"),
        state=row.get("state_canon"),
        pincode=row.get("pincode"),
        latitude=float(row["latitude"]) if row.get("latitude") is not None else None,
        longitude=float(row["longitude"]) if row.get("longitude") is not None else None,
        facility_type=row.get("facility_type_id"),
        phone=phone,
        address=address,
        description=desc,
        trust_score=row.get("trust_score"),
        trust_flags="; ".join(flags) if flags else "None",
        has_icu=bool(row.get("has_icu")),
        has_nicu=bool(row.get("has_nicu")),
        has_dialysis=bool(row.get("has_dialysis")),
        has_oncology=bool(row.get("has_oncology")),
        has_emergency_surgery=bool(row.get("has_emergency_surgery")),
        has_24x7=bool(row.get("has_24x7")),
        has_maternity=bool(row.get("has_maternity")),
        has_blood_bank=bool(row.get("has_blood_bank")),
        has_anesthesia=bool(row.get("has_anesthesia")),
        has_trauma=bool(row.get("has_trauma")),
        has_cardiac_cath_lab=bool(row.get("has_cardiac_cath_lab")),
        capabilities_caption=row.get("capabilities_caption") or "",
        specialties=specialties_str,
    )


@router.post("/export")
def export_facilities(request: ExportRequest):
    rows = query_facilities_for_export(request.facility_ids)
    export_rows = [_build_export_row(r) for r in rows]

    if request.format == ExportFormat.JSON:
        return JSONResponse(
            content=[r.model_dump() for r in export_rows],
            headers={"Content-Disposition": "attachment; filename=truecare_atlas_export.json"},
        )

    buf = io.StringIO()
    if export_rows:
        fields = list(ExportRow.model_fields.keys())
        writer = csv.DictWriter(buf, fieldnames=fields)
        writer.writeheader()
        for r in export_rows:
            writer.writerow(r.model_dump())

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=truecare_atlas_export_{ts}.csv"},
    )
