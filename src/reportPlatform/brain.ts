import type { ChecklistItem, ReportPlanEntry, ReportSection, ReportWorkspace, SectionAiAction } from "./workspace";
import type { SectionReferenceBundle } from "./referenceBundles";

export type SectionRefinementFeedback = {
  userComment: string;
  confirmedUnderstanding?: string;
};

export type SectionTrainingFeedback = {
  sectionId: string;
  sectionTitle: string;
  rating: "up" | "down";
  draft: string;
  userComment?: string;
  confirmedUnderstanding?: string;
};

export type SectionLogicFeedback = {
  sectionId: string;
  sectionTitle: string;
  draft?: string;
  userComment: string;
  confirmedRule: string;
};

export type BrainActionRequest = {
  workspace: ReportWorkspace;
  section: ReportSection;
  sectionPlan: ReportPlanEntry[];
  checklist: ChecklistItem[];
  action: SectionAiAction;
  referenceBundle: SectionReferenceBundle;
  userPrompt?: string;
  refinementFeedback?: SectionRefinementFeedback;
};

export type BrainActionResponse = {
  ok: boolean;
  provider: "codex-cli" | "mock";
  draft: string;
  assistantMessage: string;
  warnings: string[];
  evidenceNotes: string[];
};

export type BrainFeedbackResponse = {
  ok: boolean;
  stored: boolean;
};

export interface BrainAdapter {
  runSectionAction(request: BrainActionRequest): Promise<BrainActionResponse>;
  storeSectionFeedback(feedback: SectionTrainingFeedback): Promise<BrainFeedbackResponse>;
  storeSectionLogicFeedback(feedback: SectionLogicFeedback): Promise<BrainFeedbackResponse>;
}

export class HttpBrainAdapter implements BrainAdapter {
  async runSectionAction(request: BrainActionRequest): Promise<BrainActionResponse> {
    const response = await fetch("/api/report-brain/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Brain request failed with status ${response.status}`);
    }

    return (await response.json()) as BrainActionResponse;
  }

  async storeSectionFeedback(feedback: SectionTrainingFeedback): Promise<BrainFeedbackResponse> {
    const response = await fetch("/api/report-brain/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Feedback request failed with status ${response.status}`);
    }

    return (await response.json()) as BrainFeedbackResponse;
  }

  async storeSectionLogicFeedback(feedback: SectionLogicFeedback): Promise<BrainFeedbackResponse> {
    const response = await fetch("/api/report-brain/logic-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Logic feedback request failed with status ${response.status}`);
    }

    return (await response.json()) as BrainFeedbackResponse;
  }
}
