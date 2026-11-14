import { notFound } from "next/navigation";
import { isPharmacyCity, pharmacyCitySlugs } from "@/lib/pharmacy-cities";
import { PharmacyHeading, pharmacyMetadata } from "../pharmacy-heading";

type Props = { params: Promise<{ city: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return pharmacyCitySlugs.map(city => ({ city }));
}

async function resolveCity(params: Props["params"]) {
  const { city } = await params;
  if (!isPharmacyCity(city)) notFound();
  return city;
}

export async function generateMetadata({ params }: Props) {
  return pharmacyMetadata(await resolveCity(params));
}

export default async function CityPharmaciesPage({ params }: Props) {
  return <PharmacyHeading city={await resolveCity(params)} />;
}
