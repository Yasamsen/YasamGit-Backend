const crypto = require("crypto");

const {
  method,
  body,
  json
} = require("../lib/response");

const {
  createSession,
  sessionCookie
} = require("../lib/auth");

module.exports = async function handler(req, res) {

  // Hanya menerima POST
  if (!method(req, res, ["POST"])) {
    return;
  }

  // Pastikan ADMIN_PASSWORD tersedia
  if (!process.env.ADMIN_PASSWORD) {
    return json(req, res, 500, {
      ok: false,
      error: "ADMIN_PASSWORD belum dikonfigurasi."
    });
  }

  // Pastikan SESSION_SECRET tersedia
  if (!process.env.SESSION_SECRET) {
    return json(req, res, 500, {
      ok: false,
      error: "SESSION_SECRET belum dikonfigurasi."
    });
  }

  try {

    // Ambil request body
    const data = await body(req);

    const password =
      String(data.password || "");

    // Password kosong
    if (!password) {
      return json(req, res, 400, {
        ok: false,
        error: "Password wajib diisi."
      });
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

    /*
     * Timing-safe comparison
     */
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

    // Password salah
    if (!valid) {
      return json(req, res, 401, {
        ok: false,
        error: "Password salah."
      });
    }

    /*
     * Password benar.
     * Buat session baru.
     */
    const token =
      createSession();

    /*
     * Session disimpan sebagai
     * HttpOnly Secure Cookie.
     */
    res.setHeader(
      "Set-Cookie",
      sessionCookie(token)
    );

    return json(req, res, 200, {
      ok: true,
      message: "Login berhasil.",
      expiresIn: 86400
    });

  } catch (error) {

    console.error(
      "LOGIN_ERROR:",
      error
    );

    return json(req, res, 500, {
      ok: false,
      error: "Terjadi kesalahan pada server."
    });
  }
};