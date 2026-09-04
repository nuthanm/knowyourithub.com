export type SubmissionQueueStatus = "awaiting_review" | "in_progress" | "verified" | "rejected";

export type QueueSubmissionItem = {
  id: string;
  slug: string;
  name: string;
  submitterName?: string;
  submitterEmail?: string;
  requestType: "add" | "edit";
  isPortalRequest: boolean;
  queueStatus: SubmissionQueueStatus;
  note: string;
  submittedAt: string;
  website?: string;
};

export function queueStatusToSearchStatus(status: SubmissionQueueStatus) {
  return status === "in_progress" ? "in_progress" : "unverified";
}
