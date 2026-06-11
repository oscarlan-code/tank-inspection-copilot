import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import { normalizeSectionContent } from "../lib/reportContent";

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const fontFamilies = [
  { label: "Aptos", value: "Aptos, 'Segoe UI', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Consolas", value: "Consolas, monospace" },
];

const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px"];
const palette = ["#163250", "#0d4f90", "#ef4c57", "#4f5d75", "#1f6f54", "#b06500"];

type Props = {
  content: string;
  onChange: (nextContent: string) => void;
};

export function RichTextSectionEditor({ content, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: normalizeSectionContent(content),
    editorProps: {
      attributes: {
        class: "rich-text-surface",
      },
    },
    onUpdate({ editor: nextEditor }) {
      onChange(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const normalized = normalizeSectionContent(content);
    if (editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="rich-text-loading">Loading report editor…</div>;
  }

  const activeFontFamily = editor.getAttributes("textStyle").fontFamily as string | undefined;
  const activeFontSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const activeColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "#163250";

  return (
    <div className="rich-text-editor-card">
      <div className="rich-text-toolbar">
        <button
          className={editor.isActive("heading", { level: 3 }) ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          type="button"
        >
          H3
        </button>
        <button
          className={editor.isActive("paragraph") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().setParagraph().run()}
          type="button"
        >
          Paragraph
        </button>
        <button
          className={editor.isActive("bold") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          type="button"
        >
          Bold
        </button>
        <button
          className={editor.isActive("italic") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          type="button"
        >
          Italic
        </button>
        <button
          className={editor.isActive("underline") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          type="button"
        >
          Underline
        </button>
        <button
          className={editor.isActive("bulletList") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          type="button"
        >
          Bullet
        </button>
        <button
          className={
            editor.isActive({ textAlign: "left" }) ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"
          }
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          type="button"
        >
          Left
        </button>
        <button
          className={
            editor.isActive({ textAlign: "center" }) ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"
          }
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          type="button"
        >
          Center
        </button>

        <label className="toolbar-select">
          <span>Font</span>
          <select
            onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
            value={activeFontFamily ?? ""}
          >
            <option value="">Default</option>
            {fontFamilies.map((fontFamily) => (
              <option key={fontFamily.label} value={fontFamily.value}>
                {fontFamily.label}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-select">
          <span>Size</span>
          <select
            onChange={(event) => editor.chain().focus().setMark("textStyle", { fontSize: event.target.value }).run()}
            value={activeFontSize ?? ""}
          >
            <option value="">Default</option>
            {fontSizes.map((fontSize) => (
              <option key={fontSize} value={fontSize}>
                {fontSize}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-color">
          <span>Color</span>
          <input
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            type="color"
            value={activeColor}
          />
        </label>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
