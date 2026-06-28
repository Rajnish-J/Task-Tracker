"use client";

import * as React from "react";

import { getTagsAction } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { TAG_COLOR_META, TAG_COLOR_OPTIONS } from "@/lib/constants";
import { nativeSelectClass, nativeSelectOptionClass } from "@/lib/select-styles";

const NEW = "__new__";
const NONE = "";

type TagOption = { id: string; name: string; color: string };

const selectClassName = nativeSelectClass;

// Reusable, single-tag picker for any create/edit <form action={...}>. Loads the
// workspace tag pool on mount, lets the user pick an existing tag or define a new
// one, and emits hidden inputs the server action reads:
//   - tagId            → an existing tag was chosen
//   - tagName + tagColor → a brand-new tag to find-or-create
//   - (nothing)        → left untagged
export function TagPicker({
  defaultTag,
  idPrefix = "tag",
}: {
  defaultTag?: TagOption | null;
  idPrefix?: string;
}) {
  const [tags, setTags] = React.useState<TagOption[]>(defaultTag ? [defaultTag] : []);
  const [selection, setSelection] = React.useState<string>(defaultTag?.id ?? NONE);
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<string>(TAG_COLOR_OPTIONS[0]);

  React.useEffect(() => {
    let active = true;
    getTagsAction()
      .then((rows) => {
        if (!active) return;
        const merged =
          defaultTag && !rows.some((tag) => tag.id === defaultTag.id)
            ? [defaultTag, ...rows]
            : rows;
        setTags(merged);
      })
      .catch(() => {
        // Non-fatal: the picker still works for creating a new tag.
      });
    return () => {
      active = false;
    };
  }, [defaultTag]);

  const isNew = selection === NEW;
  const selectedExistingId = selection !== NEW && selection !== NONE ? selection : "";

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={`${idPrefix}-select`}>
        Tag
      </label>
      <select
        id={`${idPrefix}-select`}
        value={selection}
        onChange={(event) => setSelection(event.target.value)}
        className={selectClassName}
        aria-label="Tag"
      >
        <option className={nativeSelectOptionClass} value={NONE}>
          No tag
        </option>
        {tags.map((tag) => (
          <option className={nativeSelectOptionClass} key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
        <option className={nativeSelectOptionClass} value={NEW}>
          + New tag…
        </option>
      </select>

      {isNew ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={40}
            placeholder="New tag name"
            aria-label="New tag name"
          />
          <select
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            className={selectClassName}
            aria-label="New tag color"
          >
            {TAG_COLOR_OPTIONS.map((color) => (
              <option className={nativeSelectOptionClass} key={color} value={color}>
                {TAG_COLOR_META[color]?.label ?? "Color"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedExistingId ? (
        <input type="hidden" name="tagId" value={selectedExistingId} />
      ) : null}
      {isNew && newName.trim() ? (
        <>
          <input type="hidden" name="tagName" value={newName.trim()} />
          <input type="hidden" name="tagColor" value={newColor} />
        </>
      ) : null}
    </div>
  );
}
