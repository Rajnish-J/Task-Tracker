"use client";

import * as React from "react";

import { ActionForm } from "@/components/action-form";
import { SpaceField } from "@/components/space-context";
import { SubmitButton } from "@/components/submit-button";
import { TagPicker } from "@/components/tag-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TagOption = { id: string; name: string; color: string };

export type ProjectFormProps = {
  // Server action the form submits to (createProject / updateProject).
  action: (formData: FormData) => void | Promise<void>;
  // Present only when editing — emitted as a hidden field for the update action.
  projectId?: string;
  // Pass the flattened section list to show the section picker.
  sections?: { id: string; label: string }[];
  defaultName?: string;
  defaultDescription?: string;
  defaultSectionId?: string;
  defaultDueDate?: string;
  defaultTag?: TagOption | null;
  // Namespaces field ids so multiple forms can coexist (e.g. one per sidebar row).
  idPrefix?: string;
  submitLabel: string;
  pendingLabel: string;
  // Omit successMessage when `action` redirects on success (the navigation is
  // the signal); pass one for in-place updates that stay on the page.
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
};

// Shared field set for both creating and editing a project. The create dialog and
// the sidebar's edit dialog render this with different actions and defaults.
export function ProjectForm({
  action,
  projectId,
  sections,
  defaultName = "",
  defaultDescription = "",
  defaultSectionId,
  defaultDueDate,
  defaultTag,
  idPrefix = "project",
  submitLabel,
  pendingLabel,
  successMessage,
  errorMessage,
  onSuccess,
}: ProjectFormProps) {
  return (
    <ActionForm
      action={action}
      successMessage={successMessage}
      errorMessage={errorMessage ?? "Couldn't save project. Please try again."}
      onSuccess={onSuccess}
      className="space-y-4"
    >
      <SpaceField />
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-name`}>
          Project name
        </label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="Website redesign"
          defaultValue={defaultName}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-description`}>
          Description
        </label>
        <Textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={4}
          maxLength={240}
          defaultValue={defaultDescription}
          placeholder="Scope, delivery notes, or how this board will be used."
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-due-date`}>
          Due date
        </label>
        <DatePicker
          id={`${idPrefix}-due-date`}
          name="dueDate"
          defaultValue={defaultDueDate}
        />
      </div>
      {sections && sections.length > 0 ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-section`}>
            Section
          </label>
          <Select
            name="sectionId"
            defaultValue={defaultSectionId ?? ""}
            items={[
              { label: "No section", value: "" },
              ...sections.map((section) => ({ label: section.label, value: section.id })),
            ]}
          >
            <SelectTrigger id={`${idPrefix}-section`} className="w-full">
              <SelectValue placeholder="No section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No section</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <TagPicker idPrefix={`${idPrefix}-tag`} defaultTag={defaultTag} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
