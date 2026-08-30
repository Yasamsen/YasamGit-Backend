const crypto = require("crypto");

const COOKIE_NAME = "yasamgit_session";
const SESSION_SECONDS = 86400;

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) continue;

    const key = part
      .slice(0, index)
      .trim();

    const value = part
      .slice(index + 1)
      .trim();

    result[key] = decodeURIComponent(value);
  }

  return result;
}

function sign(value) {
  return crypto
    .createHmac(
      "sha256",
      process.env.SESSION_SECRET
    )
    .update(value)
    .digest("base64url");
}

function createSession() {
  const payload = {
    iat: Date.now(),
    exp:
      Date.now() +
      SESSION_SECONDS * 1000,
    nonce:
      crypto.randomBytes(16).toString("hex")
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

function verifySession(token) {
  if (!token) return false;

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [encoded, signature] = parts;

  const expected = sign(encoded);

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
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    );

    if (!payload.exp) {
      return false;
    }

    if (payload.exp < Date.now()) {
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

function sessionCookie(value) {
  return (
    `${COOKIE_NAME}=${encodeURIComponent(value)}; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=None; ` +
    `Max-Age=${SESSION_SECONDS}`
  );
}

function clearSessionCookie() {
  return (
    `${COOKIE_NAME}=; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=None; ` +
    `Max-Age=0`
  );
}

function requireAuth(req, res) {
  const { json } = require("./response");

  if (!process.env.SESSION_SECRET) {
    json(res, 500, {
      ok: false,
      error:
        "SESSION_SECRET belum dikonfigurasi."
    });

    return false;
  }

  if (!isAuthenticated(req)) {
    json(res, 401, {
      ok: false,
      error:
        "Belum login atau session sudah expired."
    });

    return false;
  }

  return true;
}

module.exports = {
  createSession,
  isAuthenticated,
  sessionCookie,
  clearSessionCookie,
  requireAuth
};