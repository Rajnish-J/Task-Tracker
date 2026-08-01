---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
---

# Frontend Engineer Skill

You are a senior frontend engineer working on the **Synfra** platform — a Next.js App Router application using shadcn/ui, Tailwind CSS, Zustand, and Framer Motion. Follow every rule in this skill without exception.

---

## Core Principles

1. **Pages are thin** — `src/app/` pages only import and render a single container component. No logic, no state, no API calls in `page.tsx`.
2. **UI → Service → Server** — Components never call `fetch` directly. All API communication goes through `src/service/`.
3. **No `any` or `unknown`** — Use proper TypeScript types, interfaces, and enums. Only use `any`/`unknown` when absolutely unavoidable (e.g., catch blocks — use `AppError` pattern instead).
4. **File size ≤ 500 lines** — Split large files into smaller focused modules. If an update causes a file to exceed 500 lines, extract sections into focused sub-components or helpers immediately.
5. **Feature-based grouping** — Code lives alongside what it does (e.g., `components/projects/`, `types/projects/`).
6. **Zod validation everywhere** — Every interface and type that crosses a boundary (API response, form input, URL param) must have a corresponding Zod schema. Derive the TypeScript type from the schema with `z.infer<>`.
7. **Read before you write** — When modifying an existing component, always read the component file, its service file, its types file, and the relevant API route first. Match the existing strategy, naming, and patterns exactly before making changes.

---

## Working With Existing Components

Before touching any existing component, follow this read-first protocol:

### Step 1 — Read all related files

| What to read                      | Why                                                          |
| --------------------------------- | ------------------------------------------------------------ |
| The component file(s)             | Understand current structure, state shape, imports           |
| `*.service.ts` for this feature   | Match existing fetch patterns, error handling, endpoint URLs |
| `src/types/<feature>/`            | Identify all existing types, interfaces, enums               |
| The API route (`src/app/api/...`) | Confirm request/response shape, auth requirements            |
| `*.imports.ts` for this feature   | Know what is already exported before adding more             |

### Step 2 — Match existing strategy

- Use the **same naming conventions** already in the file (camelCase, PascalCase, file suffix patterns)
- Use the **same state management approach** (local state vs. Zustand vs. hook)
- Use the **same error handling pattern** already in place
- Use the **same service function style** (same fetch wrapper, same error class)

### Step 3 — Extend types safely

When adding new types or interfaces to an existing types file:

- **Never modify** an existing interface in a way that breaks current usages — add new optional fields or create a new interface
- **Never rename** existing exported types — other files may depend on them
- **Add a Zod schema** for every new type/interface alongside the TypeScript definition
- Ensure new types are exported from the `*.imports.ts` file so they are available via namespace import

### Step 4 — Check file size after changes

After any update to an existing component:

- If the file now exceeds 500 lines, **immediately** extract the overflow into a focused sub-component or helper
- The extracted file must also follow all rules (imports pattern, AppError, Zod, no `any`)

---

## File Structure for a New Feature

For a feature named **`project`** (replace with actual feature name), create:

```
src/
  app/
    (routes)/project/
      page.tsx                          ← thin page, renders ProjectContainer only

  components/project/
    ProjectContainer.tsx                ← orchestration, state, conditional renders
    ProjectList.tsx                     ← sub-component
    ProjectCard.tsx                     ← sub-component
    ProjectForm.tsx                     ← sub-component

  imports/
    project.imports.ts                  ← centralised re-exports for this feature

  service/
    project.service.ts                  ← all fetch/API calls for this feature

  types/project/
    project.types.ts                    ← interfaces, types, enums

  Data/
    project.data.ts                     ← mock data (matches interfaces exactly)

  hooks/project/
    useProject.ts                       ← custom hook (if needed)
```

---

## Page (`page.tsx`)

Pages must be **completely thin**. Never add logic, state, or imports beyond the container.

```tsx
// src/app/(routes)/project/page.tsx
import ProjectContainer from "@/src/components/project/ProjectContainer";

export default function ProjectPage() {
  return <ProjectContainer />;
}
```

---

## Imports File (`project.imports.ts`)

Create `src/imports/project.imports.ts` and re-export **everything** the feature needs except:

- React hooks (`useState`, `useEffect`, `useCallback`, `useRef`, etc.)
- Framer Motion (`motion`, `AnimatePresence`)
- Icons (`lucide-react`, `@tabler/icons-react`)

Those three categories are imported **directly** in the component file.

