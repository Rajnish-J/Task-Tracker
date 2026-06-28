import type { Tag } from "@/lib/data";

type Taggable = {
  tag?: Tag | null;
  storyTasks: { tag?: Tag | null }[];
};

// A card matches a tag filter if the card itself carries the tag OR any of its
// checklist items (storyTasks) does. An empty tagId means "no filter".
export function taskMatchesTag(task: Taggable, tagId: string): boolean {
  if (!tagId) return true;
  if (task.tag?.id === tagId) return true;
  return task.storyTasks.some((story) => story.tag?.id === tagId);
}

// Collect the distinct tags appearing anywhere on a board (on cards or their
// checklist items), alphabetized — so the board filter only offers tags that
// can actually narrow the view.
export function collectBoardTags(tasks: Taggable[]): Tag[] {
  const byId = new Map<string, Tag>();
  for (const task of tasks) {
    if (task.tag) byId.set(task.tag.id, task.tag);
    for (const story of task.storyTasks) {
      if (story.tag) byId.set(story.tag.id, story.tag);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
