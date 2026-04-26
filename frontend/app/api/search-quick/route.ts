import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const k = searchParams.get("k") ?? "20";

  const backendResp = await fetch(
    `${BACKEND_URL}/api/search-quick?q=${encodeURIComponent(q)}&k=${encodeURIComponent(k)}`,
    { headers: { Accept: "application/json" } }
  );

  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
