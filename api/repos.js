const {
  method,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  listRepos
} = require("../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;

  if (!requireAuth(req, res)) return;

  try {
    const repos = await listRepos();

    return json(req, res, 200, {
      ok: true,
      repos
    });

  } catch (error) {
    return json(req, res, error.status || 500, {
      ok: false,
      error: error.message
    });
  }
};