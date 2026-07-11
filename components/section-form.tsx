"use client";

import * as React from "react";

import { ActionForm } from "@/components/action-form";
import { SpaceField } from "@/components/space-context";
import { SubmitButton } from "@/components/submit-button";
import { TagPicker } from "@/components/tag-picker";
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

export type SectionFormProps = {
  // Server action the form submits to (createSection / updateSection).
  action: (formData: FormData) => void | Promise<void>;
  // Present only when editing — emitted as a hidden field for the update action.
  sectionId?: string;
  // Flattened section list ("Parent / Child" labels) for the optional parent picker.
  sections?: { id: string; label: string }[];
  defaultName?: string;
  defaultDescription?: string;
  defaultParentId?: string;
  defaultTag?: TagOption | null;
  // Namespaces field ids so multiple forms can coexist (e.g. one per sidebar row).
  idPrefix?: string;
  submitLabel: React.ReactNode;
  pendingLabel: string;
  // Omit successMessage when `action` redirects on success (the navigation is
  // the signal); pass one for in-place updates that stay on the page.
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
};

// Shared field set for both creating and editing a section. The create dialog and
// the sidebar's edit dialog render this with different actions and defaults.
export function SectionForm({
  action,
  sectionId,
  sections,
  defaultName = "",
  defaultDescription = "",
  defaultParentId,
  defaultTag,
  idPrefix = "section",
  submitLabel,
  pendingLabel,
  successMessage,
  errorMessage,
  onSuccess,
}: SectionFormProps) {
  return (
    <ActionForm
      action={action}
      successMessage={successMessage}
      errorMessage={errorMessage ?? "Couldn't save section. Please try again."}
      onSuccess={onSuccess}
      className="space-y-4"
    >
      <SpaceField />
      {sectionId ? <input type="hidden" name="sectionId" value={sectionId} /> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`${idPrefix}-name`}>
          Section name
        </label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          placeholder="AI Engineer"
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
          rows={3}
          maxLength={240}
          defaultValue={defaultDescription}
          placeholder="What this group of projects is about."
        />
      </div>
      {sections && sections.length > 0 ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-parent`}>
            Parent section
          </label>
          <Select
            name="parentId"
            defaultValue={defaultParentId ?? ""}
            items={[
              { label: "Top level (no parent)", value: "" },
              ...sections.map((section) => ({ label: section.label, value: section.id })),
            ]}
          >
            <SelectTrigger id={`${idPrefix}-parent`} className="w-full">
              <SelectValue placeholder="Top level (no parent)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Top level (no parent)</SelectItem>
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
