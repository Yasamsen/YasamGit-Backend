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

    const path =
      String(data.path || "");

    const sha =
      String(data.sha || "");

    if (
      !owner ||
      !repo ||
      !path ||
      !sha
    ) {
      return json(res, 400, {
        ok: false,
        error:
          "owner, repo, path dan sha wajib."
      });
    }

    const payload = {
      message:
        String(
          data.message ||
          `Delete ${path}`
        ),

      sha
    };

    if (data.branch) {
      payload.branch =
        String(data.branch);
    }

    const result =
      await github(
        contentsPath(
          owner,
          repo,
          path
        ),
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
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