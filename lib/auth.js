const crypto = require("crypto");

const COOKIE_NAME =
  "yasamgit_session";

const SESSION_SECONDS =
  86400;

function parseCookies(req) {
  const header =
    req.headers.cookie || "";

  const result = {};

  for (
    const part of header.split(";")
  ) {
    const index =
      part.indexOf("=");

    if (index === -1) continue;

    const key =
      part.slice(0, index).trim();

    const value =
      part.slice(index + 1).trim();

    try {
      result[key] =
        decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

function sign(value) {
  const secret =
    process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET belum dikonfigurasi."
    );
  }

  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(value)
    .digest("base64url");
}

function createSession() {
  const now =
    Date.now();

  const payload = {
    iat: now,
    exp:
      now +
      SESSION_SECONDS *
      1000,
    nonce:
      crypto
        .randomBytes(16)
        .toString("hex")
  };

  const encoded =
    Buffer
      .from(
        JSON.stringify(payload)
      )
      .toString("base64url");

  const signature =
    sign(encoded);

  return (
    encoded +
    "." +
    signature
  );
}

function verifySession(token) {
  if (!token) {
    return false;
  }

  const parts =
    token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [
    encoded,
    signature
  ] = parts;

  try {
    const expected =
      sign(encoded);

    const a =
      Buffer.from(signature);

    const b =
      Buffer.from(expected);

    if (
      a.length !== b.length
    ) {
      return false;
    }

    if (
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return false;
    }

    const payload =
      JSON.parse(
        Buffer
          .from(
            encoded,
            "base64url"
          )
          .toString("utf8")
      );

    return (
      payload.exp &&
      payload.exp > Date.now()
    );

  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies =
    parseCookies(req);

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

module.exports = {
  createSession,
  isAuthenticated,
  sessionCookie,
  clearSessionCookie
};