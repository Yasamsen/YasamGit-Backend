const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  renameRepo
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo || !data.newName) {
      return json(req, res, 400, {
        ok: false,
        error: "repo dan newName wajib diisi."
      });
    }

    const repo = await renameRepo(
      data.repo,
      data.newName
    );

    return json(req, res, 200, {
      ok: true,
      repo
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};