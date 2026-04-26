import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "50";
  const backendResp = await fetch(`${BACKEND_URL}/api/reviews/auto-run?limit=${encodeURIComponent(limit)}`, {
    method: "POST",
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
