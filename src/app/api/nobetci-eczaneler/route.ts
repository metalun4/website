import { cityPharmacyRoute } from "@/lib/pharmacy-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export function GET(request: Request) {
  return cityPharmacyRoute(request, "izmir");
}
