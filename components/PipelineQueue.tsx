"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ALL_COMPANY_SLUGS,
  CATALOG_PROGRESS,
  CATALOG_UPDATED,
  CATEGORY_LABELS,
  PIPELINE_IN_PROGRESS,
  PIPELINE_UNVERIFIED,
  type CompanyCategory,
  type VerificationStatus,
} from "@/lib/companies";
import {
  filterCompanyEntries,
  pipelineToEntry,
  type CompanySearchEntry,
} from "@/lib/company-search";
import { getQueueApiUrl } from "@/lib/site-meta";
import { queueStatusToSearchStatus, type QueueSubmissionItem } from "@/lib/submissions-shared";
import { VerificationStatusTag } from "@/components/VerificationStatusTag";
import { IconCompanies, IconSubmit } from "@/components/PortalIcons";
import { AppSelect } from "@/components/AppSelect";

const PAGE_SIZE = 20;
type QueueStatusUpdate = "awaiting_review" | "in_progress" | "verified" | "rejected";

const CATEGORY_OPTIONS: Array<{ id: CompanyCategory | "all"; label: string }> = [
  { id: "all", label: "All types" },
  { id: "product", label: "Product" },
  { id: "service", label: "Service" },
  { id: "hybrid", label: "Hybrid" },
];

const STATUS_OPTIONS: Array<{ id: VerificationStatus | "all"; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "in_progress", label: "In progress" },
  { id: "unverified", label: "Awaiting review" },
];

function formatCatalogDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function categoryClass(category: CompanyCategory) {
  if (category === "product") return "tag product";
  if (category === "service") return "tag service";
  if (category === "hybrid") return "tag hybrid";
  return "tag";
}

