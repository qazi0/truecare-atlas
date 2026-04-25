from functools import lru_cache

from databricks import sql as databricks_sql
from databricks_openai import DatabricksOpenAI

from app.settings import settings


@lru_cache
def get_sql_connection():
    return databricks_sql.connect(
        server_hostname=settings.databricks_host.replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{settings.warehouse_id}",
        access_token=settings.databricks_token,
    )


@lru_cache
def get_fm_client() -> DatabricksOpenAI:
    return DatabricksOpenAI()
