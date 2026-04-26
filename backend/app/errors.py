"""Domain exceptions for TrueCare Atlas backend."""


class FacilityNotFoundError(Exception):
    """Raised when a facility_id has no matching row in gold_facility_trust."""

    def __init__(self, facility_id: str) -> None:
        self.facility_id = facility_id
        super().__init__(f"Facility not found: {facility_id}")


class DatabricksQueryError(Exception):
    """Raised when a Databricks SQL query fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message)


class VectorSearchError(Exception):
    """Raised when a vector search index query fails."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
