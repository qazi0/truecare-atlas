import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const capability = searchParams.get("capability") ?? "has_nicu";
  const level = searchParams.get("level") ?? "state";
  const resp = await fetch(
    `${BACKEND_URL}/api/map/aggregates/ci?capability=${encodeURIComponent(capability)}&level=${encodeURIComponent(level)}`,
    { headers: await backendHeaders({ Accept: "application/json" }) },
  );
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
