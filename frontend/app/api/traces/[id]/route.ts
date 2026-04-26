import { BACKEND_URL, backendHeaders } from "@/lib/backend";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const resp = await fetch(`${BACKEND_URL}/api/traces/${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: await backendHeaders({ Accept: "application/json" }),
  });
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
