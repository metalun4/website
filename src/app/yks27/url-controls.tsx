"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function RangeControl({ value, label = "Deneme aralığı" }: { value: string; label?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  return <ToggleGroup type="single" value={value} aria-label={label} onValueChange={next => {
    if (!next) return;
    const params = new URLSearchParams(search.toString());
    if (next === "all") params.delete("range"); else params.set("range", next);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }}>{[{ value: "5", label: "Son 5" }, { value: "10", label: "Son 10" }, { value: "all", label: "Tümü" }].map(item => <ToggleGroupItem key={item.value} value={item.value} aria-current={value === item.value ? "true" : undefined}>{item.label}</ToggleGroupItem>)}</ToggleGroup>;
}

export function DetailsSwitch({ checked }: { checked: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  return <div className="yks-switch-field"><Tooltip><TooltipTrigger asChild><span className="inline-flex"><Switch id="topic-details" className="yks-switch" checked={checked} onCheckedChange={next => {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("view", "detail"); else params.delete("view");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }} /></span></TooltipTrigger><TooltipContent>Ek ölçümleri, performans yorumlarını ve konu listelerini göster.</TooltipContent></Tooltip><label htmlFor="topic-details">Ayrıntılar</label></div>;
}
