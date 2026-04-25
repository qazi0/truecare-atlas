import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Proxy GET /api/map?capability=<cap>&level=<level> to backend aggregates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const capability = searchParams.get("capability") ?? "has_nicu";
  const level = searchParams.get("level") ?? "state";

  const backendResp = await fetch(
    `${BACKEND_URL}/api/map/aggregates?capability=${encodeURIComponent(capability)}&level=${encodeURIComponent(level)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
