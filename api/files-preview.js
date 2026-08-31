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

    const raw = Buffer.from(
      String(file.content || "")
        .replace(/\n/g, ""),
      "base64"
    );

    const extension =
      String(path)
        .split(".")
        .pop()
        .toLowerCase();

    const images = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml"
    };

    if (images[extension]) {
      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        images[extension]
      );

      return res.end(raw);
    }

    return json(req, res, 200, {
      ok: true,
      name: file.name,
      path: file.path,
      sha: file.sha,
      size: file.size,
      content: raw.toString("utf8")
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};