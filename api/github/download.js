const {
  method,
  applyCors,
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
  if (!method(req, res, ["GET"])) {
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  const owner =
    req.query?.owner;

  const repo =
    req.query?.repo;

  const path =
    req.query?.path;

  if (
    !owner ||
    !repo ||
    !path
  ) {
    return json(res, 400, {
      ok: false,
      error:
        "owner, repo dan path wajib."
    });
  }

  try {
    const result =
      await github(
        contentsPath(
          owner,
          repo,
          path
        )
      );

    if (!result.response.ok) {
      return json(
        res,
        result.response.status,
        result.data
      );
    }

    const file =
      result.data;

    if (file.content) {
      const buffer =
        Buffer.from(
          String(
            file.content
          ).replace(
            /\s+/g,
            ""
          ),
          "base64"
        );

      applyCors(res);

      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(
          path.split("/").pop()
        )}"`
      );

      res.setHeader(
        "Content-Length",
        buffer.length
      );

      return res.end(buffer);
    }

    if (file.download_url) {
      const remote =
        await fetch(
          file.download_url
        );

      if (!remote.ok) {
        return json(res, 502, {
          ok: false,
          error:
            "Gagal mengambil file dari GitHub."
        });
      }

      const buffer =
        Buffer.from(
          await remote.arrayBuffer()
        );

      applyCors(res);

      res.statusCode =
        remote.status;

      res.setHeader(
        "Content-Type",
        remote.headers.get(
          "content-type"
        ) ||
        "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(
          path.split("/").pop()
        )}"`
      );

      res.setHeader(
        "Content-Length",
        buffer.length
      );

      return res.end(buffer);
    }

    return json(res, 404, {
      ok: false,
      error:
        "File tidak memiliki content/download URL."
    });

  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error.message
    });
  }
};