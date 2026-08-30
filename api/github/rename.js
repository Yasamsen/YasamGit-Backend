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

    const oldPath =
      String(data.oldPath || "");

    const newPath =
      String(data.newPath || "");

    if (
      !owner ||
      !repo ||
      !oldPath ||
      !newPath
    ) {
      return json(res, 400, {
        ok: false,
        error:
          "owner, repo, oldPath dan newPath wajib."
      });
    }

    /*
     * Ambil file lama.
     */

    const old =
      await github(
        contentsPath(
          owner,
          repo,
          oldPath
        )
      );

    if (!old.response.ok) {
      return json(
        res,
        old.response.status,
        old.data
      );
    }

    if (
      old.data.type !== "file"
    ) {
      return json(res, 400, {
        ok: false,
        error:
          "Rename endpoint ini digunakan untuk file."
      });
    }

    let content =
      String(
        old.data.content || ""
      );

    content =
      content.replace(/\s+/g, "");

    /*
     * Buat file dengan nama baru.
     */

    const created =
      await github(
        contentsPath(
          owner,
          repo,
          newPath
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
                  `Rename ${oldPath} to ${newPath}`
                ),

              content,

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

    if (!created.response.ok) {
      return json(
        res,
        created.response.status,
        created.data
      );
    }

    /*
     * Hapus nama lama.
     */

    const deleted =
      await github(
        contentsPath(
          owner,
          repo,
          oldPath
        ),
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              message:
                `Remove old name ${oldPath}`,

              sha:
                old.data.sha,

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

    if (!deleted.response.ok) {
      return json(res, 500, {
        ok: false,
        error:
          "File baru berhasil dibuat tetapi file lama gagal dihapus.",
        created:
          created.data,
        deleteError:
          deleted.data
      });
    }

    json(res, 200, {
      ok: true,
      message:
        "Rename berhasil.",
      result:
        created.data
    });

  } catch (error) {
    json(res, 500, {
      ok: false,
      error: error.message
    });
  }
};