function buildPipelineEntries(): CompanySearchEntry[] {
  return [
    ...PIPELINE_IN_PROGRESS.map((item) => pipelineToEntry(item, "in_progress")),
    ...PIPELINE_UNVERIFIED.map((item) => pipelineToEntry(item, "unverified")),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

function decodeModerationTokenExpiry(token: string): number | null {
  try {
    const body = token.split(".")[0];
    if (!body) return null;
    const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function formatExpiry(exp: number) {
  return new Date(exp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function communityToEntry(item: QueueSubmissionItem): CompanySearchEntry {
  const status = item.queueStatus ?? "awaiting_review";
  return {
    slug: item.slug,
    name: item.name,
    verificationStatus: queueStatusToSearchStatus(status),
    category: "unknown",
    note: item.note,
    tagline: item.note,
    communityRequest: true,
    submissionId: item.id,
  };
}

function applyQueueStatus(
  items: CompanySearchEntry[],
  submissionId: string,
  next: QueueStatusUpdate,
): CompanySearchEntry[] {
  if (next === "verified" || next === "rejected") {
    return items.filter((item) => item.submissionId !== submissionId);
  }

  const nextStatus: VerificationStatus = queueStatusToSearchStatus(next);
  return items.map((item) =>
    item.submissionId === submissionId
      ? {
          ...item,
          verificationStatus: nextStatus,
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
  const staticEntries = useMemo(() => buildPipelineEntries(), []);
  const [communityEntries, setCommunityEntries] = useState<CompanySearchEntry[]>([]);
  const confirmedStatusUpdates = useRef(new Map<string, QueueStatusUpdate>());
  const [mailBanner, setMailBanner] = useState<{
    companyName: string;
    outcome: "added" | "already_queued";
  } | null>(null);
  const moderatorToken = useMemo(() => searchParams.get("moderate")?.trim() ?? "", [searchParams]);
  const [localModeratorToken, setLocalModeratorToken] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = window.sessionStorage.getItem("queueModerationToken")?.trim() ?? "";
    if (!stored) return "";
    const exp = decodeModerationTokenExpiry(stored);
    if (exp && Date.now() > exp) {
      window.sessionStorage.removeItem("queueModerationToken");
      return "";
    }
    return stored;
  });
  const [passcode, setPasscode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const effectiveModeratorToken = moderatorToken || localModeratorToken;
  const moderatorTokenExp = useMemo(
    () =>
      effectiveModeratorToken ? decodeModerationTokenExpiry(effectiveModeratorToken) : null,
    [effectiveModeratorToken],
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (moderatorToken) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("queueModerationToken", moderatorToken);
      }
    }
  }, [moderatorToken]);

  useEffect(() => {
    let active = true;

    void fetch(getQueueApiUrl(), { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { ok?: boolean; items?: QueueSubmissionItem[] };
      })
      .then((json) => {
        if (!active || !json?.ok || !json.items?.length) return;
        setCommunityEntries(
          json.items
            .map(communityToEntry)
            .map((entry) => {
              if (!entry.submissionId) return entry;
              const confirmedStatus = confirmedStatusUpdates.current.get(entry.submissionId);
              return confirmedStatus
                ? applyQueueStatus([entry], entry.submissionId, confirmedStatus)[0]!
                : entry;
            }),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

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

  async function updateQueueStatus(entry: CompanySearchEntry, next: QueueStatusUpdate) {
    if (!entry.submissionId || !effectiveModeratorToken || updatingId) return;
    setUpdateError(null);
    setUpdateNotice(null);
    setUpdatingId(entry.submissionId);
    const previousEntries = communityEntries;

    // Optimistic update keeps moderation UX responsive even when network/email is slow.
    setCommunityEntries((prev) => applyQueueStatus(prev, entry.submissionId!, next));

    try {
      const res = await fetch(`${getQueueApiUrl()}/status`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-moderator-token": effectiveModeratorToken,
        },
        body: JSON.stringify({
          id: entry.submissionId,
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
        setCommunityEntries(previousEntries);
        setUpdateError(json.error || "Unable to update queue status.");
        return;
      }

      const confirmedStatus = json.item?.status;
      confirmedStatusUpdates.current.set(entry.submissionId, confirmedStatus ?? next);
      if (confirmedStatus && confirmedStatus !== next) {
        setCommunityEntries((prev) => applyQueueStatus(prev, entry.submissionId!, confirmedStatus));
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
      setCommunityEntries(previousEntries);
      confirmedStatusUpdates.current.delete(entry.submissionId);
      setUpdateError("Unable to update queue status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function unlockModeration() {
    if (!passcode.trim() || unlocking) return;
    setUnlocking(true);
    setUnlockError(null);

    try {
      const res = await fetch(`${getQueueApiUrl()}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string; token?: string };
      if (!res.ok || !json.ok || !json.token) {
        setUnlockError(json.error || "Unable to unlock moderation mode.");
        return;
      }

      setLocalModeratorToken(json.token);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("queueModerationToken", json.token);
      }
      setPasscode("");
    } catch {
      setUnlockError("Unable to unlock moderation mode.");
    } finally {
      setUnlocking(false);
    }
  }

  const allEntries = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...communityEntries, ...staticEntries].filter((entry) => {
      if (seen.has(entry.slug)) return false;
      seen.add(entry.slug);
      return true;
    });
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [staticEntries, communityEntries]);

  const inProgressCount = allEntries.filter((entry) => entry.verificationStatus === "in_progress").length;
  const unverifiedCount = allEntries.filter((entry) => entry.verificationStatus === "unverified").length;
  const totalInQueue = inProgressCount + unverifiedCount;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CompanyCategory | "all">("all");
  const [status, setStatus] = useState<VerificationStatus | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      filterCompanyEntries(allEntries, {
        query,
        category,
        status,
      }),
    [allEntries, query, category, status],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function updateStatus(next: VerificationStatus | "all") {
    setStatus(next);
    setPage(1);
  }

  function updateCategory(next: CompanyCategory | "all") {
    setCategory(next);
    setPage(1);
  }

  function updateQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function entryHref(entry: CompanySearchEntry) {
    if (entry.communityRequest && !ALL_COMPANY_SLUGS.includes(entry.slug)) {
      return `/submit?company=${encodeURIComponent(entry.name)}`;
    }
    return `/companies/${entry.slug}`;
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
          {communityEntries.length > 0 && (
            <>
              {" "}
              Includes <strong>{communityEntries.length}</strong> recent portal{" "}
              {communityEntries.length === 1 ? "request" : "requests"}.
            </>
          )}{" "}
          Filter, browse, or click a row to see status and suggest official sources.
        </p>
        {effectiveModeratorToken && (
          <p className="pipeline-results-bar" role="status" style={{ marginTop: 8 }}>
            Moderation mode active for this browser session
            {moderatorTokenExp ? ` · token expires ${formatExpiry(moderatorTokenExp)}` : ""}
          </p>
        )}
        {!effectiveModeratorToken && (
          <div className="pipeline-toolbar" style={{ marginTop: 10 }}>
            <label className="pipeline-search" style={{ maxWidth: 360 }}>
              <span className="filter-select-label">Review passcode</span>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode to moderate"
                aria-label="Review queue passcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void unlockModeration();
                  }
                }}
              />
              <span className="pipeline-passcode-help">
                Use the configured review passcode. It is not generated on this page.
              </span>
            </label>
            <div className="pipeline-toolbar-filters">
              <button
                type="button"
                className="pipeline-page-btn"
                onClick={() => void unlockModeration()}
                disabled={unlocking || !passcode.trim()}
              >
                {unlocking ? "Unlocking…" : "Unlock moderation"}
              </button>
            </div>
          </div>
        )}
        {unlockError && (
          <p className="pipeline-results-bar" role="alert" style={{ marginTop: 8 }}>
            {unlockError}
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
        <Link href="/companies" className="pipeline-stat verified pipeline-stat-link">
          <VerificationStatusTag status="verified" size="sm" />
          <strong>{CATALOG_PROGRESS.verified}</strong>
          <h3>Verified</h3>
          <p>As on {formatCatalogDate(CATALOG_UPDATED)}</p>
        </Link>
        <StatTile
          label="In progress"
          value={inProgressCount}
          status="in_progress"
          active={status === "in_progress"}
          onClick={() => updateStatus(status === "in_progress" ? "all" : "in_progress")}
        />
        <StatTile
          label="Awaiting review"
          value={unverifiedCount}
          status="unverified"
          active={status === "unverified"}
          onClick={() => updateStatus(status === "unverified" ? "all" : "unverified")}
        />
        <StatTile
          label="Total in queue"
          value={totalInQueue}
          detail="In progress + awaiting review"
          active={status === "all"}
          onClick={() => updateStatus("all")}
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
            <span className="filter-select-label">Type</span>
            <AppSelect
              inputId="review-queue-category"
              ariaLabel="Filter by company type"
              value={category}
              onChange={(nextValue) => updateCategory(nextValue as CompanyCategory | "all")}
              options={CATEGORY_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
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
        {category !== "all" && <> · {CATEGORY_LABELS[category]}</>}
        {query.trim() && <> · matching “{query.trim()}”</>}
      </p>

      <div className="pipeline-grid-wrap">
        <table className="pipeline-grid">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Note</th>
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="pipeline-grid-empty">
                  No companies match your filters.
                </td>
              </tr>
            ) : (
              pageItems.map((entry) => (
                <tr
                  key={entry.communityRequest ? `community-${entry.submissionId}` : entry.slug}
                  className={`pipeline-grid-row status-${entry.verificationStatus}`}
                >
                  <td className="pipeline-grid-name">
                    <Link href={entryHref(entry)}>{entry.name}</Link>
                    {entry.communityRequest && (
                      <span className="pipeline-community-badge">Portal request</span>
                    )}
                  </td>
                  <td>
                    {entry.category !== "unknown" ? (
                      <span className={categoryClass(entry.category)}>
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    ) : (
                      <span className="pipeline-grid-muted">—</span>
                    )}
                  </td>
                  <td>
                    <VerificationStatusTag status={entry.verificationStatus} size="sm" />
                  </td>
                  <td className="pipeline-grid-note">{entry.note ?? entry.tagline ?? "—"}</td>
                  <td className="pipeline-grid-action">
                    <div className="pipeline-grid-actions">
                      <Link href={entryHref(entry)} className="catalog-pipeline-action">
                        {entry.communityRequest && !ALL_COMPANY_SLUGS.includes(entry.slug)
                          ? "Details"
                          : "View"}
                      </Link>
                    {effectiveModeratorToken && entry.communityRequest && entry.submissionId && (
                      <div className="pipeline-moderation-actions">
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.submissionId}
                          onClick={() => updateQueueStatus(entry, "awaiting_review")}
                        >
                          Awaiting
                        </button>
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.submissionId}
                          onClick={() => updateQueueStatus(entry, "in_progress")}
                        >
                          In progress
                        </button>
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.submissionId}
                          onClick={() => updateQueueStatus(entry, "verified")}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          className="catalog-pipeline-action"
                          disabled={updatingId === entry.submissionId}
                          onClick={() => updateQueueStatus(entry, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    </div>
                  </td>
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
          Verified companies
        </Link>
        <Link href="/submit" className="landing-btn secondary">
          <IconSubmit size={16} />
          Submit
        </Link>
      </div>
    </section>
  );
}
