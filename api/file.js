const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  getFile,
  putFile,
  deleteFile,
  getContents
} = require("../lib/github");

function decodeGitHubContent(
  content
) {
  return Buffer
    .from(
      String(content || "")
        .replace(/\s/g, ""),
      "base64"
    )
    .toString("utf8");
}

function mimeType(
  path
) {
  const ext =
    String(path)
      .split(".")
      .pop()
      .toLowerCase();

  const map = {
    txt:
      "text/plain",
    html:
      "text/html",
    css:
      "text/css",
    js:
      "text/javascript",
    json:
      "application/json",
    xml:
      "application/xml",
    csv:
      "text/csv",
    md:
      "text/markdown",

    jpg:
      "image/jpeg",
    jpeg:
      "image/jpeg",
    png:
      "image/png",
    gif:
      "image/gif",
    webp:
      "image/webp",
    svg:
      "image/svg+xml",

    mp4:
      "video/mp4",
    webm:
      "video/webm",

    pdf:
      "application/pdf"
  };

  return (
    map[ext] ||
    "application/octet-stream"
  );
}

function base64FromInput(
  content,
  encoding
) {
  if (
    encoding ===
    "base64"
  ) {
    return String(
      content || ""
    )
      .replace(/\s/g, "");
  }

  return Buffer
    .from(
      String(
        content || ""
      ),
      "utf8"
    )
    .toString("base64");
}

module.exports =
  async function handler(
    req,
    res
  ) {

    if (
      !method(
        req,
        res,
        ["GET", "POST"]
      )
    ) {
      return;
    }

    if (
      !requireAuth(
        req,
        res
      )
    ) {
      return;
    }

    try {

      /* =========================
         GET
      ========================= */

      if (
        req.method ===
        "GET"
      ) {

        const action =
          String(
            req.query?.action ||
            ""
          );

        const repo =
          String(
            req.query?.repo ||
            ""
          );

        const path =
          String(
            req.query?.path ||
            ""
          );

        if (!repo) {
          return json(
            req,
            res,
            400,
            {
              ok: false,
              error:
                "repo wajib diisi."
            }
          );
        }

        if (
          action ===
          "list"
        ) {

          const contents =
            await getContents(
              repo,
              path
            );

          return json(
            req,
            res,
            200,
            {
              ok: true,
              files:
                Array.isArray(
                  contents
                )
                  ? contents
                  : [contents]
            }
          );
        }

        if (
          action ===
          "read"
        ) {

          if (!path) {
            return json(
              req,
              res,
              400,
              {
                ok: false,
                error:
                  "path wajib diisi."
              }
            );
          }

          const file =
            await getFile(
              repo,
              path
            );

          const content =
            decodeGitHubContent(
              file.content
            );

          const binary =
            Buffer.from(
              String(
                file.content ||
                ""
              ).replace(
                /\s/g,
                ""
              ),
              "base64"
            );

          const mime =
            mimeType(path);

          const isBinary =
            mime.startsWith(
              "image/"
            ) ||
            mime.startsWith(
              "video/"
            ) ||
            mime ===
              "application/pdf";

          return json(
            req,
            res,
            200,
            {
              ok: true,
              name:
                file.name,
              path:
                file.path,
              sha:
                file.sha,
              size:
                file.size,
              content:
                isBinary
                  ? null
                  : content,
              dataUrl:
                isBinary
                  ? `data:${mime};base64,${binary.toString("base64")}`
                  : null,
              downloadUrl:
                file.download_url
            }
          );
        }

        if (
          action ===
          "download"
        ) {

          const file =
            await getFile(
              repo,
              path
            );

          const buffer =
            Buffer.from(
              String(
                file.content ||
                ""
              ).replace(
                /\s/g,
                ""
              ),
              "base64"
            );

          res.statusCode =
            200;

          res.setHeader(
            "Content-Type",
            mimeType(path)
          );

          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${String(file.name).replace(/"/g, "")}"`
          );

          res.end(buffer);

          return;
        }

        return json(
          req,
          res,
          400,
          {
            ok: false,
            error:
              "Action GET tidak valid."
          }
        );
      }


      /* =========================
         POST
      ========================= */

      const data =
        await body(req);

      const action =
        String(
          data.action ||
          ""
        );

      const repo =
        String(
          data.repo ||
          ""
        );

      if (!repo) {
        return json(
          req,
          res,
          400,
          {
            ok: false,
            error:
              "repo wajib diisi."
          }
        );
      }


      /* =========================
         UPLOAD / OVERWRITE
      ========================= */

      if (
        action ===
          "upload" ||
        action ===
          "overwrite"
      ) {

        const path =
          String(
            data.path ||
            ""
          );

        if (!path) {
          return json(
            req,
            res,
            400,
            {
              ok: false,
              error:
                "path wajib diisi."
            }
          );
        }

        const encoded =
          base64FromInput(
            data.content,
            data.encoding
          );

        const result =
          await putFile(
            repo,
            path,
            encoded,
            data.message ||
              `Upload ${path}`,
            data.sha
          );

        return json(
          req,
          res,
          200,
          {
            ok: true,
            action:
              data.sha
                ? "overwrite"
                : "upload",
            file:
              result.content,
            commit:
              result.commit
          }
        );
      }


      /* =========================
         RENAME
      ========================= */

      if (
        action ===
        "rename"
      ) {

        const oldPath =
          String(
            data.oldPath ||
            ""
          );

        const newPath =
          String(
            data.newPath ||
            ""
          );

        if (
          !oldPath ||
          !newPath
        ) {
          return json(
            req,
            res,
            400,
            {
              ok: false,
              error:
                "oldPath dan newPath wajib diisi."
            }
          );
        }

        const oldFile =
          await getFile(
            repo,
            oldPath
          );

        const encoded =
          String(
            oldFile.content ||
            ""
          )
            .replace(
              /\s/g,
              ""
            );

        await putFile(
          repo,
          newPath,
          encoded,
          data.message ||
            `Rename ${oldPath} to ${newPath}`
        );

        await deleteFile(
          repo,
          oldPath,
          oldFile.sha,
          data.message ||
            `Delete old path ${oldPath}`
        );

        return json(
          req,
          res,
          200,
          {
            ok: true,
            message:
              "Rename berhasil.",
            oldPath,
            newPath
          }
        );
      }


      /* =========================
         DELETE
      ========================= */

      if (
        action ===
        "delete"
      ) {

        const path =
          String(
            data.path ||
            ""
          );

        if (!path) {
          return json(
            req,
            res,
            400,
            {
              ok: false,
              error:
                "path wajib diisi."
            }
          );
        }

        let sha =
          data.sha;

        if (!sha) {

          const file =
            await getFile(
              repo,
              path
            );

          sha =
            file.sha;
        }

        const result =
          await deleteFile(
            repo,
            path,
            sha,
            data.message ||
              `Delete ${path}`
          );

        return json(
          req,
          res,
          200,
          {
            ok: true,
            message:
              "Delete berhasil.",
            commit:
              result.commit
          }
        );
      }


      return json(
        req,
        res,
        400,
        {
          ok: false,
          error:
            "Action tidak valid."
        }
      );

    } catch(error) {

      console.error(
        "file.js:",
        error
      );

      return json(
        req,
        res,
        error.status || 500,
        {
          ok: false,
          error:
            error.message ||
            "File operation gagal."
        }
      );
    }
  };