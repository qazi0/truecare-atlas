import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

// Proxy GET /api/facility?id=<facility_id> to backend
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id param" }, { status: 400 });
  }

  const backendResp = await fetch(`${BACKEND_URL}/api/facility/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: await backendHeaders({ Accept: "application/json" }),
  });

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
