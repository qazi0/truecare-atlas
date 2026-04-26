import { BACKEND_URL, backendHeaders } from "@/lib/backend";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      cache: "no-store",
      headers: await backendHeaders({ Accept: "application/json" }),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json(
      { status: "error", message: "Backend unreachable" },
      { status: 502 }
    );
  }
}
