import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET() {
  const backendResp = await fetch(`${BACKEND_URL}/api/reviews/summary`, {
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await backendResp.json();
  return Response.json(data, { status: backendResp.status });
}
