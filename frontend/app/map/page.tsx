import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MapPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-text-muted text-sm font-medium">Map View</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-text-muted text-sm">Desert Map — Coming Soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
