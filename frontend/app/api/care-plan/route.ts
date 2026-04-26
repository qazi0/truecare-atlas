import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const backendResp = await fetch(`${BACKEND_URL}/api/care-plan`, {
    method: "POST",
    headers: await backendHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body,
  });
  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
