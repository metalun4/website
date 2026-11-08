import { createPharmacyResponse } from "@/lib/pharmacy-feed";

// Cache the validated response at Vercel's CDN. A build or browser request does
// not populate a separate Next.js fetch cache with unvalidated upstream data.
export const dynamic = "force-dynamic";

export function GET() {
  return createPharmacyResponse();
}
