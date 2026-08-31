const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  createRepo
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const data = await body(req);

    if (!data.name) {
      return json(req, res, 400, {
        ok: false,
        error: "Nama repository wajib diisi."
      });
    }

    const repo = await createRepo(
      data.name,
      data.description || "",
      Boolean(data.private)
    );

    return json(req, res, 201, {
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