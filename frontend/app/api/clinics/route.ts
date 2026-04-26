import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

const PASSTHROUGH_PARAMS = ["q", "capability", "state", "city", "status", "limit", "cursor"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const backendParams = new URLSearchParams();
  for (const key of PASSTHROUGH_PARAMS) {
    const value = searchParams.get(key);
    if (value) backendParams.set(key, value);
  }

  const resp = await fetch(`${BACKEND_URL}/api/clinics?${backendParams.toString()}`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
