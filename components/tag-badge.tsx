import { Tag as TagIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TagLike = { name: string; color: string };

// A colored chip for a single tag. `color` is a Tailwind class string from the
// shared accent palette (e.g. "bg-sky-500/15 text-sky-600 dark:text-sky-300").
export function TagBadge({
  tag,
  withIcon = true,
  className,
}: {
  tag: TagLike;
  withIcon?: boolean;
  className?: string;
}) {
  return (
    <Badge className={cn("border-0", tag.color, className)}>
      {withIcon ? <TagIcon className="size-3 shrink-0" /> : null}
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
}
