import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getD1 } from "@/db/invitations";

const DEFAULT_OWNER_EMAIL = "gamingboi567@gmail.com";
const ADMIN_DISPLAY_NAME = "Daryel";
const SESSION_COOKIE = "invitez_admin_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 210_000;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

type RuntimeEnvironment = {
  ADMIN_EMAILS?: string;
  ADMIN_SETUP_TOKEN?: string;
};

export type AdminUser = {
  displayName: string;
  email: string;
};

export type AdminAccess = {
  user: AdminUser | null;
  authorized: boolean;
};

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

function runtimeEnvironment() {
  const workerEnvironment = env as unknown as RuntimeEnvironment;
  const localEnvironment = typeof process !== "undefined" ? process.env : {};
  return {
    ADMIN_EMAILS: workerEnvironment.ADMIN_EMAILS || localEnvironment.ADMIN_EMAILS,
    ADMIN_SETUP_TOKEN: workerEnvironment.ADMIN_SETUP_TOKEN || localEnvironment.ADMIN_SETUP_TOKEN,
  };
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function allowedEmails() {
  const configured = runtimeEnvironment().ADMIN_EMAILS;
  return (configured || DEFAULT_OWNER_EMAIL)
    .split(",")
    .map(normalizedEmail)
    .filter(Boolean);
}

export function getAdminOwnerEmail() {
  return allowedEmails()[0] || DEFAULT_OWNER_EMAIL;
}

function isAllowedEmail(email: string) {
  return allowedEmails().includes(normalizedEmail(email));
}

export async function ensureAdminAuthSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_credentials (
      email TEXT PRIMARY KEY NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS admin_sessions_email_idx ON admin_sessions (email)"),
    db.prepare("CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS admin_login_attempts (
      email TEXT PRIMARY KEY NOT NULL,
      failed_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      updated_at TEXT NOT NULL
    )`),
  ]);
}

export async function isAdminPasswordConfigured() {
  await ensureAdminAuthSchema();
  const row = await getD1()
    .prepare("SELECT email FROM admin_credentials WHERE email = ? LIMIT 1")
    .bind(getAdminOwnerEmail())
    .first<{ email: string }>();
  return Boolean(row);
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function secretsMatch(left: string, right: string) {
  if (!left || !right) return false;
  const [leftDigest, rightDigest] = await Promise.all([sha256(left), sha256(right)]);
  return constantTimeEqual(leftDigest, rightDigest);
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validatePassword(password: string) {
  if (password.length < 8) throw new AdminAuthError("Use at least 8 characters for your password.");
  if (password.length > 128) throw new AdminAuthError("Your password must be 128 characters or fewer.");
}

export async function createInitialAdminPassword(input: {
  email: string;
  password: string;
  setupToken: string;
}) {
  const email = normalizedEmail(input.email);
  if (!isAllowedEmail(email)) throw new AdminAuthError("This email cannot manage this invitation.", 403);
  validatePassword(input.password);

  const configuredToken = runtimeEnvironment().ADMIN_SETUP_TOKEN || "";
  if (!(await secretsMatch(input.setupToken, configuredToken))) {
    throw new AdminAuthError("This private setup link is invalid or has expired.", 403);
  }

  await ensureAdminAuthSchema();
  if (await isAdminPasswordConfigured()) {
    throw new AdminAuthError("Your password is already set. Sign in instead.", 409);
  }

  const salt = randomBytes(16);
  const passwordHash = await derivePassword(input.password, salt, PASSWORD_ITERATIONS);
  const now = new Date().toISOString();

  try {
    await getD1().prepare(`INSERT INTO admin_credentials (
      email, password_salt, password_hash, password_iterations, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(
        email,
        bytesToBase64Url(salt),
        bytesToBase64Url(passwordHash),
        PASSWORD_ITERATIONS,
        now,
        now,
      )
      .run();
  } catch {
    throw new AdminAuthError("Your password is already set. Sign in instead.", 409);
  }

  return { displayName: ADMIN_DISPLAY_NAME, email } satisfies AdminUser;
}

async function loginAttempt(email: string) {
  await ensureAdminAuthSchema();
  return getD1().prepare(`SELECT failed_count, locked_until
    FROM admin_login_attempts WHERE email = ?`)
    .bind(email)
    .first<{ failed_count: number; locked_until: string | null }>();
}

async function recordLoginFailure(email: string) {
  const current = await loginAttempt(email);
  const now = new Date();
  const currentLock = current?.locked_until ? new Date(current.locked_until) : null;
  if (currentLock && currentLock > now) return currentLock;

  const failedCount = (current?.failed_count || 0) + 1;
  const lockedUntil = failedCount >= MAX_FAILED_LOGINS
    ? new Date(now.getTime() + LOGIN_LOCK_SECONDS * 1000)
    : null;
  await getD1().prepare(`INSERT INTO admin_login_attempts (
    email, failed_count, locked_until, updated_at
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET
    failed_count = excluded.failed_count,
    locked_until = excluded.locked_until,
    updated_at = excluded.updated_at`)
    .bind(email, failedCount, lockedUntil?.toISOString() || null, now.toISOString())
    .run();
  return lockedUntil;
}

async function clearLoginFailures(email: string) {
  await getD1().prepare("DELETE FROM admin_login_attempts WHERE email = ?").bind(email).run();
}

export async function authenticateAdmin(emailInput: string, password: string) {
  const email = normalizedEmail(emailInput);
  if (!isAllowedEmail(email)) throw new AdminAuthError("The email or password is incorrect.", 401);
  if (password.length > 128) throw new AdminAuthError("The email or password is incorrect.", 401);

  const attempt = await loginAttempt(email);
  const now = new Date();
  if (attempt?.locked_until && new Date(attempt.locked_until) > now) {
    throw new AdminAuthError("Too many attempts. Try again in 15 minutes.", 429);
  }

  const credential = await getD1().prepare(`SELECT
    password_salt, password_hash, password_iterations
    FROM admin_credentials WHERE email = ?`)
    .bind(email)
    .first<{ password_salt: string; password_hash: string; password_iterations: number }>();

  if (!credential) throw new AdminAuthError("Your password has not been set up yet.", 409);

  let passwordMatches = false;
  try {
    const candidate = await derivePassword(
      password,
      base64UrlToBytes(credential.password_salt),
      credential.password_iterations,
    );
    passwordMatches = constantTimeEqual(candidate, base64UrlToBytes(credential.password_hash));
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    const lockedUntil = await recordLoginFailure(email);
    if (lockedUntil) throw new AdminAuthError("Too many attempts. Try again in 15 minutes.", 429);
    throw new AdminAuthError("The email or password is incorrect.", 401);
  }

  await clearLoginFailures(email);
  return { displayName: ADMIN_DISPLAY_NAME, email } satisfies AdminUser;
}

export async function createAdminSession(emailInput: string) {
  await ensureAdminAuthSchema();
  const email = normalizedEmail(emailInput);
  const token = bytesToBase64Url(randomBytes(32));
  const tokenHash = bytesToBase64Url(await sha256(token));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").bind(createdAt.toISOString()),
    db.prepare(`INSERT INTO admin_sessions (token_hash, email, expires_at, created_at)
      VALUES (?, ?, ?, ?)`)
      .bind(tokenHash, email, expiresAt.toISOString(), createdAt.toISOString()),
  ]);
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean) {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; Max-Age=${SESSION_LIFETIME_SECONDS}${secureAttribute}`;
}

export function clearSessionCookie(secure: boolean) {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secureAttribute}`;
}

