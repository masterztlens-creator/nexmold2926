import { immutable, invariant } from "../constitution/invariants.js";
import { contentId, decisionId, nonEmpty, type ContentId, type DecisionId } from "./primitives.js";

export interface Content {
  readonly id: ContentId;
  readonly decisionId: DecisionId;
  readonly title: string;
  readonly body: string;
}

export function createContent(input: Omit<Content, "id"> & { id?: string }): Readonly<Content> {
  invariant(input.decisionId.trim().length > 0, "V8_CONTENT_NO_DECISION", "Content must reference an existing Decision.");
  return immutable({
    id: contentId(input.id ?? `content:${input.decisionId}:${input.title}`),
    decisionId: decisionId(input.decisionId),
    title: nonEmpty(input.title, "content.title"),
    body: nonEmpty(input.body, "content.body"),
  });
}
