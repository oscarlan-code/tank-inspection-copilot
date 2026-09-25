import type { ReportSection } from "../domain/types";

export function generateAssistantReply(section: ReportSection, prompt: string): string {
  const query = prompt.toLowerCase();
  const missingCount = section.missingFields.filter((field) => !field.value.trim()).length;

  if (query.includes("shorter") || query.includes("summar")) {
    return `For ${section.title}, I would shorten the draft by keeping the main finding statements and moving supporting detail into bullets or tables. There are currently ${missingCount} missing field${missingCount === 1 ? "" : "s"} still blocking approval.`;
  }

  if (query.includes("approve") || query.includes("ready")) {
    return missingCount === 0
      ? `${section.title} can move toward approval once you confirm the current wording. I do not see any missing-content blockers in this mock section state.`
      : `${section.title} is not approval-ready yet. Please complete the missing-content panel first, then re-run the approval check.`;
  }

  if (query.includes("map") || query.includes("marker") || query.includes("layout")) {
    return section.layoutMap
      ? `This section uses the shell sketch workspace. I can help rewrite the legend or describe the override patch, but marker movement must stay in the lower map editor.`
      : `This section does not have a layout map. The lower workspace can stay collapsed or be reused for supporting tables.`;
  }

  if (query.includes("missing") || query.includes("field")) {
    return missingCount === 0
      ? `The current section does not have any empty required fields in the mock assistant panel.`
      : `The missing-content assistant has ${missingCount} open item${missingCount === 1 ? "" : "s"} for ${section.title}. Start with the highest-signal field shown at the top of the right-hand panel.`;
  }

  return `I am focused on ${section.title}. Based on the current draft, the next best move is to complete the section-specific missing fields and then refine the wording to match the ${section.templateExpectation.toLowerCase()}`;
}
