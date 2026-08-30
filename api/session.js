const {
  method,
  json
} = require("../lib/response");

const {
  isAuthenticated
} = require("../lib/auth");

module.exports =
  function handler(
    req,
    res
  ) {

    if (
      !method(
        req,
        res,
        ["GET"]
      )
    ) {
      return;
    }

    return json(
      req,
      res,
      200,
      {
        ok: true,
        authenticated:
          isAuthenticated(req)
      }
    );
  };