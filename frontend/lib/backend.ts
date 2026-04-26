const DEFAULT_BACKEND_URL = "http://localhost:8000";

export const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  DEFAULT_BACKEND_URL;

let cachedOAuthToken: { value: string; expiresAt: number } | null = null;

async function getDatabricksToken(): Promise<string | null> {
  const host = process.env.DATABRICKS_HOST;
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;

  if (host && clientId && clientSecret) {
    const now = Date.now();
    if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60_000) {
      return cachedOAuthToken.value;
    }

    const resp = await fetch(`${host.replace(/\/$/, "")}/oidc/v1/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "all-apis",
      }),
    });

    if (!resp.ok) {
      throw new Error(`Databricks OAuth failed: HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as {
      access_token: string;
      expires_in?: number;
    };
    cachedOAuthToken = {
      value: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };
    return cachedOAuthToken.value;
  }

  return process.env.DATABRICKS_TOKEN ?? null;
}

export async function backendHeaders(
  headers: HeadersInit = {},
): Promise<HeadersInit> {
  const token = await getDatabricksToken();

  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
