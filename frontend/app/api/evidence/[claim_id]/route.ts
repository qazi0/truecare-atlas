import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET(_request: NextRequest, context: { params: Promise<{ claim_id: string }> }) {
  const { claim_id } = await context.params;
  const backendResp = await fetch(`${BACKEND_URL}/api/evidence/${encodeURIComponent(claim_id)}`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
