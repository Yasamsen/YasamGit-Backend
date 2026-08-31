const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  deleteRepo
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["DELETE"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.repo) {
      return json(req, res, 400, {
        ok: false,
        error: "repo wajib diisi."
      });
    }

    await deleteRepo(data.repo);

    return json(req, res, 200, {
      ok: true,
      message: "Repository berhasil dihapus."
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};