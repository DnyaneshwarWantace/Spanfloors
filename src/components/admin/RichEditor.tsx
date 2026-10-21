"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import MediaLibrary from "./MediaLibrary";
import { btn, inputCls } from "./ui";

const tool =
  "grid h-8 min-w-8 place-items-center px-1.5 text-2xs text-ink-2 transition-colors hover:bg-paper-2 aria-pressed:bg-ink aria-pressed:text-paper disabled:opacity-40";

function Toolbar({ editor, onImage, html, onToggleHtml }: { editor: Editor; onImage: () => void; html: boolean; onToggleHtml: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (!url || url === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: /^https?:\/\//.test(url) && !url.includes("spanfloors.com") ? "_blank" : null }).run();
  };

  const embedVideo = () => {
    const url = window.prompt("YouTube video URL");
    const id = url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1];
    if (id)
      editor
        .chain()
        .focus()
        .insertContent(`<p><iframe src="https://www.youtube-nocookie.com/embed/${id}" width="640" height="360" allowfullscreen title="Video"></iframe></p>`)
        .run();
  };

  const c = () => editor.chain().focus();
  return (
    <div className="sticky top-[4.6rem] z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-paper px-1.5 py-1" role="toolbar" aria-label="Formatting">
      <button type="button" className={tool} aria-pressed={s.p} onClick={() => c().setParagraph().run()} title="Paragraph" disabled={html}>
        ¶
      </button>
      <button type="button" className={tool} aria-pressed={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Heading" disabled={html}>
        H2
      </button>
      <button type="button" className={tool} aria-pressed={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Subheading" disabled={html}>
        H3
      </button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button type="button" className={`${tool} font-bold`} aria-pressed={s.bold} onClick={() => c().toggleBold().run()} title="Bold (⌘B)" disabled={html}>
        B
      </button>
      <button type="button" className={`${tool} italic`} aria-pressed={s.italic} onClick={() => c().toggleItalic().run()} title="Italic (⌘I)" disabled={html}>
        I
      </button>
      <button type="button" className={`${tool} underline`} aria-pressed={s.underline} onClick={() => c().toggleUnderline().run()} title="Underline (⌘U)" disabled={html}>
        U
      </button>
      <button type="button" className={tool} aria-pressed={s.link} onClick={setLink} title="Link (⌘K)" disabled={html}>
        Link
      </button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button type="button" className={tool} aria-pressed={s.bullet} onClick={() => c().toggleBulletList().run()} title="Bulleted list" disabled={html}>
        • List
      </button>
      <button type="button" className={tool} aria-pressed={s.ordered} onClick={() => c().toggleOrderedList().run()} title="Numbered list" disabled={html}>
        1. List
      </button>
      <button type="button" className={tool} aria-pressed={s.quote} onClick={() => c().toggleBlockquote().run()} title="Quote" disabled={html}>
        “ ”
      </button>
      <button type="button" className={tool} onClick={() => c().setHorizontalRule().run()} title="Divider" disabled={html}>
        —
      </button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button type="button" className={tool} onClick={onImage} title="Insert image" disabled={html}>
        Image
      </button>
      <button type="button" className={tool} onClick={embedVideo} title="Embed YouTube video" disabled={html}>
        Video
      </button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button type="button" className={tool} onClick={() => c().undo().run()} disabled={html || !s.canUndo} title="Undo (⌘Z)">
        ↶
      </button>
      <button type="button" className={tool} onClick={() => c().redo().run()} disabled={html || !s.canRedo} title="Redo (⇧⌘Z)">
        ↷
      </button>
      <button type="button" className={`${tool} ml-auto`} aria-pressed={html} onClick={onToggleHtml} title="Edit HTML">
        {"</>"} HTML
      </button>
    </div>
  );
}

/** Rich-text editor. Writes its HTML into a hidden input named `name` so it submits with the form. */
export default function RichEditor({ name, initialHtml, placeholder = "Start writing…" }: { name: string; initialHtml: string; placeholder?: string }) {
  const [value, setValue] = useState(initialHtml);
  const [htmlMode, setHtmlMode] = useState(false);
  const [picking, setPicking] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true } }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class:
          "prose-cms min-h-[28rem] max-w-full px-6 py-5 text-body leading-relaxed break-words outline-none [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_iframe]:max-w-full [&_pre]:overflow-x-auto [&_a]:break-all [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-ink [&_blockquote]:pl-4 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lead [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-title [&_img]:my-4 [&_img]:max-h-96 [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-2xl [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
      },
    },
    onUpdate: ({ editor: e }) => setValue(e.getHTML()),
  });

  // Keep the visual editor in sync when returning from HTML mode.
  useEffect(() => {
    if (editor && !htmlMode && editor.getHTML() !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [htmlMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-w-0 max-w-full border border-line bg-white/60">
      <input type="hidden" name={name} value={value} />
      {editor && <Toolbar editor={editor} onImage={() => setPicking(true)} html={htmlMode} onToggleHtml={() => setHtmlMode((h) => !h)} />}
      {htmlMode ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          className={`${inputCls} min-h-[28rem] border-0 bg-transparent font-mono text-2xs leading-relaxed`}
          aria-label="HTML source"
        />
      ) : (
        <EditorContent editor={editor} />
      )}

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setPicking(false)}>
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto bg-paper p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono text-title">Insert image</h2>
              <button type="button" className={btn.ghost} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <MediaLibrary
              picker
              initialKind="image"
              onPick={(m) => {
                editor?.chain().focus().setImage({ src: m.url, alt: m.alt, title: m.caption || undefined }).run();
                setPicking(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
