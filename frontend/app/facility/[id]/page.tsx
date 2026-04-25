import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FacilityPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-text-muted text-sm font-medium">Facility Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-sm text-text-muted">
            Facility {id} — Coming Soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
