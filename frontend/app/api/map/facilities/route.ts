import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function GET(_request: NextRequest) {
  const resp = await fetch(`${BACKEND_URL}/api/map/facilities`, {
    headers: { Accept: "application/json" },
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
