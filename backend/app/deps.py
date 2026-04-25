from functools import lru_cache

from databricks import sql as databricks_sql
from databricks.sdk import WorkspaceClient
from databricks_openai import DatabricksOpenAI

from app.settings import settings


@lru_cache
def get_workspace_client() -> WorkspaceClient:
    return WorkspaceClient(profile=settings.databricks_profile)


@lru_cache
def get_sql_connection():
    w = get_workspace_client()
    token = w.config.authenticate()["Authorization"].removeprefix("Bearer ")
    return databricks_sql.connect(
        server_hostname=w.config.host.replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{settings.warehouse_id}",
        access_token=token,
    )


@lru_cache
def get_fm_client() -> DatabricksOpenAI:
    return DatabricksOpenAI()
