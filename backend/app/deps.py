from functools import lru_cache

from databricks import sql as databricks_sql
from databricks.sdk import WorkspaceClient
from databricks_openai import DatabricksOpenAI

from app.settings import settings


@lru_cache
def get_workspace_client() -> WorkspaceClient:
    if settings.databricks_profile:
        return WorkspaceClient(profile=settings.databricks_profile)
    # On Databricks Apps: SP auth is auto-injected via env vars
    return WorkspaceClient()


@lru_cache
def get_sql_connection():
    w = get_workspace_client()
    cfg = w.config
    return databricks_sql.connect(
        server_hostname=cfg.host.replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{settings.warehouse_id}",
        credentials_provider=lambda: cfg.authenticate,
    )


@lru_cache
def get_fm_client() -> DatabricksOpenAI:
    w = get_workspace_client()
    return DatabricksOpenAI(workspace_client=w)
