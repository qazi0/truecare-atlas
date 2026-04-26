import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "10";
  const resp = await fetch(`${BACKEND_URL}/api/traces/recent?limit=${encodeURIComponent(limit)}`, {
    cache: "no-store",
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
