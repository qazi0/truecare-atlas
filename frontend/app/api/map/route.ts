import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

// Proxy GET /api/map?capability=<cap>&level=<level> to backend aggregates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const capability = searchParams.get("capability") ?? "has_nicu";
  const level = searchParams.get("level") ?? "state";

  const backendResp = await fetch(
    `${BACKEND_URL}/api/map/aggregates?capability=${encodeURIComponent(capability)}&level=${encodeURIComponent(level)}`,
    {
      method: "GET",
      headers: await backendHeaders({ Accept: "application/json" }),
    }
  );

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
