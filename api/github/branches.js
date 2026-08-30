const {
  method,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github,
  repoPath
} = require("../../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  const owner =
    req.query?.owner;

  const repo =
    req.query?.repo;

  if (!owner || !repo) {
    return json(res, 400, {
      ok: false,
      error:
        "owner dan repo wajib."
    });
  }

  try {
    const result =
      await github(
        `${repoPath(
          owner,
          repo
        )}/branches?per_page=100`
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