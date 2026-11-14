import { cityPharmacyRoute } from "@/lib/pharmacy-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET(request: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  return cityPharmacyRoute(request, city);
}
