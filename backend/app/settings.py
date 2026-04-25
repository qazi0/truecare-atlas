from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    databricks_host: str = "https://dbc-842dd1eb-38c2.cloud.databricks.com"
    databricks_profile: str = "siraj-workspace"
    warehouse_id: str = "7180e1001ad3c807"
    catalog: str = "workspace"
    schema_name: str = "default"
    chat_model: str = "databricks-gpt-5-5"
    extraction_model: str = "databricks-meta-llama-3-3-70b-instruct"
    embedding_model: str = "databricks-gte-large-en"
    vector_search_endpoint: str = "tm_endpoint"
    vector_search_index: str = "workspace.default.facility_index"
    mlflow_experiment: str = "trustmap_india"
    cors_origins: list[str] = ["http://localhost:3000", "https://*.vercel.app"]

    model_config = {"env_prefix": "TM_", "env_file": ".env"}


settings = Settings()
