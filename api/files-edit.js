const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  getFile,
  upsertFile
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["PUT"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo || !data.path) {
      return json(req, res, 400, {
        ok: false,
        error: "repo dan path wajib diisi."
      });
    }

    if (data.content === undefined) {
      return json(req, res, 400, {
        ok: false,
        error: "content wajib diisi."
      });
    }

    const current = await getFile(
      data.repo,
      data.path,
      data.ref || ""
    );

    const result = await upsertFile(
      data.repo,
      data.path,
      data.content,
      data.message ||
        `Edit ${data.path}`,
      data.sha || current.sha,
      "utf8",
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