import type { SupportIssue } from "@/domain/entities";
import type { ISupportIssueRepository } from "../interfaces";
import { mockStore } from "./store";

const screenshots = new Map<string, Buffer>();

export class MockSupportIssueRepository implements ISupportIssueRepository {
  async getById(id: string) {
    const issue = mockStore.supportIssues.find((i) => i.id === id);
    return issue ? structuredClone(issue) : null;
  }

  async getByReference(referenceNumber: string) {
    const issue = mockStore.supportIssues.find(
      (i) => i.referenceNumber === referenceNumber
    );
    return issue ? structuredClone(issue) : null;
  }

  async listMine(userId: string) {
    return structuredClone(
      mockStore.supportIssues
        .filter((i) => i.reportedBy === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  async listAll(filters?: { status?: string }) {
    let list = [...mockStore.supportIssues];
    if (filters?.status) {
      list = list.filter((i) => i.status === filters.status);
    }
    return structuredClone(
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }

  async nextSequence(yearLabel: number) {
    const current = mockStore.supportIssueSequences.get(yearLabel) ?? 0;
    const next = current + 1;
    mockStore.supportIssueSequences.set(yearLabel, next);
    return next;
  }

  async save(issue: SupportIssue, screenshot?: Buffer | null) {
    const idx = mockStore.supportIssues.findIndex((i) => i.id === issue.id);
    const next = structuredClone(issue);
    if (screenshot && screenshot.length > 0) {
      screenshots.set(issue.id, Buffer.from(screenshot));
      next.hasScreenshot = true;
    } else if (screenshot === null) {
      screenshots.delete(issue.id);
      next.hasScreenshot = false;
      next.screenshotFileName = null;
      next.screenshotContentType = null;
    } else if (idx >= 0) {
      next.hasScreenshot = screenshots.has(issue.id);
    }
    if (idx >= 0) mockStore.supportIssues[idx] = next;
    else mockStore.supportIssues.push(next);
    return structuredClone(next);
  }

  async getScreenshot(id: string) {
    const issue = mockStore.supportIssues.find((i) => i.id === id);
    const content = screenshots.get(id);
    if (!issue?.screenshotFileName || !issue.screenshotContentType || !content) {
      return null;
    }
    return {
      content: Buffer.from(content),
      fileName: issue.screenshotFileName,
      contentType: issue.screenshotContentType,
    };
  }
}

export function __resetMockSupportScreenshots(): void {
  screenshots.clear();
}
