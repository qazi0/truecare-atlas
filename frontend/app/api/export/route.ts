import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const backendResp = await fetch(`${BACKEND_URL}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
