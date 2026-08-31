const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  upsertFile,
  cleanPath
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo || !data.path) {
      return json(req, res, 400, {
        ok: false,
        error: "repo dan path wajib diisi."
      });
    }

    let path = cleanPath(data.path);

    if (!path.endsWith(".gitkeep")) {
      path += "/.gitkeep";
    }

    const result = await upsertFile(
      data.repo,
      path,
      data.content || "",
      data.message ||
        `Create folder ${data.path}`,
      undefined,
      "utf8",
      data.branch || ""
    );

    return json(req, res, 201, {
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