const {
  method,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github
} = require("../../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  const q =
    String(
      req.query?.q || ""
    ).trim();

  if (!q) {
    return json(res, 400, {
      ok: false,
      error:
        "q wajib diisi."
    });
  }

  try {
    const user =
      await github("/user");

    if (!user.response.ok) {
      return json(
        res,
        user.response.status,
        user.data
      );
    }

    const username =
      user.data.login;

    const result =
      await github(
        `/search/repositories?` +
        `q=${encodeURIComponent(
          q
        )}` +
        `+user:${encodeURIComponent(
          username
        )}`
      );

    json(
      res,
      result.response.status,
      result.data
    );
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: error.message
    });
  }
};