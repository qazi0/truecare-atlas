import os

from pydantic_settings import BaseSettings


def _is_databricks_app() -> bool:
    return "DATABRICKS_APP_PORT" in os.environ


class Settings(BaseSettings):
    databricks_host: str = "https://dbc-d744432c-1635.cloud.databricks.com"
    databricks_profile: str = "" if _is_databricks_app() else "sj-wksp"
    warehouse_id: str = "38034fae49ef0da4"
    catalog: str = "workspace"
    schema_name: str = "default"
    chat_model: str = "databricks-meta-llama-3-3-70b-instruct"
    extraction_model: str = "databricks-meta-llama-3-3-70b-instruct"
    embedding_model: str = "databricks-gte-large-en"
    vector_search_endpoint: str = "tm_endpoint"
    vector_search_index: str = "workspace.default.facility_index"
    mlflow_experiment: str = "trustmap_india"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://*.databricksapps.com",
    ]

    model_config = {"env_prefix": "TM_", "env_file": ".env"}


settings = Settings()
