import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET() {
  const resp = await fetch(`${BACKEND_URL}/api/map/facilities`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
