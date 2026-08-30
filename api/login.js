const crypto =
  require("crypto");

const {
  method,
  body,
  json
} = require("../lib/response");

const {
  createSession,
  sessionCookie
} = require("../lib/auth");

module.exports =
  async function handler(
    req,
    res
  ) {

    if (
      !method(
        req,
        res,
        ["POST"]
      )
    ) {
      return;
    }

    if (
      !process.env.ADMIN_PASSWORD
    ) {
      return json(
        req,
        res,
        500,
        {
          ok: false,
          error:
            "ADMIN_PASSWORD belum dikonfigurasi."
        }
      );
    }

    if (
      !process.env.SESSION_SECRET
    ) {
      return json(
        req,
        res,
        500,
        {
          ok: false,
          error:
            "SESSION_SECRET belum dikonfigurasi."
        }
      );
    }

    const data =
      await body(req);

    const password =
      String(
        data.password || ""
      );

    if (!password) {
      return json(
        req,
        res,
        400,
        {
          ok: false,
          error:
            "Password wajib diisi."
        }
      );
    }

    const input =
      Buffer.from(password);

    const saved =
      Buffer.from(
        String(
          process.env.ADMIN_PASSWORD
        )
      );

    let valid = false;

    if (
      input.length ===
      saved.length
    ) {
      valid =
        crypto.timingSafeEqual(
          input,
          saved
        );
    }

    if (!valid) {
      return json(
        req,
        res,
        401,
        {
          ok: false,
          error:
            "Password salah."
        }
      );
    }

    const token =
      createSession();

    res.setHeader(
      "Set-Cookie",
      sessionCookie(token)
    );

    return json(
      req,
      res,
      200,
      {
        ok: true,
        message:
          "Login berhasil.",
        expiresIn:
          86400
      }
    );
  };