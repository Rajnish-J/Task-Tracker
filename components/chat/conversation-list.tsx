"use client";

import * as React from "react";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ConversationSummary } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ConversationListProps = {
  activeId: string | null;
  // Bump to re-fetch (e.g. after the first message of a new chat creates one).
  refreshKey: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Full-height drawer of the /chat page: "New chat" + previous conversations.
export function ConversationList({
  activeId,
  refreshKey,
  onSelect,
  onNew,
  open,
  onOpenChange,
}: ConversationListProps) {
  const [items, setItems] = React.useState<ConversationSummary[] | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ConversationSummary | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/conversations")
      .then((response) => (response.ok ? response.json() : { conversations: [] }))
      .then((payload) => {
        if (!cancelled) setItems(payload.conversations ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chat/conversations/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      setItems((current) => current?.filter((item) => item.id !== pendingDelete.id) ?? null);
      if (activeId === pendingDelete.id) onNew();
      toast.success("Conversation deleted");
    } catch {
      toast.error("Could not delete the conversation");
    } finally {
      setIsDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 rounded-xl border p-0 data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:h-auto data-[side=right]:max-h-[calc(100vh-2rem)] sm:max-w-xs"
        >
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
              <Plus className="size-4" />
              New chat
            </Button>
          </div>
          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {items === null ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No conversations yet
              </p>
            ) : (
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
                        activeId === item.id && "bg-accent",
                      )}
                    >
                      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate pr-5">{item.title}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete conversation"
                      className="absolute top-1/2 right-1 size-6 -translate-y-1/2 opacity-0 group-hover:opacity-100"
                      onClick={() => setPendingDelete(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={pendingDelete !== null} onOpenChange={(isOpen) => !isOpen && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title}” and its messages will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
