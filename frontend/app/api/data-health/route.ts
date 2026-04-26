import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/data-health`, {
      cache: "no-store",
      headers: await backendHeaders({ Accept: "application/json" }),
    });
    const data = await resp.json();
    return Response.json(data, { status: resp.status });
  } catch {
    return Response.json({ status: "error", checks: {}, metrics: {}, pipeline: [], governance: [] }, { status: 502 });
  }
}
