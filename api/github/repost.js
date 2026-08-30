const {
  method,
  body,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github
} = require("../../lib/github");

module.exports = async function handler(req, res) {
  if (
    !method(
      req,
      res,
      ["GET", "POST"]
    )
  ) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    if (req.method === "GET") {
      const page =
        Number(
          req.query?.page || 1
        );

      const perPage =
        Math.min(
          Number(
            req.query?.per_page || 100
          ),
          100
        );

      const result =
        await github(
          `/user/repos?` +
          `page=${page}&` +
          `per_page=${perPage}&` +
          `sort=updated`
        );

      return json(
        res,
        result.response.status,
        result.data
      );
    }

    const data =
      await body(req);

    const name =
      String(
        data.name || ""
      ).trim();

    if (!name) {
      return json(res, 400, {
        ok: false,
        error:
          "Nama repository wajib."
      });
    }

    const result =
      await github(
        "/user/repos",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              name,

              description:
                String(
                  data.description || ""
                ),

              private:
                Boolean(data.private),

              auto_init: true
            })
        }
      );

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