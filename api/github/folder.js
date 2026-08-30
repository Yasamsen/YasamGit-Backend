const {
  method,
  body,
  json
} = require("../../lib/response");

const {
  requireAuth
} = require("../../lib/auth");

const {
  github,
  contentsPath
} = require("../../lib/github");

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const data =
      await body(req);

    const owner =
      String(data.owner || "");

    const repo =
      String(data.repo || "");

    const folder =
      String(data.folder || "")
        .replace(
          /^\/+|\/+$/g,
          ""
        );

    if (
      !owner ||
      !repo ||
      !folder
    ) {
      return json(res, 400, {
        ok: false,
        error:
          "owner, repo dan folder wajib."
      });
    }

    const path =
      `${folder}/.gitkeep`;

    const result =
      await github(
        contentsPath(
          owner,
          repo,
          path
        ),
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              message:
                String(
                  data.message ||
                  `Create folder ${folder}`
                ),

              content: "",

              ...(data.branch
                ? {
                    branch:
                      String(
                        data.branch
                      )
                  }
                : {})
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