const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  upsertFile
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo) {
      return json(req, res, 400, {
        ok: false,
        error: "repo wajib diisi."
      });
    }

    if (!data.path) {
      return json(req, res, 400, {
        ok: false,
        error: "path wajib diisi."
      });
    }

    if (data.content === undefined) {
      return json(req, res, 400, {
        ok: false,
        error: "content wajib diisi."
      });
    }

    const result = await upsertFile(
      data.repo,
      data.path,
      data.content,
      data.message ||
        `Upload ${data.path}`,
      data.sha,
      data.encoding || "base64",
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