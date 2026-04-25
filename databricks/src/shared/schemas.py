"""Pydantic v2 schemas for capability extraction (Phase 2) and trust scoring (Phase 3)."""

from enum import StrEnum
from pydantic import BaseModel


class Confidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SourceField(StrEnum):
    DESCRIPTION = "description"
    CAPABILITIES = "capabilities"
    PROCEDURES = "procedures"
    EQUIPMENT = "equipment"
    SPECIALTIES = "specialties"
    MULTIPLE = "multiple"


class FacilityClass(StrEnum):
    TERTIARY_HOSPITAL = "tertiary_hospital"
    SECONDARY_HOSPITAL = "secondary_hospital"
    PRIMARY_HOSPITAL = "primary_hospital"
    SPECIALTY_CLINIC = "specialty_clinic"
    GENERAL_CLINIC = "general_clinic"
    DENTAL_CLINIC = "dental_clinic"
    DIAGNOSTIC_CENTER = "diagnostic_center"
    PHARMACY = "pharmacy"
    TRADITIONAL_MEDICINE = "traditional_medicine"
    UNKNOWN = "unknown"


class Capability(BaseModel):
    value: bool
    evidence_quote: str | None = None
    source_field: SourceField | None = None
    confidence: Confidence = Confidence.LOW


class FacilityCapabilities(BaseModel):
    has_icu: Capability
    has_nicu: Capability
    has_dialysis: Capability
    has_oncology: Capability
    has_emergency_surgery: Capability
    has_24x7: Capability
    has_maternity: Capability
    has_blood_bank: Capability
    has_anesthesia: Capability
    has_trauma: Capability
    has_cardiac_cath_lab: Capability
    facility_class: FacilityClass
    capabilities_caption: str


# JSON schema for ai_query responseFormat (strict mode)
CAPABILITIES_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "facility_capabilities",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "has_icu": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_nicu": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_dialysis": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_oncology": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_emergency_surgery": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_24x7": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_maternity": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_blood_bank": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_anesthesia": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_trauma": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                    "additionalProperties": False,
                },
                "has_cardiac_cath_lab": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "boolean"},
                        "evidence_quote": {"type": ["string", "null"]},
                        "source_field": {"type": ["string", "null"], "enum": [e.value for e in SourceField] + [None]},
                        "confidence": {"type": "string", "enum": [e.value for e in Confidence]},
                    },
                    "required": ["value", "evidence_quote", "source_field", "confidence"],
                },
                "facility_class": {
                    "type": "string",
                    "enum": [e.value for e in FacilityClass],
                },
                "capabilities_caption": {"type": "string"},
            },
            "required": [
                "has_icu", "has_nicu", "has_dialysis", "has_oncology",
                "has_emergency_surgery", "has_24x7", "has_maternity",
                "has_blood_bank", "has_anesthesia", "has_trauma",
                "has_cardiac_cath_lab", "facility_class", "capabilities_caption",
            ],
            "additionalProperties": False,
        },
    },
}
