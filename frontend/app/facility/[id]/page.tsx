import { TrustPanel } from "@/components/trust-panel";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { FacilityFull } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchFacility(id: string): Promise<FacilityFull | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
  try {
    const resp = await fetch(`${backendUrl}/api/facility/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export default async function FacilityPage({ params }: Props) {
  const { id } = await params;
  const facility = await fetchFacility(id);

  if (!facility) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm font-medium text-text">Facility not found</p>
          <p className="text-xs text-text-muted font-mono mt-1">{id}</p>
        </div>
      </div>
    );
  }

  const location = [facility.address, facility.city, facility.state, facility.pincode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0">
      {/* Left: facility info */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-w-0">
        <div>
          <h1 className="text-xl font-semibold text-text">{facility.name}</h1>
          {location && (
            <p className="text-sm text-text-muted mt-0.5">{location}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {facility.facility_type && (
              <Badge variant="secondary" className="text-xs">
                {facility.facility_type}
              </Badge>
            )}
            {facility.phone && (
              <span className="text-xs font-mono text-text-muted">
                {facility.phone}
              </span>
            )}
          </div>
        </div>

        <Separator />

        {facility.description && (
          <div>
            <p className="text-sm font-medium text-text mb-1">About</p>
            <p className="text-sm text-text-muted leading-relaxed">
              {facility.description}
            </p>
          </div>
        )}

        {facility.specialties.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text mb-1">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {facility.specialties.map((s) => (
                <Badge key={s} variant="outline" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {facility.procedures.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text mb-1">Procedures</p>
            <div className="flex flex-wrap gap-1.5">
              {facility.procedures.slice(0, 12).map((p) => (
                <Badge key={p} variant="outline" className="text-xs">
                  {p}
                </Badge>
              ))}
              {facility.procedures.length > 12 && (
                <Badge variant="outline" className="text-xs text-text-muted">
                  +{facility.procedures.length - 12} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {facility.equipment.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text mb-1">Equipment</p>
            <p className="text-sm text-text-muted">
              {facility.equipment.slice(0, 8).join(", ")}
              {facility.equipment.length > 8 && ` +${facility.equipment.length - 8} more`}
            </p>
          </div>
        )}
      </div>

      {/* Right: trust panel */}
      <div
        className="lg:border-l border-t lg:border-t-0 border-border shrink-0"
        style={{ width: "100%", maxWidth: 380 }}
      >
        <TrustPanel
          facility={facility}
          report={facility.trust_report}
          isLoading={false}
        />
      </div>
    </div>
  );
}
