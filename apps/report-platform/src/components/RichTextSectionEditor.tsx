import { useEffect, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { normalizeSectionContent } from "../lib/reportContent";
import { sha256Text } from "../lib/browserSha256";
import type {
  TargetedEditAction,
  TargetedEditExecution,
  TargetedEditProposal,
  TargetedEditRequest,
  TargetedEditSelection,
} from "../domain/types";

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

const ProvenanceInline = Mark.create({
  name: "provenanceInline",

  addAttributes() {
    return {
      provenance: {
        default: "llm_prediction",
        parseHTML: (element) => element.getAttribute("data-laiq-provenance") ?? "llm_prediction",
        renderHTML: (attributes) => ({
          "data-laiq-provenance": attributes.provenance,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-laiq-provenance]",
      },
      {
        tag: "mark[data-laiq-provenance]",
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const provenance = ["app_field_data", "app_voice_data", "precedent_template", "llm_prediction"].includes(mark.attrs.provenance)
      ? mark.attrs.provenance
      : "llm_prediction";
    const className = provenance === "app_field_data"
      ? "laiq-provenance-inline laiq-provenance-inline-field"
      : provenance === "app_voice_data"
        ? "laiq-provenance-inline laiq-provenance-inline-voice"
      : provenance === "precedent_template"
        ? "laiq-provenance-inline laiq-provenance-inline-template"
        : "laiq-provenance-inline laiq-provenance-inline-ai";

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: className,
        "data-laiq-provenance": provenance,
      }),
      0,
    ];
  },
});

const ProvenanceBlock = Node.create({
  name: "provenanceBlock",

  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      provenance: {
        default: "llm_prediction",
        parseHTML: (element) => element.getAttribute("data-laiq-provenance") ?? "llm_prediction",
        renderHTML: (attributes) => ({
          "data-laiq-provenance": attributes.provenance,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "section[data-laiq-provenance]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const provenance = ["app_field_data", "app_voice_data", "precedent_template", "llm_prediction"].includes(node.attrs.provenance)
      ? node.attrs.provenance
      : "llm_prediction";
    const className = provenance === "app_field_data"
      ? "laiq-provenance-block laiq-provenance-field"
      : provenance === "app_voice_data"
        ? "laiq-provenance-block laiq-provenance-voice"
      : provenance === "precedent_template"
        ? "laiq-provenance-block laiq-provenance-template"
        : "laiq-provenance-block laiq-provenance-ai";

    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: className,
        "data-laiq-provenance": provenance,
      }),
      0,
    ];
  },
});

const ClassedTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

const ClassedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

const ClassedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => (attributes.class ? { class: attributes.class } : {}),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => (attributes.style ? { style: attributes.style } : {}),
      },
    };
  },
});

const targetedEditSelectionPluginKey = new PluginKey<DecorationSet>("targetedEditSelection");

