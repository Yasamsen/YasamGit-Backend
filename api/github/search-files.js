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

  const owner =
    String(
      req.query?.owner || ""
    );

  const repo =
    String(
      req.query?.repo || ""
    );

  const q =
    String(
      req.query?.q || ""
    ).trim();

  if (
    !owner ||
    !repo ||
    !q
  ) {
    return json(res, 400, {
      ok: false,
      error:
        "owner, repo dan q wajib."
    });
  }

  try {
    const query =
      `${q} repo:${owner}/${repo}`;

    const result =
      await github(
        `/search/code?q=${encodeURIComponent(
          query
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