const {
  method,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github
} = require("../../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const result =
      await github("/user");

    json(
      res,
      result.response.status,
      result.data
    );
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: error.message
    });
  }
};