const TargetedEditSelectionHighlight = Extension.create({
  name: "targetedEditSelectionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: targetedEditSelectionPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, currentDecorations) {
            const selectedRange = transaction.getMeta(targetedEditSelectionPluginKey) as
              | { from: number; to: number }
              | null
              | undefined;
            if (selectedRange === null) return DecorationSet.empty;
            if (selectedRange) {
              return DecorationSet.create(transaction.doc, [
                Decoration.inline(selectedRange.from, selectedRange.to, {
                  class: "targeted-edit-selection-highlight",
                  "data-targeted-edit-selection": "true",
                }),
              ]);
            }
            return currentDecorations.map(transaction.mapping, transaction.doc);
          },
        },
        props: {
          decorations(state) {
            return targetedEditSelectionPluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
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
  externalTargetedEdit?: TargetedEditExecution | null;
  onChange: (nextContent: string) => void;
  onAcceptTargetedEdit?: (nextContent: string, proposal: TargetedEditProposal) => Promise<void>;
  onContinueTargetedEditInChat?: (selection: TargetedEditSelection) => void;
  onExternalTargetedEditComplete?: (result: { applied: boolean; executionId: string }) => void;
  onKeepTargetedEdit?: (content: string) => Promise<boolean>;
  onTargetedEditRequested?: (request: {
    action: TargetedEditAction;
    instruction: string;
    selectedText: string;
  }) => void;
  onUndoTargetedEdit?: () => Promise<boolean>;
  onRequestTargetedEdit?: (
    request: Omit<TargetedEditRequest, "expectedVersion">,
  ) => Promise<TargetedEditProposal>;
  targetedChatActive?: boolean;
};

type SelectionDraft = Omit<
  TargetedEditSelection,
  "documentHash" | "documentTextHash" | "selectionHash"
>;
type TargetedEditAnchor = {
  left: number;
  top: number;
  placement: "above" | "below" | "viewport";
};

const targetedEditQuickActions: Array<{ action: TargetedEditAction; label: string }> = [
  { action: "rephrase", label: "Rephrase" },
  { action: "shorten", label: "Shorten" },
  { action: "enhance", label: "Enhance" },
  { action: "to_points", label: "To Points" },
  { action: "to_paragraph", label: "To Text" },
];

function TargetedEditHourglass() {
  return (
    <svg
      aria-hidden="true"
      className="generation-hourglass-icon"
      viewBox="0 0 24 24"
    >
      <path className="generation-hourglass-frame" d="M6 3h12M6 21h12M7 3v3c0 3 2 4.5 5 6-3 1.5-5 3-5 6v3m10-18v3c0 3-2 4.5-5 6 3 1.5 5 3 5 6v3" />
      <path className="generation-hourglass-sand" d="M9 7h6l-3 3-3-3Zm0 11 3-3 3 3H9Z" />
    </svg>
  );
}

export function RichTextSectionEditor({
  content,
  externalTargetedEdit,
  onAcceptTargetedEdit,
  onChange,
  onContinueTargetedEditInChat,
  onExternalTargetedEditComplete,
  onKeepTargetedEdit,
  onRequestTargetedEdit,
  onTargetedEditRequested,
  onUndoTargetedEdit,
  targetedChatActive = false,
}: Props) {
  const selectionRef = useRef<SelectionDraft | null>(null);
  const proposalSelectionRef = useRef<TargetedEditSelection | null>(null);
  const externalTargetedEditRunnerRef = useRef<((execution: TargetedEditExecution) => Promise<void>) | null>(null);
  const processedExternalExecutionIdRef = useRef<string | null>(null);
  const isPointerSelectingRef = useRef(false);
  const pointerSelectionFrameRef = useRef<number | null>(null);
  const keyboardSelectionTimerRef = useRef<number | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [activeTargetedEditAction, setActiveTargetedEditAction] = useState<TargetedEditAction | null>(null);
  const [targetedEditElapsedSeconds, setTargetedEditElapsedSeconds] = useState(0);
  const [isTargetedEditBusy, setIsTargetedEditBusy] = useState(false);
  const [isExternalTargetedEditBusy, setIsExternalTargetedEditBusy] = useState(false);
  const [isTargetedChatHandoff, setIsTargetedChatHandoff] = useState(false);
  const [targetedEditError, setTargetedEditError] = useState("");
  const [targetedEditProposal, setTargetedEditProposal] = useState<TargetedEditProposal | null>(null);
  const [targetedEditSuccess, setTargetedEditSuccess] = useState("");
  const [targetedEditAnchor, setTargetedEditAnchor] = useState<TargetedEditAnchor | null>(null);
  const [hasTargetedEditSelection, setHasTargetedEditSelection] = useState(false);
  const [isPointerSelecting, setIsPointerSelecting] = useState(false);
  const [isTargetedEditKeeping, setIsTargetedEditKeeping] = useState(false);
  const [isTargetedEditUndoing, setIsTargetedEditUndoing] = useState(false);

  const commitTargetedEditSelection = (
    nextEditor: NonNullable<ReturnType<typeof useEditor>>,
  ) => {
    const selection = readTargetedEditSelection(nextEditor);
    if (!selection) {
      selectionRef.current = null;
      proposalSelectionRef.current = null;
      setTargetedEditSelectionHighlight(nextEditor, null);
      setHasTargetedEditSelection(false);
      return;
    }
    selectionRef.current = selection;
    proposalSelectionRef.current = null;
    setTargetedEditSelectionHighlight(nextEditor, selection);
    setHasTargetedEditSelection(true);
    setTargetedEditProposal(null);
    setTargetedEditError("");
    setTargetedEditSuccess("");
  };

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
      TargetedEditSelectionHighlight,
      ProvenanceBlock,
      ProvenanceInline,
      Underline,
      ClassedTable.configure({
        resizable: true,
      }),
      TableRow,
      ClassedTableHeader,
      ClassedTableCell,
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
    onSelectionUpdate({ editor: nextEditor }) {
      if (isPointerSelectingRef.current) return;
      if (keyboardSelectionTimerRef.current != null) {
        window.clearTimeout(keyboardSelectionTimerRef.current);
      }
      keyboardSelectionTimerRef.current = window.setTimeout(() => {
        keyboardSelectionTimerRef.current = null;
        if (!isPointerSelectingRef.current) {
          commitTargetedEditSelection(nextEditor);
        }
      }, 140);
    },
  });
  const targetedEditingEnabled = Boolean(onRequestTargetedEdit && onAcceptTargetedEdit);
  const targetedEditFocusMode = targetedEditingEnabled && !isPointerSelecting && !isTargetedChatHandoff && Boolean(
    hasTargetedEditSelection || isTargetedEditBusy || targetedEditProposal || targetedEditSuccess,
  );

  useEffect(() => {
    if (!editor) return;
    const editorSurface = editor.view.dom;

    const clearPendingSelectionCommit = () => {
      if (keyboardSelectionTimerRef.current != null) {
        window.clearTimeout(keyboardSelectionTimerRef.current);
        keyboardSelectionTimerRef.current = null;
      }
      if (pointerSelectionFrameRef.current != null) {
        window.cancelAnimationFrame(pointerSelectionFrameRef.current);
        pointerSelectionFrameRef.current = null;
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isTargetedEditBusy || isExternalTargetedEditBusy || targetedEditSuccess) {
        return;
      }
      clearPendingSelectionCommit();
      isPointerSelectingRef.current = true;
      setIsPointerSelecting(true);
      selectionRef.current = null;
      proposalSelectionRef.current = null;
      setTargetedEditSelectionHighlight(editor, null);
      setHasTargetedEditSelection(false);
      setTargetedEditProposal(null);
      setTargetedEditError("");
    };
    const finishPointerSelection = () => {
      if (!isPointerSelectingRef.current || pointerSelectionFrameRef.current != null) return;
      pointerSelectionFrameRef.current = window.requestAnimationFrame(() => {
        pointerSelectionFrameRef.current = null;
        isPointerSelectingRef.current = false;
        setIsPointerSelecting(false);
        commitTargetedEditSelection(editor);
      });
    };

    editorSurface.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", finishPointerSelection, true);
    document.addEventListener("pointercancel", finishPointerSelection, true);
    return () => {
      clearPendingSelectionCommit();
      isPointerSelectingRef.current = false;
      setIsPointerSelecting(false);
      editorSurface.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", finishPointerSelection, true);
      document.removeEventListener("pointercancel", finishPointerSelection, true);
    };
  }, [editor, isExternalTargetedEditBusy, isTargetedEditBusy, targetedEditSuccess]);

  useEffect(() => {
    if (!externalTargetedEdit) return;
    if (processedExternalExecutionIdRef.current === externalTargetedEdit.executionId) return;
    const runner = externalTargetedEditRunnerRef.current;
    if (!runner) return;
    processedExternalExecutionIdRef.current = externalTargetedEdit.executionId;
    void runner(externalTargetedEdit);
  }, [externalTargetedEdit]);

  useEffect(() => {
    if (!editor || targetedChatActive || !isTargetedChatHandoff) return;
    const collapseAt = editor.state.selection.to;
    editor.commands.setTextSelection(collapseAt);
    selectionRef.current = null;
    proposalSelectionRef.current = null;
    setTargetedEditSelectionHighlight(editor, null);
    setHasTargetedEditSelection(false);
    setIsTargetedChatHandoff(false);
  }, [editor, isTargetedChatHandoff, targetedChatActive]);

  useEffect(() => {
    if (!editor) return;

    const normalized = normalizeSectionContent(content);
    if (editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, false);
      selectionRef.current = null;
      proposalSelectionRef.current = null;
      setTargetedEditSelectionHighlight(editor, null);
      setHasTargetedEditSelection(false);
      setTargetedEditAnchor(null);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const editorSurface = editor.view.dom;
    editorSurface.classList.toggle("targeted-edit-in-progress", isTargetedEditBusy);
    editorSurface.classList.toggle("targeted-edit-applied", Boolean(targetedEditSuccess));
    editorSurface.setAttribute("aria-busy", String(isTargetedEditBusy));

    return () => {
      editorSurface.classList.remove("targeted-edit-in-progress");
      editorSurface.classList.remove("targeted-edit-applied");
      editorSurface.removeAttribute("aria-busy");
    };
  }, [editor, isTargetedEditBusy, targetedEditSuccess]);

  useEffect(() => {
    if (!isTargetedEditBusy) {
      setTargetedEditElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setTargetedEditElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTargetedEditBusy]);

  useEffect(() => {
    if (!editor || !targetedEditFocusMode) return;

    const activeCardSelector = targetedEditSuccess
      ? ".targeted-edit-confirmation-card"
      : isExternalTargetedEditBusy
        ? ".targeted-edit-external-working-card"
        : ".targeted-edit-menu";
    const focusActiveCard = () => {
      const activeCard = document.querySelector<HTMLElement>(activeCardSelector);
      const target = targetedEditSuccess
        ? activeCard?.querySelector<HTMLElement>("button:not(:disabled)")
        : activeCard?.querySelector<HTMLElement>("textarea, button:not(:disabled)");
      target?.focus({ preventScroll: true });
    };
    const focusFrame = window.requestAnimationFrame(focusActiveCard);

    const isInsideActiveCard = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(activeCardSelector));
    const blockBackgroundInteraction = (event: Event) => {
      if (!isInsideActiveCard(event.target)) event.preventDefault();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeCard = document.querySelector<HTMLElement>(activeCardSelector);
      if (!activeCard) {
        event.preventDefault();
        return;
      }

      if (event.key !== "Tab") {
        if (!(event.target instanceof globalThis.Node) || !activeCard.contains(event.target)) {
          event.preventDefault();
        }
        return;
      }

      const focusable = Array.from(activeCard.querySelectorAll<HTMLElement>(
        "button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex]?.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("wheel", blockBackgroundInteraction, { capture: true, passive: false });
    document.addEventListener("touchmove", blockBackgroundInteraction, { capture: true, passive: false });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("wheel", blockBackgroundInteraction, true);
      document.removeEventListener("touchmove", blockBackgroundInteraction, true);
    };
  }, [editor, isExternalTargetedEditBusy, targetedEditFocusMode, targetedEditSuccess]);

  if (!editor) {
    return <div className="rich-text-loading">Loading report editor…</div>;
  }

  const activeFontFamily = editor.getAttributes("textStyle").fontFamily as string | undefined;
  const activeFontSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const activeColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "#163250";

  const cancelTargetedEditing = () => {
    const collapseAt = editor.state.selection.to;
    editor.commands.setTextSelection(collapseAt);
    selectionRef.current = null;
    proposalSelectionRef.current = null;
    setTargetedEditSelectionHighlight(editor, null);
    setHasTargetedEditSelection(false);
    setTargetedEditProposal(null);
    setTargetedEditError("");
    setCustomInstruction("");
    setTargetedEditAnchor(null);
    setIsTargetedChatHandoff(false);
  };

  const continueTargetedEditInChat = async () => {
    if (!onContinueTargetedEditInChat) return;
    const baseSelection = selectionRef.current ?? readTargetedEditSelection(editor);
    if (!baseSelection) {
      setTargetedEditError("Highlight report text before continuing in the AI panel.");
      return;
    }

    setTargetedEditError("");
    setIsTargetedEditBusy(true);
    try {
      const selection = await finalizeTargetedEditSelection(baseSelection);
      proposalSelectionRef.current = selection;
      onContinueTargetedEditInChat(selection);
      setIsTargetedChatHandoff(true);
      setTargetedEditProposal(null);
      setCustomInstruction("");
    } catch (error) {
      setTargetedEditError(
        error instanceof Error ? error.message : "The selected text could not be transferred to the AI panel.",
      );
    } finally {
      setIsTargetedEditBusy(false);
    }
  };

  const applyTargetedEdit = async (
    proposal: TargetedEditProposal,
    selection: TargetedEditSelection,
  ) => {
    if (!onAcceptTargetedEdit) return false;
    if (
      proposal.documentHash !== selection.documentHash ||
      proposal.selectionHash !== selection.selectionHash ||
      editor.getHTML() !== selection.documentHtml
    ) {
      setTargetedEditProposal(null);
      setTargetedEditError("The section changed after this edit was prepared. Highlight the text again.");
      return false;
    }

    const previousContent = selection.documentHtml;
    const originalAnchor = readTargetedEditAnchor(editor, selection.from, selection.to);
    const replacementHtml = preserveInlineReplacementBoundaries(
      editor,
      selection,
      proposal.replacementHtml,
    );
    const applied = editor
      .chain()
      .focus()
      .insertContentAt(
        { from: selection.from, to: selection.to },
        replacementHtml,
        {
          updateSelection: true,
          parseOptions: { preserveWhitespace: "full" },
        },
      )
      .run();
    if (!applied) {
      setTargetedEditError("The edit could not be inserted into this report block.");
      return false;
    }

    const nextContent = editor.getHTML();
    const replacementTo = Math.max(selection.from, editor.state.selection.from);
    try {
      await onAcceptTargetedEdit(nextContent, proposal);
      setTargetedEditProposal(null);
      setCustomInstruction("");
      setTargetedEditError("");
      selectionRef.current = null;
      proposalSelectionRef.current = null;
      setTargetedEditSelectionHighlight(editor, { from: selection.from, to: replacementTo });
      setTargetedEditAnchor(originalAnchor ?? readTargetedEditAnchor(editor, selection.from, replacementTo));
      setTargetedEditSuccess("Applied to highlighted text. Undo / Restore is available below.");
      window.requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const renderedAnchor = readRenderedTargetedEditAnchor(editor);
        if (renderedAnchor) setTargetedEditAnchor(renderedAnchor);
      });
      return true;
    } catch (error) {
      editor.commands.setContent(previousContent, false);
      onChange(previousContent);
      setTargetedEditError(
        error instanceof Error ? error.message : "The targeted edit could not be saved.",
      );
      return false;
    }
  };

  const requestTargetedEdit = async (
    action: TargetedEditAction,
    instruction = "",
  ) => {
    if (!onRequestTargetedEdit) return;
    const baseSelection = selectionRef.current ?? readTargetedEditSelection(editor);
    if (!baseSelection) {
      setTargetedEditError("Highlight report text before asking LAIQ AI to edit it.");
      return;
    }

    onTargetedEditRequested?.({
      action,
      instruction: instruction.trim(),
      selectedText: baseSelection.selectedText,
    });

    setTargetedEditError("");
    setTargetedEditProposal(null);
    setTargetedEditSuccess("");
    setActiveTargetedEditAction(action);
    setIsTargetedEditBusy(true);

    try {
      const actionSelection = normalizeSelectionForAction(editor, baseSelection, action);
      const selection = await finalizeTargetedEditSelection(actionSelection);
      proposalSelectionRef.current = selection;
      const proposal = await onRequestTargetedEdit({
        action,
        instruction: instruction.trim(),
        selection,
      });
      if (proposal.warnings.length > 0) {
        setTargetedEditProposal(proposal);
      } else {
        await applyTargetedEdit(proposal, selection);
      }
    } catch (error) {
      setTargetedEditError(
        error instanceof Error ? error.message : "LAIQ AI could not prepare this targeted edit.",
      );
    } finally {
      setIsTargetedEditBusy(false);
      setActiveTargetedEditAction(null);
    }
  };

  const acceptTargetedEdit = async () => {
    if (!targetedEditProposal || !onAcceptTargetedEdit) return;
    const selection = proposalSelectionRef.current;
    if (!selection) return;
    setIsTargetedEditBusy(true);
    await applyTargetedEdit(targetedEditProposal, selection);
    setIsTargetedEditBusy(false);
  };

  const undoTargetedEdit = async () => {
    if (!onUndoTargetedEdit) {
      setTargetedEditError("This edit cannot be restored from the current report session.");
      return;
    }

    setIsTargetedEditUndoing(true);
    setTargetedEditError("");
    try {
      const restored = await onUndoTargetedEdit();
      if (!restored) {
        setTargetedEditError("The previous report version could not be restored.");
        return;
      }
      setTargetedEditSuccess("");
      setCustomInstruction("");
      setTargetedEditSelectionHighlight(editor, null);
      setTargetedEditAnchor(null);
      setHasTargetedEditSelection(false);
    } catch (error) {
      setTargetedEditError(
        error instanceof Error ? error.message : "The previous report version could not be restored.",
      );
    } finally {
      setIsTargetedEditUndoing(false);
    }
  };

  const keepTargetedEdit = async () => {
    if (!onKeepTargetedEdit) {
      setTargetedEditSuccess("");
      setTargetedEditSelectionHighlight(editor, null);
      setTargetedEditAnchor(null);
      setHasTargetedEditSelection(false);
      return;
    }

    setIsTargetedEditKeeping(true);
    setTargetedEditError("");
    try {
      const kept = await onKeepTargetedEdit(editor?.getHTML() ?? content);
      if (!kept) {
        setTargetedEditError("The edit was kept, but detected report details could not be saved.");
        return;
      }
      setTargetedEditSuccess("");
      setCustomInstruction("");
      setTargetedEditSelectionHighlight(editor, null);
      setTargetedEditAnchor(null);
      setHasTargetedEditSelection(false);
    } catch (error) {
      setTargetedEditError(
        error instanceof Error ? error.message : "Detected report details could not be saved.",
      );
    } finally {
      setIsTargetedEditKeeping(false);
    }
  };

  externalTargetedEditRunnerRef.current = async (execution) => {
    setIsTargetedChatHandoff(false);
    setTargetedEditProposal(null);
    setTargetedEditError("");
    setTargetedEditSuccess("");
    setTargetedEditAnchor(
      readRenderedTargetedEditAnchor(editor)
        ?? readTargetedEditAnchor(editor, execution.selection.from, execution.selection.to),
    );
    selectionRef.current = execution.selection;
    proposalSelectionRef.current = execution.selection;
    setTargetedEditSelectionHighlight(editor, execution.selection);
    setHasTargetedEditSelection(true);
    setActiveTargetedEditAction(execution.proposal.action);
    setIsExternalTargetedEditBusy(true);
    setIsTargetedEditBusy(true);

    let applied = false;
    try {
      applied = await applyTargetedEdit(execution.proposal, execution.selection);
    } finally {
      setIsTargetedEditBusy(false);
      setIsExternalTargetedEditBusy(false);
      setActiveTargetedEditAction(null);
      onExternalTargetedEditComplete?.({
        applied,
        executionId: execution.executionId,
      });
    }
  };

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
          className={editor.isActive("table") ? "toolbar-chip toolbar-chip-active" : "toolbar-chip"}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()
          }
          type="button"
        >
          Table
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

      {targetedEditingEnabled ? (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: currentEditor, state }) =>
            currentEditor.isEditable &&
            !isExternalTargetedEditBusy &&
            !isTargetedChatHandoff &&
            !targetedEditSuccess &&
            !state.selection.empty &&
            !selectionTouchesTable(state.selection.$from, state.selection.$to)
          }
          tippyOptions={{
            duration: 120,
            hideOnClick: false,
            interactive: true,
            maxWidth: 440,
            placement: "top-end",
            zIndex: 1830,
          }}
        >
          <div
            aria-hidden={isPointerSelecting || isTargetedChatHandoff || isExternalTargetedEditBusy}
            aria-label="Edit selected report content"
            aria-modal="true"
            className={`targeted-edit-menu${isPointerSelecting ? " targeted-edit-menu-pointer-selecting" : ""}${isTargetedChatHandoff || isExternalTargetedEditBusy ? " targeted-edit-menu-hidden" : ""}`}
            role="dialog"
          >
            <div className="targeted-edit-menu-header">
              <div>
                <strong>Edit selected content</strong>
                <span>Only the highlighted text will change</span>
              </div>
              <button
                aria-label="Cancel targeted editing"
                className="targeted-edit-cancel-button"
                disabled={isTargetedEditBusy}
                onClick={cancelTargetedEditing}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                Cancel
              </button>
            </div>
            <div className="targeted-edit-quick-actions">
              {targetedEditQuickActions.map((item) => (
                <button
                  className={isTargetedEditBusy && activeTargetedEditAction === item.action
                    ? "targeted-edit-action-active"
                    : undefined}
                  disabled={isTargetedEditBusy}
                  key={item.action}
                  onClick={() => void requestTargetedEdit(item.action)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {isTargetedEditBusy && activeTargetedEditAction === item.action
                    ? `${item.label}… ${targetedEditElapsedSeconds}s`
                    : item.label}
                </button>
              ))}
            </div>

            {isTargetedEditBusy ? (
              <div className="targeted-edit-working" role="status">
                <TargetedEditHourglass />
                <div>
                  <strong>{targetedEditActionStatus(activeTargetedEditAction)} · {targetedEditElapsedSeconds}s</strong>
                  <span>The selected text is being processed. Other workspace controls are paused.</span>
                </div>
              </div>
            ) : null}

            <div className="targeted-edit-command">
              <textarea
                aria-label="Targeted LAIQ AI instruction"
                onChange={(event) => setCustomInstruction(event.target.value)}
                placeholder="Ask LAIQ AI to change only this selection..."
                rows={2}
                value={customInstruction}
              />
              <button
                className={isTargetedEditBusy && activeTargetedEditAction === "custom"
                  ? "targeted-edit-action-active"
                  : undefined}
                disabled={isTargetedEditBusy || customInstruction.trim().length === 0}
                onClick={() => void requestTargetedEdit("custom", customInstruction)}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {isTargetedEditBusy && activeTargetedEditAction === "custom"
                  ? `Working… ${targetedEditElapsedSeconds}s`
                  : "Ask"}
              </button>
            </div>

            {onContinueTargetedEditInChat ? (
              <button
                className="targeted-edit-continue-button"
                disabled={isTargetedEditBusy}
                onClick={() => void continueTargetedEditInChat()}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                Continue in AI Panel
              </button>
            ) : null}

            {targetedEditProposal ? (
              <div className="targeted-edit-proposal">
                <div className="targeted-edit-proposal-heading">
                  <strong>Proposed replacement</strong>
                  <span>Only the highlighted content will change</span>
                </div>
                <div
                  className="targeted-edit-proposal-content"
                  dangerouslySetInnerHTML={{ __html: targetedEditProposal.replacementHtml }}
                />
                <p>{targetedEditProposal.explanation}</p>
                {targetedEditProposal.warnings.length > 0 ? (
                  <p className="targeted-edit-warning">{targetedEditProposal.warnings.join(" ")}</p>
                ) : null}
                <div className="targeted-edit-proposal-actions">
                  <button
                    className="targeted-edit-accept"
                    disabled={isTargetedEditBusy}
                    onClick={() => void acceptTargetedEdit()}
                    type="button"
                  >
                    Apply anyway
                  </button>
                  <button
                    disabled={isTargetedEditBusy}
                    onClick={() =>
                      void requestTargetedEdit(
                        targetedEditProposal.action,
                        targetedEditProposal.instruction,
                      )
                    }
                    type="button"
                  >
                    Try Again
                  </button>
                  <button
                    disabled={isTargetedEditBusy}
                    onClick={() => {
                      setTargetedEditProposal(null);
                      setTargetedEditError("");
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
            {targetedEditError ? (
              <p className="targeted-edit-error" role="alert">{targetedEditError}</p>
            ) : null}
          </div>
        </BubbleMenu>
      ) : null}

      <EditorContent editor={editor} />
      <div
        aria-hidden="true"
        className={`targeted-edit-focus-backdrop${targetedEditFocusMode ? " targeted-edit-focus-backdrop-active" : ""}`}
        onClick={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
      />
      {isExternalTargetedEditBusy ? (
        <div
          aria-label="Applying selected-content edit"
          aria-modal="true"
          className={`targeted-edit-external-working-card targeted-edit-confirmation-${targetedEditAnchor?.placement ?? "viewport"}`}
          role="dialog"
          style={targetedEditAnchor
            ? { left: targetedEditAnchor.left, top: targetedEditAnchor.top }
            : undefined}
        >
          <TargetedEditHourglass />
          <div>
            <strong>Applying selection edit · {targetedEditElapsedSeconds}s</strong>
            <span>The rest of the report remains protected.</span>
          </div>
        </div>
      ) : null}
      {targetedEditSuccess ? (
        <div
          aria-label="Confirm targeted edit"
          aria-modal="true"
          className={`targeted-edit-confirmation-card targeted-edit-confirmation-${targetedEditAnchor?.placement ?? "viewport"}`}
          role="dialog"
          style={targetedEditAnchor
            ? { left: targetedEditAnchor.left, top: targetedEditAnchor.top }
            : undefined}
        >
          <div>
            <strong>Keep this edit?</strong>
            <span>Only the highlighted content was changed.</span>
            {targetedEditError ? <span className="targeted-edit-error">{targetedEditError}</span> : null}
          </div>
          <div className="targeted-edit-confirmation-actions">
            <button
              className="targeted-edit-keep-button"
              disabled={isTargetedEditKeeping || isTargetedEditUndoing}
              onClick={() => void keepTargetedEdit()}
              type="button"
            >
              {isTargetedEditKeeping ? "Saving\u2026" : "Keep"}
            </button>
            <button
              className="targeted-edit-undo-button"
              disabled={isTargetedEditKeeping || isTargetedEditUndoing}
              onClick={() => void undoTargetedEdit()}
              type="button"
            >
              {isTargetedEditUndoing ? "Undoing…" : "Undo"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function targetedEditActionStatus(action: TargetedEditAction | null) {
  const labels: Record<TargetedEditAction, string> = {
    custom: "Applying your instruction",
    enhance: "Enhancing selection",
    rephrase: "Rephrasing selection",
    shorten: "Shortening selection",
    to_paragraph: "Converting selection to text",
    to_points: "Converting selection to points",
  };
  return action ? labels[action] : "Editing selection";
}

function readTargetedEditAnchor(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  from: number,
  to: number,
): TargetedEditAnchor | null {
  const documentSize = editor.state.doc.content.size;
  const safeFrom = Math.max(1, Math.min(from, documentSize));
  const safeTo = Math.max(safeFrom, Math.min(to, documentSize));
  if (safeFrom >= safeTo) return null;

  try {
    const start = editor.view.coordsAtPos(safeFrom);
    const end = editor.view.coordsAtPos(safeTo);
    return createTargetedEditAnchor({
      bottom: Math.max(start.bottom, end.bottom),
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
      top: Math.min(start.top, end.top),
    });
  } catch {
    return null;
  }
}

function readRenderedTargetedEditAnchor(
  editor: NonNullable<ReturnType<typeof useEditor>>,
): TargetedEditAnchor | null {
  const highlightedNodes = Array.from(
    editor.view.dom.querySelectorAll<HTMLElement>("[data-targeted-edit-selection='true']"),
  );
  if (highlightedNodes.length === 0) return null;

  const rectangles = highlightedNodes
    .flatMap((node) => Array.from(node.getClientRects()))
    .filter((rectangle) => rectangle.width > 0 && rectangle.height > 0);
  if (rectangles.length === 0) return null;

  return createTargetedEditAnchor({
    bottom: Math.max(...rectangles.map((rectangle) => rectangle.bottom)),
    left: Math.min(...rectangles.map((rectangle) => rectangle.left)),
    right: Math.max(...rectangles.map((rectangle) => rectangle.right)),
    top: Math.min(...rectangles.map((rectangle) => rectangle.top)),
  });
}

function createTargetedEditAnchor(bounds: {
  bottom: number;
  left: number;
  right: number;
  top: number;
}): TargetedEditAnchor {
  const selectionCenter = (bounds.left + bounds.right) / 2;
  const cardWidth = Math.min(500, window.innerWidth - 32);
  const halfCardWidth = cardWidth / 2;
  const left = Math.min(
    window.innerWidth - halfCardWidth - 16,
    Math.max(halfCardWidth + 16, selectionCenter),
  );

  if (bounds.top >= 150) {
    return { left, top: bounds.top - 12, placement: "above" };
  }
  if (window.innerHeight - bounds.bottom >= 150) {
    return { left, top: bounds.bottom + 12, placement: "below" };
  }
  return { left, top: 16, placement: "viewport" };
}

function setTargetedEditSelectionHighlight(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  selection: Pick<SelectionDraft, "from" | "to"> | null,
) {
  editor.view.dispatch(
    editor.state.tr.setMeta(
      targetedEditSelectionPluginKey,
      selection ? { from: selection.from, to: selection.to } : null,
    ),
  );
}

function readTargetedEditSelection(editor: NonNullable<ReturnType<typeof useEditor>>): SelectionDraft | null {
  const { from: originalFrom, to: originalTo, empty, $from, $to } = editor.state.selection;
  if (empty || originalFrom === originalTo || selectionTouchesTable($from, $to)) {
    return null;
  }

  const sameTextBlock = $from.sameParent($to) && $from.parent.isTextblock;
  const blockRange = sameTextBlock ? null : $from.blockRange($to);
  let from = blockRange?.start ?? originalFrom;
  let to = blockRange?.end ?? originalTo;
  if (sameTextBlock) {
    const exactSelection = editor.state.doc.textBetween(from, to, "", "");
    const leadingWhitespace = exactSelection.match(/^\s+/)?.[0].length ?? 0;
    const trailingWhitespace = exactSelection.match(/\s+$/)?.[0].length ?? 0;
    from += leadingWhitespace;
    to -= trailingWhitespace;
  }
  if (from >= to) return null;

  const selectionKind = sameTextBlock ? "inline" : "block";
  const selectedText = editor.state.doc.textBetween(from, to, "\n", "\n").trim();
  if (!selectedText) return null;

  const selectedHtml = serializeDocumentRange(editor, from, to, selectionKind).trim();
  const documentHtml = editor.getHTML();
  const contextBefore = editor.state.doc.textBetween(Math.max(0, from - 500), from, " ", " ").trim();
  const contextAfter = editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size, to + 500), " ", " ").trim();

  return {
    from,
    to,
    selectedText,
    selectedHtml,
    documentHtml,
    selectionKind,
    contextBefore,
    contextAfter,
  };
}

function serializeDocumentRange(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  from: number,
  to: number,
  selectionKind: TargetedEditSelection["selectionKind"],
) {
  const wrapper = document.createElement("div");
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(
    editor.state.doc.slice(from, to).content,
  );
  wrapper.appendChild(fragment);
  const html = wrapper.innerHTML;

  if (selectionKind === "inline") {
    const paragraphMatch = html.match(/^<p>([\s\S]*)<\/p>$/i);
    return paragraphMatch?.[1] ?? html;
  }

  return html;
}

function preserveInlineReplacementBoundaries(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  selection: TargetedEditSelection,
  replacementHtml: string,
) {
  if (selection.selectionKind !== "inline") return replacementHtml;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = replacementHtml;
  const replacementText = (wrapper.textContent ?? "").trim();
  if (!replacementText) return replacementHtml;

  const documentSize = editor.state.doc.content.size;
  const previousCharacter = editor.state.doc.textBetween(
    Math.max(0, selection.from - 1),
    selection.from,
    "",
    "",
  );
  const nextCharacter = editor.state.doc.textBetween(
    selection.to,
    Math.min(documentSize, selection.to + 1),
    "",
    "",
  );
  const firstReplacementCharacter = replacementText[0] ?? "";
  const lastReplacementCharacter = replacementText.at(-1) ?? "";
  const needsLeadingSpace =
    Boolean(previousCharacter) &&
    !/\s/u.test(previousCharacter) &&
    /[\p{L}\p{N}]/u.test(previousCharacter) &&
    /[\p{L}\p{N}]/u.test(firstReplacementCharacter);
  const needsTrailingSpace =
    Boolean(nextCharacter) &&
    !/\s/u.test(nextCharacter) &&
    /[\p{L}\p{N}]/u.test(nextCharacter) &&
    /[\p{L}\p{N},.!?;:)\]]/u.test(lastReplacementCharacter);

  return `${needsLeadingSpace ? " " : ""}${replacementHtml}${needsTrailingSpace ? " " : ""}`;
}

function normalizeSelectionForAction(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  selection: SelectionDraft,
  action: TargetedEditAction,
): SelectionDraft {
  if (action !== "to_points" && action !== "to_paragraph") {
    return selection;
  }

  const $from = editor.state.doc.resolve(selection.from);
  const $to = editor.state.doc.resolve(selection.to);
  const listRange = findContainingListRange($from, selection.to);
  const blockRange = $from.blockRange($to);
  const from = listRange?.from ?? blockRange?.start;
  const to = listRange?.to ?? blockRange?.end;
  if (from == null || to == null) return selection;

  return {
    ...selection,
    from,
    to,
    selectedText: editor.state.doc.textBetween(from, to, "\n", "\n").trim(),
    selectedHtml: serializeDocumentRange(editor, from, to, "block").trim(),
    selectionKind: "block",
    contextBefore: editor.state.doc.textBetween(Math.max(0, from - 500), from, " ", " ").trim(),
    contextAfter: editor.state.doc.textBetween(
      to,
      Math.min(editor.state.doc.content.size, to + 500),
      " ",
      " ",
    ).trim(),
  };
}

function findContainingListRange(
  $from: {
    depth: number;
    before: (depth: number) => number;
    after: (depth: number) => number;
    node: (depth: number) => { type: { name: string } };
  },
  selectionTo: number,
) {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeName = $from.node(depth).type.name;
    if (nodeName !== "bulletList" && nodeName !== "orderedList") continue;
    const from = $from.before(depth);
    const to = $from.after(depth);
    if (selectionTo <= to) {
      return { from, to };
    }
  }
  return null;
}

function selectionTouchesTable(
  $from: { depth: number; node: (depth: number) => { type: { name: string } } },
  $to: { depth: number; node: (depth: number) => { type: { name: string } } },
) {
  const tableNodeNames = new Set(["table", "tableRow", "tableCell", "tableHeader"]);
  for (let depth = 0; depth <= $from.depth; depth += 1) {
    if (tableNodeNames.has($from.node(depth).type.name)) return true;
  }
  for (let depth = 0; depth <= $to.depth; depth += 1) {
    if (tableNodeNames.has($to.node(depth).type.name)) return true;
  }
  return false;
}

async function finalizeTargetedEditSelection(
  selection: SelectionDraft,
): Promise<TargetedEditSelection> {
  const normalizedSelection = {
    ...selection,
    selectedText: selection.selectedText.trim(),
    selectedHtml: selection.selectedHtml.trim(),
  };
  const [documentHash, documentTextHash, selectionHash] = await Promise.all([
    sha256Text(normalizedSelection.documentHtml),
    sha256Text(normalizeTargetedDocumentText(normalizedSelection.documentHtml)),
    sha256Text([
      normalizedSelection.from,
      normalizedSelection.to,
      normalizedSelection.selectedText,
      normalizedSelection.selectedHtml,
    ].join("\n")),
  ]);

  return {
    ...normalizedSelection,
    documentHash,
    documentTextHash,
    selectionHash,
  };
}

function normalizeTargetedDocumentText(value: string) {
  const decoder = document.createElement("textarea");
  decoder.innerHTML = value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decoder.value.replace(/\s+/g, " ").trim().toLowerCase();
}
