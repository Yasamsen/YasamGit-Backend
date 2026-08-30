const {
  method,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github,
  contentsPath
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

  const path =
    req.query?.path;

  const ref =
    req.query?.ref;

  if (
    !owner ||
    !repo ||
    !path
  ) {
    return json(res, 400, {
      ok: false,
      error:
        "owner, repo dan path wajib."
    });
  }

  let endpoint =
    contentsPath(
      owner,
      repo,
      path
    );

  if (ref) {
    endpoint +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  try {
    const result =
      await github(endpoint);

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