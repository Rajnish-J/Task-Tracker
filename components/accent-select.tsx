"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { COLUMN_ACCENT_META, COLUMN_COLOR_OPTIONS } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Swatch({ swatch, className }: { swatch: string; className?: string }) {
  return (
    <span
      className={cn(
        "size-3.5 shrink-0 rounded-full ring-1 ring-foreground/10",
        swatch,
        className,
      )}
    />
  );
}

export function AccentSelect({
  value,
  onValueChange,
  placeholder = "Select accent",
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => next && onValueChange(next)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {(val: string) => {
            const meta = COLUMN_ACCENT_META[val];
            return meta ? (
              <>
                <Swatch swatch={meta.swatch} />
                {meta.label}
              </>
            ) : null;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COLUMN_COLOR_OPTIONS.map((option) => {
          const meta = COLUMN_ACCENT_META[option];
          return (
            <SelectItem key={option} value={option}>
              <Swatch swatch={meta.swatch} />
              {meta.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
