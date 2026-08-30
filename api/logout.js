const {
  method,
  json
} = require("../lib/response");

const {
  clearSessionCookie
} = require("../lib/auth");

module.exports = function handler(req, res) {
  if (!method(req, res, ["POST"])) {
    return;
  }

  res.setHeader(
    "Set-Cookie",
    clearSessionCookie()
  );

  json(res, 200, {
    ok: true,
    message:
      "Logout berhasil."
  });
};