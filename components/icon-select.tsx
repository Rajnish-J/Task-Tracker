"use client";

import * as React from "react";

import { TEAM_ICON_OPTIONS } from "@/lib/constants";
import { TEAM_ICON_META } from "@/lib/team-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function IconSelect({
  value,
  onValueChange,
  placeholder = "Select icon",
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
            const meta = TEAM_ICON_META[val];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <>
                <Icon className="size-4 shrink-0" />
                {meta.label}
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TEAM_ICON_OPTIONS.map((option) => {
          const meta = TEAM_ICON_META[option];
          const Icon = meta.icon;
          return (
            <SelectItem key={option} value={option}>
              <Icon className="size-4 shrink-0" />
              {meta.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
