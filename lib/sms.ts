import { env } from "cloudflare:workers";

type SmsEnvironment = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_MESSAGING_SERVICE_SID?: string;
  TWILIO_FROM_NUMBER?: string;
};

export type SmsConfigurationStatus = {
  provider: "Twilio";
  configured: boolean;
  accountConnected: boolean;
  senderConnected: boolean;
  missing: string[];
};

function smsEnvironment(): SmsEnvironment {
  const workerEnvironment = env as unknown as SmsEnvironment;
  const localEnvironment: SmsEnvironment = typeof process !== "undefined" ? process.env as SmsEnvironment : {};
  return {
    TWILIO_ACCOUNT_SID: workerEnvironment.TWILIO_ACCOUNT_SID || localEnvironment.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: workerEnvironment.TWILIO_AUTH_TOKEN || localEnvironment.TWILIO_AUTH_TOKEN,
    TWILIO_MESSAGING_SERVICE_SID: workerEnvironment.TWILIO_MESSAGING_SERVICE_SID || localEnvironment.TWILIO_MESSAGING_SERVICE_SID,
    TWILIO_FROM_NUMBER: workerEnvironment.TWILIO_FROM_NUMBER || localEnvironment.TWILIO_FROM_NUMBER,
  };
}

export function getSmsConfigurationStatus(): SmsConfigurationStatus {
  const configuration = smsEnvironment();
  const missing: string[] = [];
  if (!configuration.TWILIO_ACCOUNT_SID?.trim()) missing.push("Twilio Account SID");
  if (!configuration.TWILIO_AUTH_TOKEN?.trim()) missing.push("Twilio Auth Token");
  if (!configuration.TWILIO_MESSAGING_SERVICE_SID?.trim() && !configuration.TWILIO_FROM_NUMBER?.trim()) {
    missing.push("Twilio Messaging Service SID or sender number");
  }
  return {
    provider: "Twilio",
    configured: missing.length === 0,
    accountConnected: Boolean(configuration.TWILIO_ACCOUNT_SID?.trim() && configuration.TWILIO_AUTH_TOKEN?.trim()),
    senderConnected: Boolean(configuration.TWILIO_MESSAGING_SERVICE_SID?.trim() || configuration.TWILIO_FROM_NUMBER?.trim()),
    missing,
  };
}

export function normalizePhoneNumber(value: string) {
  const input = value.trim();
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  const normalized = input.startsWith("+")
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : "";
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Enter a valid mobile number, including the country code when outside the U.S.");
  }
  return normalized;
}

export function invitationSmsMessage(guestName: string, eventName: string, inviteUrl: string) {
  return `Hi ${guestName}, you're invited to ${eventName}! View your invitation and RSVP: ${inviteUrl} Reply STOP to opt out.`;
}

export async function sendSmsMessage({ to, body }: { to: string; body: string }) {
  const configuration = smsEnvironment();
  const status = getSmsConfigurationStatus();
  if (!status.configured) {
    throw new Error(`SMS is not connected yet. Missing: ${status.missing.join(", ")}.`);
  }

  const accountSid = configuration.TWILIO_ACCOUNT_SID!.trim();
  const authToken = configuration.TWILIO_AUTH_TOKEN!.trim();
  const form = new URLSearchParams({ To: normalizePhoneNumber(to), Body: body });
  if (configuration.TWILIO_MESSAGING_SERVICE_SID?.trim()) {
    form.set("MessagingServiceSid", configuration.TWILIO_MESSAGING_SERVICE_SID.trim());
  } else {
    form.set("From", normalizePhoneNumber(configuration.TWILIO_FROM_NUMBER || ""));
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: form,
  });
  const result = await response.json() as { sid?: string; status?: string; message?: string };
  if (!response.ok || !result.sid) throw new Error(result.message || "Twilio could not send this message.");
  return { messageId: result.sid, status: result.status || "queued" };
}