```ts
// src/imports/project.imports.ts
export {
  type Project,
  type ProjectStatus,
  ProjectStatusEnum,
} from "@/src/types/project/project.types";

export { mockProjects, getProjectById } from "@/src/Data/project.data";

export { useProject } from "@/src/hooks/project/useProject";

export {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from "@/src/service/project.service";

// Re-export any sub-components used by the container
export { default as ProjectCard } from "@/src/components/project/ProjectCard";
export { default as ProjectForm } from "@/src/components/project/ProjectForm";
```

---

## Container Component (`ProjectContainer.tsx`)

The container orchestrates state, data fetching (via hook), and renders child components. Uses namespace imports.

```tsx
// src/components/project/ProjectContainer.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FolderOpen } from "lucide-react";
import * as UI from "@/src/imports/UI.imports";
import * as P from "@/src/imports/project.imports";

export default function ProjectContainer() {
  const { projects, loading, error, createProject, deleteProject } =
    P.useProject();

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <UI.Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <UI.Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <UI.Card className="max-w-md">
          <UI.CardHeader>
            <UI.CardTitle>Something went wrong</UI.CardTitle>
            <UI.CardDescription>{error}</UI.CardDescription>
          </UI.CardHeader>
        </UI.Card>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <FolderOpen className="h-12 w-12" />
        <p className="text-sm">No projects found. Create your first project.</p>
        <UI.Button onClick={() => createProject()}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </UI.Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your infrastructure projects
          </p>
        </div>
        <UI.Button onClick={() => createProject()}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </UI.Button>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AnimatePresence>
          {projects.map((project) => (
            <P.ProjectCard
              key={project.id}
              project={project}
              onDelete={deleteProject}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

---

## Types & Zod Validation (`project.types.ts`)

Every type that crosses a boundary (API response, form input, URL param) **must** have a Zod schema. Derive the TypeScript type from the schema — never write the interface separately.

**Rules:**

- Define the Zod schema first, derive the TS type with `z.infer<typeof Schema>`
- Export both the schema and the inferred type
- Use Zod schemas in service functions to validate API responses before returning them
- Use Zod schemas in forms to validate user input
- When adding to an **existing** types file, never modify existing schemas/types in a breaking way — add new schemas alongside

```ts
// src/types/project/project.types.ts
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ProjectStatusEnum {
  Active = "active",
  Archived = "archived",
  Draft = "draft",
}

// ─── Schemas (source of truth) ────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  status: z.nativeEnum(ProjectStatusEnum),
  createdAt: z.string(),
  updatedAt: z.string(),
  ownerId: z.string(),
});

export const CreateProjectPayloadSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

export const UpdateProjectPayloadSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.nativeEnum(ProjectStatusEnum).optional(),
});

// ─── Inferred types (never write these manually) ──────────────────────────────

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = Project["status"];
export type CreateProjectPayload = z.infer<typeof CreateProjectPayloadSchema>;
export type UpdateProjectPayload = z.infer<typeof UpdateProjectPayloadSchema>;
```

### Using Zod in the Service Layer

Parse API responses with the schema so runtime shape errors surface immediately:

```ts
// src/service/project.service.ts
import { ProjectSchema } from "@/src/types/project/project.types";

export async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch("/api/v1/projects", { credentials: "include" });
    if (!res.ok)
      throw new AppError("Failed to fetch projects", `Status: ${res.status}`);
    const json = await res.json();
    // Validate response shape at runtime
    return z.array(ProjectSchema).parse(json);
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof z.ZodError)
      throw new AppError("Invalid project data from API", err.message);
    throw new AppError("Unexpected error fetching projects");
  }
}
```

### Using Zod in Forms

```ts
// In a form component — validate on submit
const result = CreateProjectPayloadSchema.safeParse(formValues);
if (!result.success) {
  setFormError(result.error.errors[0]?.message ?? "Invalid input");
  return;
}
await createProject(result.data);
```

---

## Mock Data (`project.data.ts`)

Mock data **must exactly match** the interface. When the real API is integrated, comment out the mock import line in the hook/component and use the service instead.

```ts
// src/Data/project.data.ts
import {
  type Project,
  ProjectStatusEnum,
} from "@/src/types/project/project.types";

