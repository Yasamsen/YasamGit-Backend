const {
  method,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  getFile
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const repo = req.query.repo;
    const path = req.query.path;
    const ref = req.query.ref || "";

    if (!repo || !path) {
      return json(req, res, 400, {
        ok: false,
        error: "repo dan path wajib diisi."
      });
    }

    const file = await getFile(
      repo,
      path,
      ref
    );

    const buffer = Buffer.from(
      String(file.content || "")
        .replace(/\n/g, ""),
      "base64"
    );

    const filename =
      String(path)
        .split("/")
        .pop()
        .replace(/"/g, "");

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.end(buffer);

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};