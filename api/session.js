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

    try {

      const authenticated =
        isAuthenticated(req);

      return json(
        req,
        res,
        200,
        {
          ok: true,
          authenticated
        }
      );

    } catch (error) {

      console.error(
        "SESSION_ERROR:",
        error
      );

      return json(
        req,
        res,
        500,
        {
          ok: false,
          authenticated:
            false,
          error:
            "Gagal memeriksa session."
        }
      );
    }
  };