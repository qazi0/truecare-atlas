import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

interface Context {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await request.text();
  const resp = await fetch(`${BACKEND_URL}/api/reviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await backendHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body,
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { id } = await context.params;
  const resp = await fetch(`${BACKEND_URL}/api/reviews/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
