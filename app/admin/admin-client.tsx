"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type GuestStatus = "pending" | "attending" | "declined";
type Guest = {
  id: string;
  token: string;
  name: string;
  email: string;
  phone: string;
  partySize: number;
  status: GuestStatus;
  additionalInformation: string;
  sentAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openedCount: number;
  respondedAt: string | null;
  smsStatus: string | null;
  smsError: string;
  smsSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type EventInfo = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventIso: string;
  venue: string;
  address: string;
  mapUrl: string;
};

type DashboardData = {
  guests: Guest[];
  event: EventInfo;
  eventDayOverride: boolean;
  photoUploadsEnabled: boolean;
  eventDayActive: boolean;
  sms: {
    provider: "Twilio";
    configured: boolean;
    accountConnected: boolean;
    senderConnected: boolean;
    missing: string[];
  };
};

const emptyEvent: EventInfo = {
  eventName: "Current event",
  eventDate: "Date not set",
  eventTime: "Time not set",
  eventIso: "2026-10-03T19:00:00-04:00",
  venue: "Venue not set",
  address: "",
  mapUrl: "",
};

const emptySms = {
  provider: "Twilio" as const,
  configured: false,
  accountConnected: false,
  senderConnected: false,
  missing: ["Twilio Account SID", "Twilio Auth Token", "Twilio Messaging Service SID or sender number"],
};

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
  const [data, setData] = useState<DashboardData>({ guests: [], event: emptyEvent, eventDayOverride: false, photoUploadsEnabled: true, eventDayActive: false, sms: emptySms });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "guests" | "preview" | "event">("overview");
  const [filter, setFilter] = useState<"all" | GuestStatus | "unopened" | "unsent">("all");
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [bulkNames, setBulkNames] = useState("");
  const [markSent, setMarkSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewSize, setPreviewSize] = useState<"mobile" | "web">("mobile");
  const [settings, setSettings] = useState<EventInfo>(emptyEvent);
  const [smsGuest, setSmsGuest] = useState<Guest | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [smsError, setSmsError] = useState("");
  const [manualLink, setManualLink] = useState<{ guestName: string; url: string } | null>(null);

  const loadDashboard = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/guests", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the invitation dashboard");
      const next = await response.json() as DashboardData;
      setData(next);
      setSettings(next.event);
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
      sent: data.guests.filter((guest) => guest.sentAt).length,
      opened: data.guests.filter((guest) => guest.openedCount > 0).length,
      pending: data.guests.filter((guest) => guest.status === "pending").length,
      attending: attending.length,
      declined: data.guests.filter((guest) => guest.status === "declined").length,
      headcount: attending.reduce((sum, guest) => sum + guest.partySize, 0),
      smsSent: data.guests.filter((guest) => guest.smsSentAt).length,
    };
  }, [data.guests]);

  const visibleGuests = useMemo(() => data.guests.filter((guest) => {
    const matchesQuery = !query || `${guest.name} ${guest.email} ${guest.phone} ${guest.additionalInformation}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all"
      || (filter === "unopened" && guest.openedCount === 0)
      || (filter === "unsent" && !guest.sentAt)
      || guest.status === filter;
    return matchesQuery && matchesFilter;
  }), [data.guests, filter, query]);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function addGuests(event: FormEvent) {
    event.preventDefault();
    const guests = [
      ...(name.trim() ? [{ name: name.trim(), email: email.trim(), phone: phone.trim(), partySize }] : []),
      ...bulkNames.split("\n").map((line) => line.trim()).filter(Boolean).map((guestName) => ({ name: guestName, partySize: 1 })),
    ];
    if (!guests.length) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests, markSent }),
      });
      const result = await response.json() as { error?: string; added?: number };
      if (!response.ok) throw new Error(result.error || "Could not add guests");
      setName(""); setEmail(""); setPhone(""); setPartySize(1); setBulkNames(""); setAddOpen(false);
      toast(`${result.added || guests.length} guest${guests.length === 1 ? "" : "s"} added`);
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not add guests");
    } finally {
      setSaving(false);
    }
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

  function inviteUrl(guest: Guest) {
    return `https://www.invitez.xyz/i/${encodeURIComponent(guest.token.trim())}`;
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

  async function copyInvite(guest: Guest) {
    try {
      await copyText(inviteUrl(guest));
      toast(`One clean link copied for ${guest.name}`);
    } catch {
      setManualLink({ guestName: guest.name, url: inviteUrl(guest) });
    }
  }

  async function copySmsMessage() {
    try {
      await copyText(smsMessage);
      toast("SMS message copied");
    } catch {
      setSmsError("This browser blocked copying. Select the message text and copy it manually.");
    }
  }

  function beginSms(guest: Guest) {
    if (!guest.phone) {
      setError(`Add a mobile number for ${guest.name} before preparing a text.`);
      return;
    }
    setSmsGuest(guest);
    setSmsMessage(`Hi ${guest.name}, you're invited to ${data.event.eventName}! View your invitation and RSVP: ${inviteUrl(guest)} Reply STOP to opt out.`);
    setSmsConsent(false);
    setSmsError("");
  }

  async function sendSms() {
    if (!smsGuest) return;
    setSaving(true);
    setSmsError("");
    try {
      const response = await fetch(`/api/admin/guests/${smsGuest.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsMessage, consentConfirmed: smsConsent }),
      });
      const result = await response.json() as { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || "Could not send the text message");
      setSmsGuest(null);
      toast(`Text invitation queued for ${smsGuest.name}`);
      await loadDashboard();
    } catch (sendError) {
      setSmsError(sendError instanceof Error ? sendError.message : "Could not send the text message");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGuest(guest: Guest) {
    if (!window.confirm(`Remove ${guest.name} from the guest list?`)) return;
    const response = await fetch(`/api/admin/guests/${guest.id}`, { method: "DELETE" });
    if (!response.ok) return setError("Could not remove guest");
    toast(`${guest.name} removed`);
    await loadDashboard();
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, dayOfOverride: data.eventDayOverride, photoUploadsEnabled: data.photoUploadsEnabled }),
      });
      if (!response.ok) throw new Error("Could not save event details");
      toast("Event details saved");
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save event details");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEventSetting(key: "eventDayOverride" | "photoUploadsEnabled", value: boolean) {
    setData((current) => ({ ...current, [key]: value }));
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!response.ok) setError("Could not update event-day mode");
    else { toast(key === "eventDayOverride" ? (value ? "Event-day mode is on" : "Event-day mode returned to automatic") : "Photo setting updated"); await loadDashboard(); }
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
              {item === "overview" ? "Studio" : item === "guests" ? "Guests & SMS" : item === "preview" ? "Designer" : "Event day"}
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
            <p className={styles.eyebrow}>Current project · {data.event.eventName}</p>
            <h1>{tab === "overview" ? "Creator dashboard" : tab === "guests" ? "Audience & delivery" : tab === "preview" ? "Invitation designer" : "Event controls"}</h1>
          </div>
          <div className={styles.headerActions}>
            <a className={styles.secondaryButton} href="https://www.invitez.xyz/?fresh=1" target="_blank" rel="noreferrer">Open invitation</a>
            <button className={styles.primaryButton} onClick={() => setAddOpen(true)}>+ Add guest</button>
          </div>
        </header>

        {error ? <div className={styles.errorBanner}><span>{error}</span><button onClick={() => setError("")}>×</button></div> : null}
        {notice ? <div className={styles.toast}>{notice}</div> : null}

        {tab === "overview" ? (
          <div className={styles.pageGrid}>
            <section className={styles.studioHero}>
              <div>
                <p className={styles.eyebrow}>Argentum Studio · Invitation Creator</p>
                <h2>{data.event.eventName}</h2>
                <p>Build the guest list, deliver individual links, monitor every RSVP, and control the day-of experience from one reusable creator workspace.</p>
              </div>
              <div className={styles.heroActions}>
                <button className={styles.primaryButton} onClick={() => setAddOpen(true)}>Add a guest</button>
                <button className={styles.secondaryButton} onClick={() => setTab("preview")}>Open designer</button>
              </div>
            </section>
            <section className={styles.metricsGrid}>
              {[
                ["Invited", metrics.total, "All guest links"],
                ["Links sent", metrics.sent, `${metrics.total - metrics.sent} not sent`],
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
                  {!data.guests.length ? <div className={styles.emptyState}><strong>No guests yet</strong><small>Add your guest list to create individual links.</small></div> : null}
                </div>
              </article>
              <article className={[styles.panel, styles.deliveryCard].join(" ")}>
                <div className={styles.deliveryStatus}>
                  <span className={data.sms.configured ? styles.connectedDot : styles.setupDot} />
                  {data.sms.configured ? "SMS connected" : "SMS setup needed"}
                </div>
                <p className={styles.eyebrow}>Delivery</p>
                <h2>Text invitations</h2>
                <p>{data.sms.configured ? `${metrics.smsSent} text invitation${metrics.smsSent === 1 ? "" : "s"} sent from Argentum Studio.` : "The SMS workflow is built and ready. Connect Twilio to send from your own number."}</p>
                {!data.sms.configured ? <ul>{data.sms.missing.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                <button onClick={() => setTab("guests")}>{data.sms.configured ? "Open delivery center" : "Preview SMS workflow"}</button>
              </article>
              <article className={`${styles.panel} ${styles.eventCard}`}>
                <p className={styles.eyebrow}>Current project</p><h2>{data.event.eventName}</h2>
                <dl><div><dt>Date</dt><dd>{data.event.eventDate}</dd></div><div><dt>Time</dt><dd>{data.event.eventTime}</dd></div><div><dt>Venue</dt><dd>{data.event.venue}</dd></div><div><dt>Address</dt><dd>{data.event.address || "Add the street address"}</dd></div></dl>
                <button onClick={() => setTab("event")}>Edit event details</button>
              </article>
            </section>
          </div>
        ) : null}

        {tab === "guests" ? (
          <section className={[styles.panel, styles.audiencePanel].join(" ")}>
            <div className={styles.audienceIntro}>
              <div><p className={styles.eyebrow}>Audience & delivery</p><h2>Every guest gets one clean, private link</h2><p>Copy a link, verify it in a new tab, or prepare an SMS while keeping delivery and RSVP history together.</p></div>
              <div className={data.sms.configured ? styles.smsReadyBadge : styles.smsSetupBadge}>{data.sms.configured ? "Twilio connected" : "SMS preview mode"}</div>
            </div>
            {!data.sms.configured ? (
              <div className={styles.smsSetupBanner}>
                <div><strong>Text sending is ready for credentials</strong><span>You can preview and copy every message now. Live sending unlocks after the secure Twilio values are added.</span></div>
                <ul>{data.sms.missing.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            ) : null}
            <div className={styles.guestToolbar}>
              <div className={styles.filters}>{(["all", "attending", "pending", "declined", "unopened", "unsent"] as const).map((item) => <button key={item} className={filter === item ? styles.activeFilter : ""} onClick={() => setFilter(item)}>{item === "all" ? `All ${metrics.total}` : item === "pending" ? `No reply ${metrics.pending}` : item === "attending" ? `Going ${metrics.attending}` : item === "declined" ? `Not going ${metrics.declined}` : item === "unopened" ? "Unopened" : "Not sent"}</button>)}</div>
              <div className={styles.guestTools}><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guests" /><a href="/api/admin/export">Export CSV</a></div>
            </div>
            <div className={styles.tableWrap}>
              <table><thead><tr><th>Guest</th><th>Delivery</th><th>Response</th><th>Party</th><th>Additional information</th><th>Last activity</th><th /></tr></thead>
                <tbody>{visibleGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td><strong>{guest.name}</strong><small>{guest.phone || guest.email || "No contact added"}</small></td>
                    <td>
                      <div className={styles.deliveryActions}>
                        <button className={styles.linkButton} onClick={() => void copyInvite(guest)}>Copy link</button>
                        <a href={inviteUrl(guest)} target="_blank" rel="noreferrer">Open</a>
                        <button className={styles.smsButton} disabled={!guest.phone} onClick={() => beginSms(guest)}>Text invite</button>
                      </div>
                      <button className={styles.sentToggle} onClick={() => void updateGuest(guest.id, { markSent: !guest.sentAt }, guest.sentAt ? "Marked as not sent" : "Marked as sent")}>{guest.sentAt ? "Sent ✓" : "Mark sent"}</button>
                      <small>{guest.smsStatus === "failed" ? `SMS failed · ${guest.smsError}` : guest.smsSentAt ? `SMS ${guest.smsStatus || "sent"} · ${shortDate(guest.smsSentAt)}` : guest.openedCount ? `Opened ${guest.openedCount} time${guest.openedCount === 1 ? "" : "s"}` : "Not opened"}</small>
                    </td>
                    <td><select value={guest.status} onChange={(event) => void updateGuest(guest.id, { status: event.target.value }, "Response updated")}><option value="pending">No reply</option><option value="attending">Attending</option><option value="declined">Not going</option></select></td>
                    <td><strong>{guest.partySize}</strong></td>
                    <td className={styles.notesCell}>{guest.additionalInformation || "—"}</td>
                    <td><small>{shortDate(guest.respondedAt || guest.lastOpenedAt || guest.smsSentAt || guest.sentAt)}</small></td>
                    <td><button className={styles.deleteButton} onClick={() => void deleteGuest(guest)} aria-label={`Remove ${guest.name}`}>×</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {!visibleGuests.length ? <div className={styles.emptyState}><strong>No guests match this view</strong><small>Try another filter or add more guests.</small></div> : null}
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
                <span>Move, resize, or rotate each control, then choose Yellow or Transparent for the fields and Submit button. Changes save automatically.</span>
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
          <section className={styles.eventLayout}>
            <form className={styles.panel} onSubmit={saveSettings}>
              <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Project settings</p><h2>Event information</h2></div><button className={styles.primaryButton} disabled={saving}>Save details</button></div>
              <div className={styles.formGrid}>
                <label><span>Event name</span><input value={settings.eventName} onChange={(event) => setSettings({ ...settings, eventName: event.target.value })} /></label>
                <label><span>Display date</span><input value={settings.eventDate} onChange={(event) => setSettings({ ...settings, eventDate: event.target.value })} /></label>
                <label><span>Display time</span><input value={settings.eventTime} onChange={(event) => setSettings({ ...settings, eventTime: event.target.value })} /></label>
                <label><span>Automatic event-day date/time</span><input type="datetime-local" value={settings.eventIso.slice(0, 16)} onChange={(event) => setSettings({ ...settings, eventIso: `${event.target.value}:00-04:00` })} /></label>
                <label><span>Venue</span><input value={settings.venue} onChange={(event) => setSettings({ ...settings, venue: event.target.value })} /></label>
                <label><span>Street address</span><input value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} placeholder="Add the complete address" /></label>
                <label className={styles.fullField}><span>Map link</span><input value={settings.mapUrl} onChange={(event) => setSettings({ ...settings, mapUrl: event.target.value })} placeholder="https://maps.google.com/…" /></label>
              </div>
            </form>
            <aside className={`${styles.panel} ${styles.eventControls}`}>
              <p className={styles.eyebrow}>Day-of experience</p><h2>Event mode</h2><p>On the event date, guest links automatically open the event-day photo page instead of the invitation.</p>
              <label className={styles.toggleRow}><div><strong>Turn on event-day mode now</strong><small>Useful for testing before {data.event.eventDate}.</small></div><input type="checkbox" checked={data.eventDayOverride} onChange={(event) => void toggleEventSetting("eventDayOverride", event.target.checked)} /></label>
              <label className={styles.toggleRow}><div><strong>Allow guest photo uploads</strong><small>Guests can add JPG, PNG, or WebP images.</small></div><input type="checkbox" checked={data.photoUploadsEnabled} onChange={(event) => void toggleEventSetting("photoUploadsEnabled", event.target.checked)} /></label>
              <div className={styles.modeStatus}><span className={data.eventDayActive ? styles.liveDot : ""} />{data.eventDayActive ? "Event-day experience is active" : "Invitation experience is active"}</div>
              <a className={styles.secondaryButton} href="/event-day?preview=1" target="_blank">Preview event-day page</a>
            </aside>
          </section>
        ) : null}
      </section>

      {addOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAddOpen(false); }}>
          <form className={styles.modal} onSubmit={addGuests}>
            <div className={styles.modalHeader}><div><p className={styles.eyebrow}>Audience</p><h2>Add an invited guest</h2><p>Create one private link that follows this guest from delivery through RSVP.</p></div><button type="button" onClick={() => setAddOpen(false)}>×</button></div>
            <div className={styles.formGrid}>
              <label><span>Guest or family name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="The Johnson Family" /></label>
              <label><span>Mobile number for SMS</span><input type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 201 555 0123" /></label>
              <label><span>Email (optional)</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@example.com" /></label>
              <label><span>Party size</span><input type="number" min="1" max="20" value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} /></label>
            </div>
            <div className={styles.formHint}>U.S. numbers are saved in international format automatically. Add a country code for numbers outside the U.S.</div>
            <div className={styles.divider}><span>or add many at once</span></div>
            <label className={styles.bulkField}><span>One name per line · contact details can be added later</span><textarea value={bulkNames} onChange={(event) => setBulkNames(event.target.value)} placeholder={'The Johnson Family\nMaria Santos\nJordan Lee'} /></label>
            <label className={styles.checkRow}><input type="checkbox" checked={markSent} onChange={(event) => setMarkSent(event.target.checked)} /><span>Mark these invitation links as already sent</span></label>
            <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={() => setAddOpen(false)}>Cancel</button><button className={styles.primaryButton} disabled={saving || (!name.trim() && !bulkNames.trim())}>{saving ? "Adding…" : "Create guest links"}</button></div>
          </form>
        </div>
      ) : null}

      {smsGuest ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSmsGuest(null); }}>
          <section className={[styles.modal, styles.smsModal].join(" ")} role="dialog" aria-modal="true" aria-label={`Text invitation for ${smsGuest.name}`}>
            <div className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>SMS preview</p><h2>Text {smsGuest.name}</h2><p>Review exactly what the guest will receive before anything is sent.</p></div>
              <button type="button" onClick={() => setSmsGuest(null)}>×</button>
            </div>
            <div className={styles.smsRecipient}>
              <div><span>Mobile</span><strong>{smsGuest.phone}</strong></div>
              <div><span>Private invite link</span><strong>{inviteUrl(smsGuest)}</strong></div>
            </div>
            <label className={styles.smsComposer}>
              <span>Message</span>
              <textarea value={smsMessage} onChange={(event) => setSmsMessage(event.target.value.slice(0, 640))} />
              <small>{smsMessage.length} / 640 characters</small>
            </label>
            {!data.sms.configured ? <div className={styles.smsNotConnected}><strong>Preview only</strong><span>Connect {data.sms.missing.join(", ")} before the Send SMS button is enabled. You can copy this message and test it manually now.</span></div> : null}
            {smsError ? <div className={styles.authError} role="alert">{smsError}</div> : null}
            <label className={styles.consentRow}><input type="checkbox" checked={smsConsent} onChange={(event) => setSmsConsent(event.target.checked)} /><span>I confirm this guest agreed to receive this invitation by text.</span></label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => void copySmsMessage()}>Copy message</button>
              <a className={styles.secondaryButton} href={`sms:${smsGuest.phone}?&body=${encodeURIComponent(smsMessage)}`}>Open Messages</a>
              <button type="button" className={styles.secondaryButton} onClick={() => setSmsGuest(null)}>Cancel</button>
              <button type="button" className={styles.primaryButton} disabled={saving || !data.sms.configured || !smsConsent || smsMessage.length < 10} onClick={() => void sendSms()}>{saving ? "Sending…" : data.sms.configured ? "Send SMS" : "SMS setup required"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {manualLink ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setManualLink(null); }}>
          <section className={[styles.modal, styles.linkModal].join(" ")} role="dialog" aria-modal="true" aria-label="Copy invitation link">
            <div className={styles.modalHeader}>
              <div><p className={styles.eyebrow}>Clean invite link</p><h2>Copy for {manualLink.guestName}</h2><p>This browser blocked automatic copying, so the exact link is selected here with no duplicated text.</p></div>
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
