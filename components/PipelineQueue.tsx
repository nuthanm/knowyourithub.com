"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  type VerificationStatus,
} from "@/lib/companies";
import { getQueueApiUrl } from "@/lib/site-meta";
import { type QueueSubmissionItem } from "@/lib/submissions-shared";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";
import { IconCompanies, IconSubmit } from "@/components/PortalIcons";
import { AppSelect } from "@/components/AppSelect";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type QueueStatusUpdate = "awaiting_review" | "in_progress" | "rejected";

const STATUS_OPTIONS: Array<{ id: VerificationStatus | "all"; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "in_progress", label: "In progress" },
  { id: "unverified", label: "Awaiting review" },
];

function applyQueueStatus(
  items: QueueSubmissionItem[],
  submissionId: string,
  next: QueueStatusUpdate,
): QueueSubmissionItem[] {
  if (next === "rejected") {
    return items.filter((item) => item.id !== submissionId);
  }

  return items.map((item) =>
    item.id === submissionId
      ? {
          ...item,
          queueStatus: next,
        }
      : item,
  );
}

type StatTileProps = {
  label: string;
  value: number;
  detail?: string;
  status?: VerificationStatus;
  active?: boolean;
  onClick?: () => void;
};

function StatTile({ label, value, detail, status, active, onClick }: StatTileProps) {
  const className = [
    "pipeline-stat",
    status === "verified" ? "verified" : "",
    status === "in_progress" ? "in-progress" : "",
    status === "unverified" ? "unverified" : "",
    status === undefined ? "total" : "",
    active ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {status && <VerificationStatusTag status={status} size="sm" />}
      <strong>{value}</strong>
      <h3>{label}</h3>
      {detail && <p>{detail}</p>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export function PipelineQueue() {
  const searchParams = useSearchParams();
  const [queueEntries, setQueueEntries] = useState<QueueSubmissionItem[]>([]);
  const confirmedStatusUpdates = useRef(new Map<string, QueueStatusUpdate>());
  const [mailBanner, setMailBanner] = useState<{
    companyName: string;
    outcome: "added" | "already_queued";
  } | null>(null);
  const moderatorToken = useMemo(() => searchParams.get("moderate")?.trim() ?? "", [searchParams]);
  const effectiveModeratorToken = moderatorToken;
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const queueUrl = moderatorToken
      ? `${getQueueApiUrl()}?moderate=${encodeURIComponent(moderatorToken)}`
      : getQueueApiUrl();

    void fetch(queueUrl, { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { ok?: boolean; items?: QueueSubmissionItem[] };
      })
      .then((json) => {
        if (!active || !json?.ok || !json.items) return;
        setQueueEntries(
          json.items.map((entry) => {
              const confirmedStatus = confirmedStatusUpdates.current.get(entry.id);
              return confirmedStatus
                ? applyQueueStatus([entry], entry.id, confirmedStatus)[0]!
                : entry;
            }),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [moderatorToken]);

  // Banner only when arriving from the admin email "Add to queue" link
  useEffect(() => {
    const fromMail = searchParams.get("from") === "mail";
    const bannerToken = searchParams.get("banner");
    if (!fromMail || !bannerToken) return;

    let active = true;
    const verifyUrl = `${getQueueApiUrl()}?banner=${encodeURIComponent(bannerToken)}`;

    void fetch(verifyUrl, { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          ok?: boolean;
          fromMail?: boolean;
          companyName?: string;
          outcome?: "added" | "already_queued";
        };
      })
      .then((json) => {
        if (!active || !json?.ok || !json.fromMail || !json.companyName) return;
        setMailBanner({
          companyName: json.companyName,
          outcome: json.outcome === "already_queued" ? "already_queued" : "added",
        });
        const url = new URL(window.location.href);
        url.searchParams.delete("from");
        url.searchParams.delete("banner");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [searchParams]);

  async function updateQueueStatus(entry: QueueSubmissionItem, next: QueueStatusUpdate) {
    if (!effectiveModeratorToken || updatingId) return;
    setUpdateError(null);
    setUpdateNotice(null);
    setUpdatingId(entry.id);
    const previousEntries = queueEntries;

    // Optimistic update keeps moderation UX responsive even when network/email is slow.
    setQueueEntries((prev) => applyQueueStatus(prev, entry.id, next));

    try {
      const res = await fetch(`${getQueueApiUrl()}/status`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-moderator-token": effectiveModeratorToken,
        },
        body: JSON.stringify({
          id: entry.id,
          status: next,
          companyName: entry.name,
          companySlug: entry.slug,
        }),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        item?: {
          status?: QueueStatusUpdate;
          changed?: boolean;
          subscriberNotification?: {
            configured?: boolean;
            recipients?: number;
            delivered?: number;
            failed?: number;
          };
          requesterNotification?: {
            configured?: boolean;
            delivered?: boolean;
            failed?: boolean;
          };
        };
      };
      if (!res.ok || !json.ok) {
        setQueueEntries(previousEntries);
        setUpdateError(json.error || "Unable to update queue status.");
        return;
      }

      const confirmedStatus = json.item?.status;
      confirmedStatusUpdates.current.set(entry.id, confirmedStatus ?? next);
      if (confirmedStatus && confirmedStatus !== next) {
        setQueueEntries((prev) => applyQueueStatus(prev, entry.id, confirmedStatus));
      }

      const notification = json.item?.subscriberNotification;
      const requesterNotification = json.item?.requesterNotification;
      if (json.item?.changed && next === "rejected") {
        if (!requesterNotification?.configured) {
          setUpdateNotice("Request rejected. Customer email was not sent because SMTP is not configured.");
        } else if (requesterNotification.failed) {
          setUpdateNotice("Request rejected, but the customer email could not be delivered.");
        } else if (requesterNotification.delivered) {
          setUpdateNotice("Request rejected. A notification email was sent to the customer.");
        }
      } else if (json.item?.changed) {
        if (!notification?.configured) {
          setUpdateNotice("Status saved. Subscriber email was not sent because SMTP is not configured.");
        } else if (notification.failed) {
          setUpdateNotice("Status saved. Some subscriber emails could not be delivered.");
        } else if (notification.delivered) {
          setUpdateNotice(
            `Status saved. Subscriber email sent to ${notification.delivered} ${notification.delivered === 1 ? "recipient" : "recipients"}.`,
          );
        } else {
          setUpdateNotice("Status saved. There are no subscriber email addresses to notify.");
        }
      }
    } catch {
      setQueueEntries(previousEntries);
      confirmedStatusUpdates.current.delete(entry.id);
      setUpdateError("Unable to update queue status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const allEntries = useMemo(
    () => [...queueEntries].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    [queueEntries],
  );

  const inProgressCount = allEntries.filter((entry) => entry.queueStatus === "in_progress").length;
  const unverifiedCount = allEntries.filter((entry) => entry.queueStatus === "awaiting_review").length;
  const totalInQueue = inProgressCount + unverifiedCount;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VerificationStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const filtered = useMemo(
    () =>
      allEntries.filter((entry) => {
        const matchesQuery = `${entry.name} ${entry.note}`.toLowerCase().includes(query.trim().toLowerCase());
        const matchesStatus = status === "all" || (status === "in_progress"
          ? entry.queueStatus === "in_progress"
          : entry.queueStatus === "awaiting_review");
        return matchesQuery && matchesStatus;
      }),
    [allEntries, query, status],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  function updateStatus(next: VerificationStatus | "all") {
    setStatus(next);
    setPage(1);
  }

  function updateQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function updatePageSize(next: string) {
    const value = Number(next);
    if (!PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number]);
    setPage(1);
  }

  return (
    <section className="pipeline-dashboard" aria-labelledby="pipeline-dashboard-title">
      {mailBanner && (
        <div className="queue-mail-banner" role="status">
          <strong>{mailBanner.companyName}</strong>{" "}
          {mailBanner.outcome === "already_queued"
            ? "is already in the review queue"
            : "was added to the review queue"}
          <button
            type="button"
            className="queue-mail-banner-dismiss"
            aria-label="Dismiss"
            onClick={() => setMailBanner(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="pipeline-dashboard-head">
        <h2 id="pipeline-dashboard-title">Review queue</h2>
        <p>
          {totalInQueue} companies we are tracking before they become verified profiles.
          {queueEntries.length > 0 && (
            <>
              {" "}
              Includes <strong>{queueEntries.length}</strong> active {queueEntries.length === 1 ? "request" : "requests"}.
            </>
          )}
        </p>
        {effectiveModeratorToken && (
          <p className="pipeline-results-bar" role="status" style={{ marginTop: 8 }}>
            Request moderation is active. Only the request linked from the email is shown.
          </p>
        )}
        {updateError && (
          <p className="pipeline-results-bar" role="alert" style={{ marginTop: 8 }}>
            {updateError}
          </p>
        )}
        {updateNotice && (
          <p className="pipeline-results-bar" role="status" style={{ marginTop: 8 }}>
            {updateNotice}
          </p>
        )}
      </div>

      <div className="pipeline-stat-row" aria-label="Catalog counts">
        <StatTile
          label="Total in queue"
          value={totalInQueue}
          detail="All active requests"
          active={status === "all"}
          onClick={() => updateStatus("all")}
        />
        <StatTile
          label="Awaiting review"
          value={unverifiedCount}
          status="unverified"
          active={status === "unverified"}
          onClick={() => updateStatus(status === "unverified" ? "all" : "unverified")}
        />
        <StatTile
          label="In progress"
          value={inProgressCount}
          status="in_progress"
          active={status === "in_progress"}
          onClick={() => updateStatus(status === "in_progress" ? "all" : "in_progress")}
        />
      </div>

      <div className="pipeline-toolbar">
        <label className="pipeline-search">
          <span className="filter-select-label">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search by company name or note…"
            aria-label="Search review queue"
          />
        </label>
        <div className="pipeline-toolbar-filters">
          <label className="filter-select-wrap">
            <span className="filter-select-label">Status</span>
            <AppSelect
              inputId="review-queue-status"
              ariaLabel="Filter by status"
              value={status}
              onChange={(nextValue) => updateStatus(nextValue as VerificationStatus | "all")}
              options={STATUS_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
              isSearchable={false}
              size="compact"
            />
          </label>
          <label className="filter-select-wrap">
            <span className="filter-select-label">Rows per page</span>
            <AppSelect
              inputId="review-queue-page-size"
              ariaLabel="Rows per page"
              value={String(pageSize)}
              onChange={updatePageSize}
              options={PAGE_SIZE_OPTIONS.map((value) => ({ value: String(value), label: String(value) }))}
              isSearchable={false}
              size="compact"
            />
          </label>
        </div>
      </div>

      <p className="pipeline-results-bar">
        Showing <strong>{rangeStart}–{rangeEnd}</strong> of <strong>{filtered.length}</strong> in
        queue
        {status !== "all" && <> · {STATUS_OPTIONS.find((o) => o.id === status)?.label}</>}
        {query.trim() && <> · matching “{query.trim()}”</>}
      </p>

      <div className="pipeline-grid-wrap">
        <table className="pipeline-grid">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Request</th>
              <th scope="col">Status</th>
              <th scope="col">Note</th>
              {effectiveModeratorToken && <th scope="col"><span className="sr-only">Moderation</span></th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={effectiveModeratorToken ? 5 : 4} className="pipeline-grid-empty">
                  No companies match your filters.
                </td>
              </tr>
            ) : (
              pageItems.map((entry) => (
                <tr
                  key={entry.id}
                  className={`pipeline-grid-row status-${entry.queueStatus === "in_progress" ? "in_progress" : "unverified"}`}
                >
                  <td className="pipeline-grid-name">
                    {entry.name}
                  </td>
                  <td>
                    <span className="pipeline-community-badge">
                      {entry.requestType === "edit" ? "Modification request" : entry.isPortalRequest ? "Portal request" : "Mail request"}
                    </span>
                  </td>
                  <td>
                    <VerificationStatusTag
                      status={entry.queueStatus === "in_progress" ? "in_progress" : "unverified"}
                      size="sm"
                    />
                  </td>
                  <td className="pipeline-grid-note">{entry.note || "—"}</td>
                  {effectiveModeratorToken && <td className="pipeline-grid-action">
                    <div className="pipeline-grid-actions">
                      <div className="pipeline-moderation-actions">
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.id}
                          onClick={() => updateQueueStatus(entry, "awaiting_review")}
                        >
                          Awaiting
                        </button>
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.id}
                          onClick={() => updateQueueStatus(entry, "in_progress")}
                        >
                          In progress
                        </button>
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.id}
                          onClick={() => updateQueueStatus(entry, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="pipeline-pagination" aria-label="Review queue pages">
          <button
            type="button"
            className="pipeline-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
          >
            Previous
          </button>
          <span className="pipeline-page-info">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            type="button"
            className="pipeline-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
          >
            Next
          </button>
        </nav>
      )}

      <div className="pipeline-actions">
        <Link href="/companies" className="landing-btn primary">
          <IconCompanies size={16} />
          View Verified Companies
        </Link>
        <Link href="/submit" className="landing-btn secondary">
          <IconSubmit size={16} />
          Submit request
        </Link>
      </div>
    </section>
  );
}
