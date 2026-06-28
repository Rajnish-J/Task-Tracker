"use client";

import * as React from "react";

import { updateProjectSection } from "@/app/actions";
import { cn } from "@/lib/utils";
import { nativeSelectClass, nativeSelectOptionClass } from "@/lib/select-styles";

const selectClassName = cn(nativeSelectClass, "w-auto py-0");

// Move the current project into a section (or ungroup it). Submits on change so
// there's no extra save button in the header.
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

  return (
    <form ref={formRef} action={updateProjectSection} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <label htmlFor="project-section-select" className="text-xs font-medium text-muted-foreground">
        Section
      </label>
      <select
        id="project-section-select"
        name="sectionId"
        defaultValue={currentSectionId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClassName}
      >
        <option className={nativeSelectOptionClass} value="">
          No section
        </option>
        {sections.map((section) => (
          <option className={nativeSelectOptionClass} key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
      </select>
    </form>
  );
}
