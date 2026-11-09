"use client";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code, Heading1, Heading2, Italic, List, ListChecks, ListOrdered, Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function Editor({ value, onSave, placeholder = "Write notes… Markdown works: # heading, - list, [] todo, > quote", className, minHeight = 220, toolbar = true }: { value: string; onSave: (html: string) => void | Promise<void>; placeholder?: string; className?: string; minHeight?: number; toolbar?: boolean }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
      Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: { attributes: { class: "prose-frio", style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      latest.current = html;
      setState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await saveRef.current(html);
        setState("saved");
      }, 700);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== latest.current && !editor.isFocused) {
      latest.current = value;
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void saveRef.current(latest.current);
    }
  }, []);

  const btn = (active: boolean) => cn("flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink", active && "bg-active text-ink");
  return (
    <div className={cn("relative", className)}>
      {toolbar && editor && (
        <div className="sticky top-12 z-10 -mx-1 mb-2 flex items-center gap-0.5 bg-bg/90 px-1 py-1 backdrop-blur md:top-0">
          <button type="button" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Heading 1"><Heading1 className="h-4 w-4" /></button>
          <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading 2"><Heading2 className="h-4 w-4" /></button>
          <span className="mx-1 h-4 w-px bg-line" />
          <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="h-3.5 w-3.5" /></button>
          <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()} aria-label="Code"><Code className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-4 w-px bg-line" />
          <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list"><List className="h-4 w-4" /></button>
          <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></button>
          <button type="button" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()} aria-label="Checklist"><ListChecks className="h-4 w-4" /></button>
          <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote"><Quote className="h-3.5 w-3.5" /></button>
          <span className="ml-auto pr-1 text-[11.5px] text-faint">{state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}</span>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
