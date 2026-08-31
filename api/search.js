const {
  method,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  search
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const q = req.query.q || "";
    const type = req.query.type || "code";

    if (!q) {
      return json(req, res, 400, {
        ok: false,
        error: "Parameter q wajib diisi."
      });
    }

    const result = await search(
      q,
      type
    );

    return json(req, res, 200, {
      ok: true,
      type,
      result
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};