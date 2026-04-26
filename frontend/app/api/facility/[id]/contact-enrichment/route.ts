import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const backendResp = await fetch(`${BACKEND_URL}/api/facility/${encodeURIComponent(id)}/contact-enrichment`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
