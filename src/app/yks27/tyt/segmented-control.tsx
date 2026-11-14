"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="min-w-0"><p className="mb-2 text-xs text-muted">{label}</p><ToggleGroup type="single" value={value} aria-label={label} className="max-w-full flex-wrap" onValueChange={next => { if(next) onChange(next as T); }}>{options.map(option => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}</ToggleGroup></div>;
}
