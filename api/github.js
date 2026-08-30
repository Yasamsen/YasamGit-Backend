const {
  method,
  body,
  json
} = require("../lib/response");

const {
  requireAuth
} = require("../lib/auth");

const {
  getRepositories,
  getContents,
  createRepository,
  getRepo
} = require("../lib/github");

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

      if (
        req.method ===
        "GET"
      ) {

        const type =
          String(
            req.query?.type ||
            ""
          );

        if (
          type ===
          "repos"
        ) {

          const repos =
            await getRepositories();

          return json(
            req,
            res,
            200,
            {
              ok: true,
              repositories:
                repos.map(
                  repo => ({
                    id:
                      repo.id,
                    name:
                      repo.name,
                    full_name:
                      repo.full_name,
                    private:
                      repo.private,
                    description:
                      repo.description,
                    html_url:
                      repo.html_url,
                    default_branch:
                      repo.default_branch
                  })
                )
            }
          );
        }

        if (
          type ===
          "contents"
        ) {

          const repo =
            String(
              req.query.repo ||
              ""
            );

          const path =
            String(
              req.query.path ||
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
              contents
            }
          );
        }

        if (
          type ===
          "repo"
        ) {

          const repo =
            String(
              req.query.repo ||
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

          const data =
            await getRepo(
              repo
            );

          return json(
            req,
            res,
            200,
            {
              ok: true,
              repository:
                data
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
              "type tidak valid."
          }
        );
      }


      const data =
        await body(req);

      if (
        data.action ===
        "createRepo"
      ) {

        const name =
          String(
            data.name ||
            ""
          )
          .trim();

        const description =
          String(
            data.description ||
            ""
          );

        if (!name) {
          return json(
            req,
            res,
            400,
            {
              ok: false,
              error:
                "Nama repository wajib diisi."
            }
          );
        }

        const repo =
          await createRepository(
            name,
            description
          );

        return json(
          req,
          res,
          201,
          {
            ok: true,
            repository:
              repo
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
        "github.js:",
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
            "GitHub API error."
        }
      );
    }
  };