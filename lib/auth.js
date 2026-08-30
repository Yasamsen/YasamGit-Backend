const crypto = require("crypto");

const COOKIE_NAME = "yasamgit_session";
const SESSION_SECONDS = 86400;

function getSecret() {
  return process.env.SESSION_SECRET || "";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) continue;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

function sign(value) {
  const secret = getSecret();

  if (!secret) {
    throw new Error("SESSION_SECRET belum dikonfigurasi.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function createSession() {
  const now = Date.now();

  const payload = {
    iat: now,
    exp: now + SESSION_SECONDS * 1000,
    nonce: crypto.randomBytes(24).toString("hex")
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function verifySession(token) {
  if (!token || !getSecret()) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [encoded, signature] = parts;

  let expected;

  try {
    expected = sign(encoded);
  } catch {
    return false;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (!payload.exp) {
      return false;
    }

    if (Number(payload.exp) <= Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);

  return verifySession(
    cookies[COOKIE_NAME]
  );
}

function sessionCookie(token) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SESSION_SECONDS}`
  ].join("; ");
}

function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

function requireAuth(req, res) {
  const { json } = require("./response");

  if (!getSecret()) {
    json(req, res, 500, {
      ok: false,
      error: "SESSION_SECRET belum dikonfigurasi."
    });

    return false;
  }

  if (!isAuthenticated(req)) {
    json(req, res, 401, {
      ok: false,
      error: "Belum login atau session sudah expired."
    });

    return false;
  }

  return true;
}

module.exports = {
  createSession,
  verifySession,
  isAuthenticated,
  sessionCookie,
  clearSessionCookie,
  requireAuth
};