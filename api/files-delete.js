const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  deleteFile
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["DELETE"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo || !data.path) {
      return json(req, res, 400, {
        ok: false,
        error: "repo dan path wajib diisi."
      });
    }

    const result = await deleteFile(
      data.repo,
      data.path,
      data.sha,
      data.message,
      data.branch || ""
    );

    return json(req, res, 200, {
      ok: true,
      result
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};