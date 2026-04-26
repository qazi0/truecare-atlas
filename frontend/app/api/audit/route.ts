import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id param" }, { status: 400 });
  }

  const backendResp = await fetch(
    `${BACKEND_URL}/api/audit/${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } }
  );

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
