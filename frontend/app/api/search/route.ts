import { NextRequest } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Proxy POST /api/search to backend, streaming SSE through
export async function POST(request: NextRequest) {
  const body = await request.text();

  const backendResp = await fetch(`${BACKEND_URL}/api/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
  });

  if (!backendResp.ok || !backendResp.body) {
    return new Response(await backendResp.text(), {
      status: backendResp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(backendResp.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
