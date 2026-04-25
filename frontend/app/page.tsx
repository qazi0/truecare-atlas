"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 h-full">
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight shrink-0">
          TrustMap India
        </h1>
        <div className="flex-1">
          <Input
            placeholder="Find facilities in Bihar with NICU + emergency C-section + blood bank…"
            className="w-full bg-surface"
          />
        </div>
        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-text-muted text-sm">
              Enter a query to search 10,000 facilities
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
