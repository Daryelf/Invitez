"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type GuestStatus = "pending" | "attending" | "declined";
type Guest = {
  id: string;
  name: string;
  partySize: number;
  status: GuestStatus;
  additionalInformation: string;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openedCount: number;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DashboardData = {
  guests: Guest[];
};

const PUBLIC_INVITE_URL = "https://www.invitez.xyz/?fresh=1";

const statusLabel: Record<GuestStatus, string> = {
  pending: "No reply",
  attending: "Attending",
  declined: "Not going",
};

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function AdminClient({
  adminName,
  signOutPath,
}: {
  adminName: string;
  signOutPath: string;
}) {
  const [data, setData] = useState<DashboardData>({ guests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "guests" | "preview" | "event">("overview");
  const [filter, setFilter] = useState<"all" | GuestStatus | "unopened">("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [previewSize, setPreviewSize] = useState<"mobile" | "web">("mobile");
  const [manualLink, setManualLink] = useState<{ url: string } | null>(null);

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/guests", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the invitation dashboard");
      const next = await response.json() as DashboardData;
      setData(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const total = data.guests.length;
    const attending = data.guests.filter((guest) => guest.status === "attending");
    return {
      total,
      opened: data.guests.filter((guest) => guest.openedCount > 0).length,
      pending: data.guests.filter((guest) => guest.status === "pending").length,
      attending: attending.length,
      declined: data.guests.filter((guest) => guest.status === "declined").length,
      headcount: attending.reduce((sum, guest) => sum + guest.partySize, 0),
    };
  }, [data.guests]);

  const visibleGuests = useMemo(() => data.guests.filter((guest) => {
    const matchesQuery = !query || `${guest.name} ${guest.additionalInformation}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "unopened" && guest.openedCount === 0)
      || guest.status === filter;
    return matchesQuery && matchesFilter;
  }), [data.guests, filter, query]);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function updateGuest(id: string, update: Record<string, unknown>, message?: string) {
    const response = await fetch(`/api/admin/guests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (!response.ok) throw new Error("Could not update guest");
    if (message) toast(message);
    await loadDashboard();
  }

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Safari and embedded browsers can reject the Clipboard API when focus shifts.
      }
    }
    const field = document.createElement("textarea");
    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.focus();
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy is unavailable in this browser");
  }

  async function copyInvite() {
    try {
      await copyText(PUBLIC_INVITE_URL);
      toast("Invitation link copied");
    } catch {
      setManualLink({ url: PUBLIC_INVITE_URL });
    }
  }

  async function deleteGuest(guest: Guest) {
    if (!window.confirm(`Remove ${guest.name} from the guest list?`)) return;
    const response = await fetch(`/api/admin/guests/${guest.id}`, { method: "DELETE" });
    if (!response.ok) return setError("Could not remove guest");
    toast(`${guest.name} removed`);
    await loadDashboard();
  }


  if (loading) return <main className={styles.loadingPage}><div className={styles.loader} /><p>Opening Argentum Studio…</p></main>;

  return (
    <main className={styles.adminApp}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span>A</span><div><strong>Argentum Studio</strong><small>Invitation Creator</small></div></div>
        <nav aria-label="Dashboard sections">
          {(["overview", "guests", "preview", "event"] as const).map((item) => (
            <button key={item} className={tab === item ? styles.activeNav : ""} onClick={() => setTab(item)}>
              <span aria-hidden="true">{item === "overview" ? "⌂" : item === "guests" ? "♙" : item === "preview" ? "▣" : "✦"}</span>
              {item === "overview" ? "Studio" : item === "guests" ? "Responses" : item === "preview" ? "Designer" : "Event day"}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.avatar}>{adminName.slice(0, 1).toUpperCase()}</div>
          <div><strong>{adminName}</strong><small>Creator account</small></div>
          <a href={signOutPath} aria-label="Log out" title="Log out">↗</a>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Argentum Studio</p>
            <h1>{tab === "overview" ? "Invitation dashboard" : tab === "guests" ? "RSVP responses" : tab === "preview" ? "Invitation designer" : "Event day"}</h1>
          </div>
          <div className={styles.headerActions}>
            <a className={styles.secondaryButton} href={PUBLIC_INVITE_URL} target="_blank" rel="noreferrer">Open invitation</a>
            <button className={styles.primaryButton} onClick={() => void copyInvite()}>Copy invitation link</button>
          </div>
        </header>

        {error ? <div className={styles.errorBanner}><span>{error}</span><button onClick={() => setError("")}>×</button></div> : null}
        {notice ? <div className={styles.toast}>{notice}</div> : null}

        {tab === "overview" ? (
          <div className={styles.pageGrid}>
            <section className={styles.studioHero}>
              <div>
                <p className={styles.eyebrow}>Argentum Studio · Invitation Creator</p>
                <h2>One invitation. One link.</h2>
                <p>Copy the same invitation link and send it to anyone. Their RSVP responses will appear here automatically.</p>
              </div>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} onClick={() => void copyInvite()}>Copy link</button>
                <button className={styles.secondaryButton} onClick={() => setTab("preview")}>Open designer</button>
              </div>
            </section>
            <section className={styles.metricsGrid}>
              {[
                ["Responses", metrics.total, "All submitted RSVPs"],
                ["Opened", metrics.opened, `${metrics.total - metrics.opened} unopened`],
                ["Attending", metrics.attending, `${metrics.headcount} total people`],
                ["No reply", metrics.pending, "Follow up needed"],
                ["Not going", metrics.declined, "Declined responses"],
              ].map(([label, value, detail]) => <article className={styles.metricCard} key={String(label)}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
            </section>
            <section className={styles.overviewColumns}>
              <article className={styles.panel}>
                <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Live activity</p><h2>Latest guest updates</h2></div><button onClick={() => setTab("guests")}>See all</button></div>
                <div className={styles.activityList}>
                  {data.guests.slice(0, 6).map((guest) => (
                    <div key={guest.id}><span className={`${styles.statusDot} ${styles[guest.status]}`} /><div><strong>{guest.name}</strong><small>{guest.respondedAt ? `${statusLabel[guest.status]} · ${shortDate(guest.respondedAt)}` : guest.firstOpenedAt ? `Opened · ${shortDate(guest.firstOpenedAt)}` : "Invitation not opened"}</small></div><em>{guest.openedCount ? `${guest.openedCount}×` : "—"}</em></div>
                  ))}
                  {!data.guests.length ? <div className={styles.emptyState}><strong>No responses yet</strong><small>Copy the invitation link and send it to your guests.</small></div> : null}
                </div>
              </article>
              <article className={[styles.panel, styles.deliveryCard].join(" ")}>
                <div className={styles.deliveryStatus}><span className={styles.connectedDot} />Ready to share</div>
                <p className={styles.eyebrow}>Invitation link</p>
                <h2>Send it anywhere</h2>
                <p>Use this one link in Messages, email, social media, or wherever you contact your guests.</p>
                <div className={styles.shareLink}>{PUBLIC_INVITE_URL}</div>
                <button onClick={() => void copyInvite()}>Copy invitation link</button>
              </article>
            </section>
          </div>
        ) : null}

        {tab === "guests" ? (
          <section className={[styles.panel, styles.audiencePanel].join(" ")}>
            <div className={styles.audienceIntro}>
              <div><p className={styles.eyebrow}>Guest responses</p><h2>Everyone who answered</h2><p>Review attendance, party size, and additional information submitted through your single invitation link.</p></div>
              <button className={styles.primaryButton} onClick={() => void copyInvite()}>Copy invitation link</button>
            </div>
            <div className={styles.guestToolbar}>
              <div className={styles.filters}>{(["all", "attending", "pending", "declined", "unopened"] as const).map((item) => <button key={item} className={filter === item ? styles.activeFilter : ""} onClick={() => setFilter(item)}>{item === "all" ? `All ${metrics.total}` : item === "pending" ? `No reply ${metrics.pending}` : item === "attending" ? `Going ${metrics.attending}` : item === "declined" ? `Not going ${metrics.declined}` : "Unopened"}</button>)}</div>
              <div className={styles.guestTools}><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guests" /><a href="/api/admin/export">Export CSV</a></div>
            </div>
            <div className={styles.tableWrap}>
              <table><thead><tr><th>Guest</th><th>Response</th><th>Party</th><th>Additional information</th><th>Last activity</th><th /></tr></thead>
                <tbody>{visibleGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td><strong>{guest.name}</strong><small>{guest.openedCount ? `Opened ${guest.openedCount} time${guest.openedCount === 1 ? "" : "s"}` : "RSVP submission"}</small></td>
                    <td><select value={guest.status} onChange={(event) => void updateGuest(guest.id, { status: event.target.value }, "Response updated")}><option value="pending">No reply</option><option value="attending">Attending</option><option value="declined">Not going</option></select></td>
                    <td><strong>{guest.partySize}</strong></td>
                    <td className={styles.notesCell}>{guest.additionalInformation || "—"}</td>
                    <td><small>{shortDate(guest.respondedAt || guest.lastOpenedAt)}</small></td>
                    <td><button className={styles.deleteButton} onClick={() => void deleteGuest(guest)} aria-label={`Remove ${guest.name}`}>×</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {!visibleGuests.length ? <div className={styles.emptyState}><strong>No responses match this view</strong><small>Try another filter or wait for new RSVPs.</small></div> : null}
            </div>
          </section>
        ) : null}

        {tab === "preview" ? (
          <section className={styles.previewLayout}>
            <div className={styles.previewControls}>
              <div>
                <p className={styles.eyebrow}>Invitation designer</p>
                <h2>Design at phone size</h2>
                <p>The editor is isolated from guest tracking. Adjust the interactive RSVP controls, then open a clean copy to test the complete experience.</p>
              </div>
              <div className={styles.editorGuide}>
                <strong>Layout editor is on</strong>
                <span>Move, resize, or rotate every RSVP control, the vinyl icon, and the View Map button. Choose Yellow or Transparent for the fields and Submit button. Changes save automatically.</span>
              </div>
              <div className={styles.segmented}>
                <button className={previewSize === "mobile" ? styles.segmentActive : ""} onClick={() => setPreviewSize("mobile")}>Mobile</button>
                <button className={previewSize === "web" ? styles.segmentActive : ""} onClick={() => setPreviewSize("web")}>Web / iPad</button>
              </div>
              <div className={styles.previewActions}>
                <a className={styles.primaryButton} href="https://www.invitez.xyz/?fresh=1" target="_blank" rel="noreferrer">Open clean preview</a>
                <a className={styles.secondaryButton} href="https://www.invitez.xyz/?fresh=1&preview=mobile" target="_blank" rel="noreferrer">Open phone preview</a>
              </div>
            </div>
            <div className={`${styles.previewStage} ${previewSize === "web" ? styles.previewWeb : ""}`}>
              <iframe title={`${previewSize} invitation layout editor`} src={`/?fresh=1&preview=${previewSize}&editor=1`} />
            </div>
          </section>
        ) : null}

        {tab === "event" ? (
          <section className={styles.eventPlaceholder}>
            <div className={styles.eventPlaceholderIcon} aria-hidden="true">✦</div>
            <p className={styles.eyebrow}>Coming later</p>
            <h2>Event Day</h2>
            <p>This space is reserved for the experience guests will use during the event. We’ll design and build it when you’re ready.</p>
            <button className={styles.secondaryButton} onClick={() => setTab("overview")}>Back to studio</button>
          </section>
        ) : null}
      </section>

      {manualLink ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setManualLink(null); }}>
          <section className={[styles.modal, styles.linkModal].join(" ")} role="dialog" aria-modal="true" aria-label="Copy invitation link">
            <div className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>Invitation link</p><h2>Copy this one link</h2><p>This browser blocked automatic copying, so the invitation URL is selected below.</p></div>
              <button type="button" onClick={() => setManualLink(null)}>×</button>
            </div>
            <label className={styles.linkFallbackField}>
              <span>Invitation URL</span>
              <input value={manualLink.url} readOnly onFocus={(event) => event.currentTarget.select()} autoFocus />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setManualLink(null)}>Close</button>
              <a className={styles.primaryButton} href={manualLink.url} target="_blank" rel="noreferrer">Open invitation</a>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
