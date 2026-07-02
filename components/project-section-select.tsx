"use client";

import * as React from "react";

import { updateProjectSection } from "@/app/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "";

// Move the current project into a section (or ungroup it). Submits on change so
// there's no extra save button in the header. The value is controlled so the
// hidden input is up to date before we request the form submit.
export function ProjectSectionSelect({
  projectId,
  currentSectionId,
  sections,
}: {
  projectId: string;
  currentSectionId: string | null;
  sections: { id: string; label: string }[];
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [value, setValue] = React.useState(currentSectionId ?? NONE);
  // Skip the submit that would otherwise fire for the initial value.
  const submitOnNextChange = React.useRef(false);

  React.useEffect(() => {
    if (submitOnNextChange.current) {
      submitOnNextChange.current = false;
      formRef.current?.requestSubmit();
    }
  }, [value]);

  const items = [
    { label: "No section", value: NONE },
    ...sections.map((section) => ({ label: section.label, value: section.id })),
  ];

  return (
    <form ref={formRef} action={updateProjectSection} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sectionId" value={value} />
      <label htmlFor="project-section-select" className="text-xs font-medium text-muted-foreground">
        Section
      </label>
      <Select
        value={value}
        onValueChange={(next) => {
          submitOnNextChange.current = true;
          setValue(next ?? NONE);
        }}
        items={items}
      >
        <SelectTrigger id="project-section-select" size="sm" className="w-auto">
          <SelectValue placeholder="No section" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value || "__none__"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
