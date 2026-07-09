"use client";

import * as React from "react";
import { ChevronDown, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ToolMeta } from "@/lib/ai/tool-catalog";

export type ToolCatalog = { category: string; tools: ToolMeta[] }[];

type ToolsPopoverProps = {
  catalog: ToolCatalog;
  disabledTools: Set<string>;
  onToggle: (name: string, enabled: boolean) => void;
};

// "Tools" chip in the composer — mirrors the reference UI: grouped tool list
// with per-tool toggles controlling which tools the assistant may call.
export function ToolsPopover({ catalog, disabledTools, onToggle }: ToolsPopoverProps) {
  const total = catalog.reduce((sum, group) => sum + group.tools.length, 0);
  const enabledCount = total - disabledTools.size;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-muted-foreground" />
        }
      >
        <Wrench className="size-3.5" />
        <span className="text-xs">Tools</span>
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          {enabledCount}
        </Badge>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
        {catalog.map((group, index) => (
          <React.Fragment key={group.category}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{group.category}</DropdownMenuLabel>
              {group.tools.map((tool) => (
                <DropdownMenuCheckboxItem
                  key={tool.name}
                  checked={!disabledTools.has(tool.name)}
                  onCheckedChange={(checked) => onToggle(tool.name, Boolean(checked))}
                  closeOnClick={false}
                >
                  {tool.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
