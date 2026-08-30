const {
  method,
  json
} = require("../lib/response");

const {
  isAuthenticated
} = require("../lib/auth");

module.exports = function handler(req, res) {
  if (!method(req, res, ["GET"])) {
    return;
  }

  const authenticated =
    isAuthenticated(req);

  json(res, 200, {
    ok: true,
    authenticated
  });
};