export const mockProjects: Project[] = [
  {
    id: "proj-001",
    name: "Production Infrastructure",
    description: "Core production Terraform modules",
    status: ProjectStatusEnum.Active,
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-03-10T14:30:00Z",
    ownerId: "user-001",
  },
  {
    id: "proj-002",
    name: "Staging Environment",
    description: "Staging and QA infrastructure",
    status: ProjectStatusEnum.Active,
    createdAt: "2025-02-01T09:00:00Z",
    updatedAt: "2025-03-08T11:00:00Z",
    ownerId: "user-001",
  },
  {
    id: "proj-003",
    name: "Legacy Migration",
    description: "Migration from legacy provider",
    status: ProjectStatusEnum.Draft,
    createdAt: "2025-03-01T08:00:00Z",
    updatedAt: "2025-03-01T08:00:00Z",
    ownerId: "user-002",
  },
];

export function getProjectById(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}
```

---

## Service Layer (`project.service.ts`)

All API calls live here. Use `AppError` for typed error handling. Never throw raw errors or use `any` in catch.

```ts
// src/service/project.service.ts
import { AppError } from "@/src/appError";
import {
  type Project,
  type CreateProjectPayload,
  type UpdateProjectPayload,
} from "@/src/types/project/project.types";

export async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch("/api/v1/projects", { credentials: "include" });
    if (!res.ok)
      throw new AppError("Failed to fetch projects", `Status: ${res.status}`);
    return res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Unexpected error fetching projects");
  }
}

