import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const backendResp = await fetch(`${BACKEND_URL}/api/export`, {
    method: "POST",
    headers: await backendHeaders({ "Content-Type": "application/json" }),
    body,
  });

  const contentType = backendResp.headers.get("content-type") ?? "";

  if (contentType.includes("text/csv")) {
    return new Response(backendResp.body, {
      status: backendResp.status,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition":
          backendResp.headers.get("content-disposition") ??
          'attachment; filename="export.csv"',
      },
    });
  }

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