export function requestIsSecure(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

export function sessionTokenFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === SESSION_COOKIE) return part.slice(separator + 1).trim();
  }
  return "";
}

export async function revokeAdminSession(token: string) {
  if (!token) return;
  await ensureAdminAuthSchema();
  const tokenHash = bytesToBase64Url(await sha256(token));
  await getD1().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

async function adminUserForSession(token: string): Promise<AdminUser | null> {
  if (!token) return null;
  await ensureAdminAuthSchema();
  const tokenHash = bytesToBase64Url(await sha256(token));
  const row = await getD1().prepare(`SELECT email FROM admin_sessions
    WHERE token_hash = ? AND expires_at > ? LIMIT 1`)
    .bind(tokenHash, new Date().toISOString())
    .first<{ email: string }>();
  if (!row || !isAllowedEmail(row.email)) return null;
  return { displayName: ADMIN_DISPLAY_NAME, email: row.email };
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const requestHeaders = await headers();
  const token = sessionTokenFromCookie(requestHeaders.get("cookie"));
  const user = await adminUserForSession(token);
  return { user, authorized: Boolean(user) };
}

export async function requireAdminApi() {
  const access = await getAdminAccess();
  if (!access.user) {
    return {
      access,
      response: Response.json(
        { error: "Sign in required" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { access, response: null };
}