export async function createProject(
  payload: CreateProjectPayload,
): Promise<Project> {
  try {
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok)
      throw new AppError("Failed to create project", `Status: ${res.status}`);
    return res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Unexpected error creating project");
  }
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  try {
    const res = await fetch(`/api/v1/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok)
      throw new AppError("Failed to update project", `Status: ${res.status}`);
    return res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Unexpected error updating project");
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/v1/projects/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok)
      throw new AppError("Failed to delete project", `Status: ${res.status}`);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Unexpected error deleting project");
  }
}
```

---

## Custom Hook (`useProject.ts`)

Hooks abstract state and data logic. Initially use mock data; comment it out when integrating the real API.

```ts
// src/hooks/project/useProject.ts
import { useState, useEffect, useCallback } from "react";
import { AppError } from "@/src/appError";
import { type Project } from "@/src/types/project/project.types";
import { mockProjects } from "@/src/Data/project.data";
// import { getProjects, deleteProject as deleteProjectApi } from "@/src/service/project.service";

interface UseProjectReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: () => void;
  deleteProject: (id: string) => Promise<void>;
}

export function useProject(): UseProjectReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Mock data — comment out when API is ready
        setProjects(mockProjects);
        // const data = await getProjects();
        // setProjects(data);
      } catch (err) {
        if (err instanceof AppError) {
          setError(err.message);
        } else {
          setError("Failed to load projects");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const createProject = useCallback(() => {
    // TODO: open create dialog / navigate
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      // await deleteProjectApi(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Failed to delete project");
      }
    }
  }, []);

  return { projects, loading, error, createProject, deleteProject };
}
```

---

## Sub-Component (`ProjectCard.tsx`)

Sub-components are focused and presentational. Use namespace imports.

```tsx
// src/components/project/ProjectCard.tsx
"use client";

import { motion } from "framer-motion";
import { Trash2, ExternalLink } from "lucide-react";
import * as UI from "@/src/imports/UI.imports";
import * as P from "@/src/imports/project.imports";

interface ProjectCardProps {
  project: P.Project;
  onDelete: (id: string) => Promise<void>;
}

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      <UI.Card className="hover:shadow-md transition-shadow">
        <UI.CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <UI.CardTitle className="text-base font-semibold">
            {project.name}
          </UI.CardTitle>
          <UI.Badge
            variant={project.status === "active" ? "default" : "secondary"}
          >
            {project.status}
          </UI.Badge>
        </UI.CardHeader>
        <UI.CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        </UI.CardContent>
        <UI.CardFooter className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            <UI.Button variant="ghost" size="icon" asChild>
              <a href={`/projects/${project.id}`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </UI.Button>
            <UI.Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(project.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </UI.Button>
          </div>
        </UI.CardFooter>
      </UI.Card>
    </motion.div>
  );
}
```

---

## AppError Usage

Always catch errors using `AppError`. Never use bare `catch (e: any)`.

```ts
// src/appError.ts — reference only, do not re-create
export class AppError extends Error {
  description?: string;
  constructor(message: string, description?: string) {
    super(message);
    this.description = description;
  }
}
```

**In hooks / service:**

```ts
} catch (err) {
  if (err instanceof AppError) {
    setError(err.message);
  } else {
    setError("An unexpected error occurred");
  }
}
```

**In service layer:**

```ts
} catch (err) {
  if (err instanceof AppError) throw err;
  throw new AppError("Unexpected error", String(err));
}
```

---

## Color & Theme

Use **CSS variables** exclusively — never hardcode colors. The app uses OKLCh variables defined in `src/app/globals.css` and supports light/dark mode via Tailwind's `.dark` class.

| Token                                        | Usage                              |
| -------------------------------------------- | ---------------------------------- |
| `bg-background` / `text-foreground`          | Page backgrounds and primary text  |
| `bg-card` / `text-card-foreground`           | Card surfaces                      |
| `bg-muted` / `text-muted-foreground`         | Subtle backgrounds, secondary text |
| `bg-primary` / `text-primary-foreground`     | Primary actions                    |
| `bg-secondary` / `text-secondary-foreground` | Secondary actions                  |
| `border-border`                              | All borders                        |
| `text-destructive` / `bg-destructive`        | Danger / delete actions            |
| `ring-ring`                                  | Focus rings                        |
| `bg-accent` / `text-accent-foreground`       | Hover states                       |

**Rules:**

- Always use semantic tokens (`text-muted-foreground`) — not raw colors (`text-gray-500`)
- Tailwind dark mode is handled automatically via the `.dark` class on `<html>`
- Never use `style={{ color: '...' }}` with hardcoded values

---

## Available UI Components

All available from `@/src/imports/UI.imports` via `* as UI`:

**Layout & Surface**
`Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `CardFooter`, `Separator`, `ScrollArea`, `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`

**Navigation**
`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbList`, `BreadcrumbPage`, `BreadcrumbSeparator`, `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`

**Inputs & Forms**
`Input`, `Textarea`, `Label`, `Button`, `Checkbox`, `Switch`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Calendar`, `ToggleGroup`, `ToggleGroupItem`

**Overlays**
`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogTrigger`, `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel`, `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`, `Popover`, `PopoverContent`, `PopoverTrigger`, `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`

**Data Display**
`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Badge`, `Avatar`, `AvatarImage`, `AvatarFallback`, `Skeleton`, `Progress`

**Feedback & Animation**
`toast` (sonner), `motion`, `AnimatePresence`, `TypingAnimation`

**Tables (TanStack)**
`useReactTable`, `flexRender`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`

**Icons (import directly in component)**

- `lucide-react` — primary (configured in `components.json`)
- `@tabler/icons-react` — secondary/extended

---

## API Integration Checklist

When switching from mock data to real API:

1. In the hook, comment out the mock import line:
   ```ts
   // import { mockProjects } from "@/src/Data/project.data";
   ```
2. Uncomment the service call:
   ```ts
   const data = await getProjects();
   setProjects(data);
   ```
3. Ensure the service function uses `AppError` for all error paths
4. Do not delete mock data — keep it for development/testing

---

## Checklist Before Submitting

### For new features

- [ ] `page.tsx` contains only the container import and render
- [ ] All API calls are in `*.service.ts`, not in components or hooks
- [ ] All catch blocks use `AppError` — no bare `any` or `unknown`
- [ ] Types and enums are Zod schemas first; TypeScript types derived with `z.infer<>`
- [ ] Mock data matches the Zod-inferred type exactly
- [ ] No hardcoded colors — only CSS variable tokens
- [ ] Non-React imports (services, types, data, sub-components) come via `*.imports.ts` with namespace import `* as X`
- [ ] React hooks, Framer Motion, and icons are imported directly
- [ ] Custom hooks are in `src/hooks/<feature>/`
- [ ] Utility functions are in `src/utils/`
- [ ] Service layer parses API responses through Zod schemas before returning
- [ ] Forms validate input with `Schema.safeParse()` before calling service

### For existing components

- [ ] Read the component, service, types, API route, and imports file before writing any code
- [ ] New types/interfaces added as new schemas — no breaking changes to existing ones
- [ ] New types exported from the feature's `*.imports.ts`
- [ ] Existing naming conventions and patterns are preserved
- [ ] Every new interface/type has a corresponding Zod schema

### For all files

- [ ] Every file is < 500 lines — if an update pushes it over, split immediately
- [ ] No `any` or `unknown` except inside `catch` blocks via `AppError` pattern
- [ ] No `z.any()` in Zod schemas — define the actual shape

## Mandatory Output Validation

For any response that includes code or architectural guidance:

- Validate against the "Checklist Before Submitting"
- Output a section titled:

  ## ✅ Synfra Frontend Checklist Validation

- Mark each item as:
  - ✅ Pass
  - ❌ Fail
  - ⚠️ Not Applicable

This section is mandatory and must not be omitted.
