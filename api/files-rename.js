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
  upsertFile,
  deleteFile,
  cleanPath
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (
      !data.repo ||
      !data.path ||
      !data.newPath
    ) {
      return json(req, res, 400, {
        ok: false,
        error:
          "repo, path dan newPath wajib diisi."
      });
    }

    const current = await getFile(
      data.repo,
      data.path,
      data.ref || ""
    );

    const newPath =
      cleanPath(data.newPath);

    const uploaded =
      await upsertFile(
        data.repo,
        newPath,
        current.content || "",
        data.message ||
          `Rename ${data.path} to ${newPath}`,
        undefined,
        "base64",
        data.branch || ""
      );

    await deleteFile(
      data.repo,
      data.path,
      current.sha,
      data.message ||
        `Delete old ${data.path}`,
      data.branch || ""
    );

    return json(req, res, 200, {
      ok: true,
      result: uploaded
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};