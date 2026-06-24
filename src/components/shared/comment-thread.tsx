"use client";

import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

export interface CommentItem {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

interface CommentThreadProps {
  comments: CommentItem[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  hiddenFields: Record<string, string>;
}

export function CommentThread({ comments, action, hiddenFields }: CommentThreadProps) {
  const [pending, setPending] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
        )}
        {comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.author} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.author}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={async (fd) => {
          setPending(true);
          await action(fd);
          setPending(false);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2"
      >
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Textarea
          name="body"
          required
          placeholder="Ajouter un commentaire…"
          className="min-h-[40px] flex-1"
        />
        <Button type="submit" size="icon" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
