import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resp = await fetch(`${BACKEND_URL}/api/search-nearby?${searchParams.toString()}`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
