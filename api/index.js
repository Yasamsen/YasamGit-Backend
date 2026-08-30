module.exports =
  function handler(req, res) {

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );

    res.end(
      JSON.stringify({
        ok: true,
        service:
          "YasamGit Backend",
        version:
          "5.2.0",
        status:
          "online"
      })
    );
  };