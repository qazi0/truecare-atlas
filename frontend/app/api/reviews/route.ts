import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resp = await fetch(`${BACKEND_URL}/api/reviews?${searchParams.toString()}`, {
    cache: "no-store",
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const resp = await fetch(`${BACKEND_URL}/api/reviews`, {
    method: "POST",
    headers: await backendHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body,
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
