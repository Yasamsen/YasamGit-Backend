const {
  method,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  listFiles
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const repo = req.query.repo;
    const path = req.query.path || "";
    const ref = req.query.ref || "";

    if (!repo) {
      return json(req, res, 400, {
        ok: false,
        error: "Parameter repo wajib diisi."
      });
    }

    const files = await listFiles(
      repo,
      path,
      ref
    );

    return json(req, res, 200, {
      ok: true,
      repo,
      path,
      files
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};