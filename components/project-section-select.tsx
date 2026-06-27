"use client";

import * as React from "react";

import { updateProjectSection } from "@/app/actions";

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
        <option value="">No section</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
      </select>
    </form>
  );
}
