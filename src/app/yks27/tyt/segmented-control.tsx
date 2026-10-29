"use client";

import { useId, useRef, type KeyboardEvent } from "react";

type Option<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onChange(options[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div className="min-w-0">
      <div id={labelId} className="mb-1.5 text-xs font-medium text-muted">{label}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="yks-segments">
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={node => { buttons.current[index] = node; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={event => onKeyDown(event, index)}
              className={`rounded-lg border text-center select-none ${selected ? "border-accent bg-accent-soft font-semibold text-accent hover:border-foreground" : "border-border hover:bg-surface-muted active:bg-surface-emphasis"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
