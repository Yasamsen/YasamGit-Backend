const {
  method,
  json
} = require("../lib/response");

module.exports =
  function handler(req, res) {

    if (
      !method(
        req,
        res,
        ["GET"]
      )
    ) {
      return;
    }

    json(
      req,
      res,
      200,
      {
        ok: true,
        service:
          "YasamGit Backend",
        version:
          "5.2.0",
        status:
          "online"
      }
    );
  };