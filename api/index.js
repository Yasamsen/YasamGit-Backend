const crypto = require("crypto");

const COOKIE_NAME = "yasamgit_session";
const SESSION_SECONDS = 86400;

const GITHUB_API = "https://api.github.com";

function send(res, status, data, extraHeaders = {}) {
  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }

  res.end(JSON.stringify(data));
}

function cors(req, res) {
  const origin =
    process.env.FRONTEND_ORIGIN || "*";

  res.setHeader(
    "Access-Control-Allow-Origin",
    origin
  );

  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );
}

function cookies(req) {
  const result = {};

  const header =
    req.headers.cookie || "";

  for (const item of header.split(";")) {
    const index = item.indexOf("=");

    if (index === -1) continue;

    const key =
      item.slice(0, index).trim();

    const value =
      item.slice(index + 1).trim();

    result[key] =
      decodeURIComponent(value);
  }

  return result;
}

function sign(value) {
  return crypto
    .createHmac(
      "sha256",
      String(process.env.SESSION_SECRET || "")
    )
    .update(value)
    .digest("base64url");
}

function createSession() {
  const payload = {
    iat: Date.now(),

    exp:
      Date.now() +
      SESSION_SECONDS * 1000,

    nonce:
      crypto
        .randomBytes(24)
        .toString("hex")
  };

  const encoded =
    Buffer
      .from(JSON.stringify(payload))
      .toString("base64url");

  return (
    encoded +
    "." +
    sign(encoded)
  );
}

function verifySession(token) {
  if (!token) {
    return false;
  }

  const parts =
    token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const encoded = parts[0];
  const signature = parts[1];

  const expected =
    sign(encoded);

  const a =
    Buffer.from(signature);

  const b =
    Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  if (
    !crypto.timingSafeEqual(a, b)
  ) {
    return false;
  }

  try {
    const payload =
      JSON.parse(
        Buffer
          .from(encoded, "base64url")
          .toString("utf8")
      );

    return (
      payload.exp &&
      payload.exp > Date.now()
    );

  } catch {
    return false;
  }
}

function authenticated(req) {
  const jar =
    cookies(req);

  return verifySession(
    jar[COOKIE_NAME]
  );
}

function requireAuth(req, res) {
  if (!authenticated(req)) {
    send(res, 401, {
      ok: false,
      error: "Belum login."
    });

    return false;
  }

  return true;
}

function readBody(req) {
  if (req.body !== undefined) {
    if (
      typeof req.body === "object"
    ) {
      return Promise.resolve(req.body);
    }

    try {
      return Promise.resolve(
        JSON.parse(req.body)
      );
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise(
    (resolve, reject) => {
      let raw = "";

      req.on(
        "data",
        chunk => {
          raw += chunk;
        }
      );

      req.on(
        "end",
        () => {
          if (!raw) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(raw)
            );
          } catch {
            resolve({});
          }
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

function githubHeaders() {
  return {
    Accept:
      "application/vnd.github+json",

    Authorization:
      "Bearer " +
      process.env.GITHUB_TOKEN,

    "X-GitHub-Api-Version":
      "2022-11-28",

    "User-Agent":
      "YasamGit/5.2.0"
  };
}

async function github(
  path,
  options = {}
) {
  if (
    !process.env.GITHUB_TOKEN
  ) {
    throw new Error(
      "GITHUB_TOKEN belum dikonfigurasi."
    );
  }

  const response =
    await fetch(
      GITHUB_API + path,
      {
        ...options,

        headers: {
          ...githubHeaders(),

          ...(options.headers || {})
        }
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = {
      message: text
    };
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
        `GitHub API error ${response.status}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}

function owner() {
  return (
    process.env.GITHUB_OWNER ||
    ""
  ).trim();
}

function cleanPath(value) {
  let path =
    String(value || "")
      .trim();

  path =
    path.replace(
      /^\/+/,
      ""
    );

  path =
    path.replace(
      /\/+/g,
      "/"
    );

  if (
    path === "." ||
    path === "./"
  ) {
    return "";
  }

  return path;
}

function encodePath(path) {
  return path
    .split("/")
    .map(
      encodeURIComponent
    )
    .join("/");
}

function base64Encode(value) {
  return Buffer
    .from(value)
    .toString("base64");
}

function base64Decode(value) {
  return Buffer
    .from(
      value,
      "base64"
    )
    .toString("utf8");
}

async function listRepos() {
  const result = [];

  let page = 1;

  while (true) {
    const repos =
      await github(
        `/user/repos?per_page=100&page=${page}&sort=updated`
      );

    if (!repos.length) {
      break;
    }

    result.push(
      ...repos
    );

    if (repos.length < 100) {
      break;
    }

    page++;

    if (page > 10) {
      break;
    }
  }

  return result.map(
    repo => ({
      id: repo.id,
      name: repo.name,
      full_name:
        repo.full_name,
      private: repo.private,
      description:
        repo.description,
      default_branch:
        repo.default_branch,
      html_url:
        repo.html_url,
      clone_url:
        repo.clone_url,
      updated_at:
        repo.updated_at
    })
  );
}

async function createRepo(data) {
  const name =
    String(data.name || "")
      .trim();

  if (!name) {
    throw new Error(
      "Nama repository wajib diisi."
    );
  }

  return github(
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
            Boolean(
              data.private
            ),

          auto_init:
            true
        })
    }
  );
}

async function getContents(
  repo,
  path = "",
  ref = ""
) {
  const clean =
    cleanPath(path);

  let url =
    `/repos/${encodeURIComponent(owner())}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodePath(clean)}`;

  if (ref) {
    url +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  return github(url);
}

async function getFile(
  repo,
  path,
  ref = ""
) {
  const result =
    await getContents(
      repo,
      path,
      ref
    );

  if (
    Array.isArray(result)
  ) {
    return {
      type: "directory",
      entries: result
    };
  }

  let content = "";

  if (
    result.content
  ) {
    content =
      base64Decode(
        result.content.replace(
          /\n/g,
          ""
        )
      );
  }

  return {
    type: "file",
    name: result.name,
    path: result.path,
    sha: result.sha,
    size: result.size,
    encoding: "utf-8",
    content,
    download_url:
      result.download_url,
    html_url:
      result.html_url
  };
}

async function saveFile(
  repo,
  path,
  content,
  message,
  sha
) {
  if (!path) {
    throw new Error(
      "Path file wajib diisi."
    );
  }

  const body = {
    message:
      message ||
      `YasamGit: update ${path}`,

    content:
      base64Encode(content)
  };

  if (sha) {
    body.sha = sha;
  }

  return github(
    `/repos/${encodeURIComponent(owner())}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodePath(path)}`,

    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(body)
    }
  );
}

async function deleteFile(
  repo,
  path,
  sha,
  message
) {
  if (!sha) {
    const file =
      await getContents(
        repo,
        path
      );

    if (
      Array.isArray(file) ||
      !file.sha
    ) {
      throw new Error(
        "SHA file tidak ditemukan."
      );
    }

    sha = file.sha;
  }

  return github(
    `/repos/${encodeURIComponent(owner())}` +
    `/${encodeURIComponent(repo)}` +
    `/contents/${encodePath(path)}`,

    {
      method: "DELETE",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          message:
            message ||
            `YasamGit: delete ${path}`,

          sha
        })
    }
  );
}

async function renameFile(
  repo,
  oldPath,
  newPath,
  message
) {
  const oldFile =
    await getContents(
      repo,
      oldPath
    );

  if (
    Array.isArray(oldFile)
  ) {
    throw new Error(
      "Rename folder secara langsung belum didukung."
    );
  }

  const content =
    base64Decode(
      String(
        oldFile.content || ""
      ).replace(
        /\n/g,
        ""
      )
    );

  await saveFile(
    repo,
    newPath,
    content,
    message ||
      `YasamGit: rename ${oldPath} -> ${newPath}`
  );

  return deleteFile(
    repo,
    oldPath,
    oldFile.sha,
    message ||
      `YasamGit: rename ${oldPath} -> ${newPath}`
  );
}

async function createFolder(
  repo,
  path,
  message
) {
  const folder =
    cleanPath(path);

  if (!folder) {
    throw new Error(
      "Path folder wajib diisi."
    );
  }

  const readme =
    `${folder}/.gitkeep`;

  return saveFile(
    repo,
    readme,
    "",
    message ||
      `YasamGit: create folder ${folder}`
  );
}

async function searchRepos(
  query
) {
  const q =
    String(query || "")
      .trim();

  if (!q) {
    return [];
  }

  const result =
    await github(
      `/search/repositories?q=${encodeURIComponent(
        q
      )}+user:${encodeURIComponent(owner())}&per_page=50`
    );

  return (
    result.items || []
  ).map(
    repo => ({
      name: repo.name,
      full_name:
        repo.full_name,
      private: repo.private,
      description:
        repo.description,
      html_url:
        repo.html_url
    })
  );
}

async function searchCode(
  query,
  repo
) {
  const q =
    String(query || "")
      .trim();

  if (!q) {
    return [];
  }

  let search =
    `${q}+user:${owner()}`;

  if (repo) {
    search =
      `${q}+repo:${owner()}/${repo}`;
  }

  const result =
    await github(
      `/search/code?q=${encodeURIComponent(
        search
      )}&per_page=50`
    );

  return (
    result.items || []
  ).map(
    item => ({
      name: item.name,
      path: item.path,
      repository:
        item.repository?.full_name,
      html_url:
        item.html_url
    })
  );
}

async function downloadInfo(
  repo,
  path
) {
  const result =
    await getContents(
      repo,
      path
    );

  if (
    Array.isArray(result)
  ) {
    throw new Error(
      "Path tersebut adalah folder."
    );
  }

  return {
    name: result.name,
    path: result.path,
    size: result.size,
    sha: result.sha,
    download_url:
      result.download_url,
    html_url:
      result.html_url,

    content:
      result.content
        ? base64Decode(
            result.content.replace(
              /\n/g,
              ""
            )
          )
        : ""
  };
}

async function health(
  req,
  res
) {
  send(res, 200, {
    ok: true,
    service:
      "YasamGit Backend",
    version:
      "5.2.0",
    status:
      "online"
  });
}

module.exports =
  async function handler(
    req,
    res
  ) {
    cors(req, res);

    if (
      req.method === "OPTIONS"
    ) {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const url =
        new URL(
          req.url,
          `https://${req.headers.host || "localhost"}`
        );

      const pathname =
        url.pathname
          .replace(
            /\/+$/,
            ""
          ) || "/";

      /*
       * HEALTH
       */

      if (
        pathname === "/api" ||
        pathname === "/api/health"
      ) {
        return health(
          req,
          res
        );
      }

      /*
       * LOGIN
       */

      if (
        pathname === "/api/login"
      ) {
        if (
          req.method !== "POST"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        if (
          !process.env.ADMIN_PASSWORD
        ) {
          return send(
            res,
            500,
            {
              ok: false,
              error:
                "ADMIN_PASSWORD belum dikonfigurasi."
            }
          );
        }

        if (
          !process.env.SESSION_SECRET
        ) {
          return send(
            res,
            500,
            {
              ok: false,
              error:
                "SESSION_SECRET belum dikonfigurasi."
            }
          );
        }

        const data =
          await readBody(req);

        const password =
          String(
            data.password || ""
          );

        const a =
          Buffer.from(
            password
          );

        const b =
          Buffer.from(
            String(
              process.env.ADMIN_PASSWORD
            )
          );

        let valid = false;

        if (
          a.length === b.length
        ) {
          valid =
            crypto.timingSafeEqual(
              a,
              b
            );
        }

        if (!valid) {
          return send(
            res,
            401,
            {
              ok: false,
              error:
                "Password salah."
            }
          );
        }

        const token =
          createSession();

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "Login berhasil.",
            expiresIn:
              SESSION_SECONDS
          },
          {
            "Set-Cookie":
              `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`
          }
        );
      }

      /*
       * SESSION
       */

      if (
        pathname === "/api/session"
      ) {
        return send(
          res,
          200,
          {
            ok: true,
            authenticated:
              authenticated(req)
          }
        );
      }

      /*
       * LOGOUT
       */

      if (
        pathname === "/api/logout"
      ) {
        return send(
          res,
          200,
          {
            ok: true,
            message:
              "Logout berhasil."
          },
          {
            "Set-Cookie":
              `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
          }
        );
      }

      /*
       * SEMUA API BERIKUTNYA
       * MEMERLUKAN LOGIN
       */

      if (
        !requireAuth(
          req,
          res
        )
      ) {
        return;
      }

      /*
       * REPOSITORIES
       */

      if (
        pathname === "/api/repos"
      ) {
        if (
          req.method === "GET"
        ) {
          const repos =
            await listRepos();

          return send(
            res,
            200,
            {
              ok: true,
              repos
            }
          );
        }

        if (
          req.method === "POST"
        ) {
          const data =
            await readBody(req);

          const repo =
            await createRepo(
              data
            );

          return send(
            res,
            201,
            {
              ok: true,
              repo
            }
          );
        }

        return send(
          res,
          405,
          {
            ok: false,
            error:
              "Method not allowed"
          }
        );
      }

      /*
       * REPOSITORY ROOT
       */

      if (
        pathname === "/api/repo"
      ) {
        const data =
          await readBody(req);

        const repo =
          String(
            data.repo ||
            url.searchParams.get(
              "repo"
            ) ||
            ""
          ).trim();

        const path =
          cleanPath(
            data.path ||
            url.searchParams.get(
              "path"
            ) ||
            ""
          );

        if (!repo) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo wajib diisi."
            }
          );
        }

        const result =
          await getContents(
            repo,
            path
          );

        return send(
          res,
          200,
          {
            ok: true,
            repo,
            path,
            data: result
          }
        );
      }

      /*
       * FILE GET / PREVIEW
       */

      if (
        pathname === "/api/file"
      ) {
        const data =
          req.method === "GET"
            ? {}
            : await readBody(req);

        const repo =
          String(
            data.repo ||
            url.searchParams.get(
              "repo"
            ) ||
            ""
          ).trim();

        const path =
          cleanPath(
            data.path ||
            url.searchParams.get(
              "path"
            ) ||
            ""
          );

        if (
          !repo ||
          !path
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo dan path wajib diisi."
            }
          );
        }

        const result =
          await getFile(
            repo,
            path,
            String(
              data.ref ||
              url.searchParams.get(
                "ref"
              ) ||
              ""
            )
          );

        return send(
          res,
          200,
          {
            ok: true,
            data: result
          }
        );
      }

      /*
       * CREATE / UPDATE FILE
       */

      if (
        pathname === "/api/file/save"
      ) {
        if (
          req.method !== "POST" &&
          req.method !== "PUT"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        const data =
          await readBody(req);

        const repo =
          String(
            data.repo || ""
          ).trim();

        const path =
          cleanPath(
            data.path
          );

        if (
          !repo ||
          !path
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo dan path wajib diisi."
            }
          );
        }

        const content =
          String(
            data.content ?? ""
          );

        const result =
          await saveFile(
            repo,
            path,
            content,
            data.message,
            data.sha
          );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "File berhasil disimpan.",
            result
          }
        );
      }

      /*
       * UPLOAD BINARY
       *
       * Frontend mengirim base64.
       */

      if (
        pathname === "/api/upload"
      ) {
        if (
          req.method !== "POST"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        const data =
          await readBody(req);

        const repo =
          String(
            data.repo || ""
          ).trim();

        const path =
          cleanPath(
            data.path
          );

        const base64 =
          String(
            data.base64 || ""
          );

        if (
          !repo ||
          !path ||
          !base64
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo, path dan base64 wajib diisi."
            }
          );
        }

        const body = {
          message:
            data.message ||
            `YasamGit: upload ${path}`,

          content:
            base64
        };

        if (data.sha) {
          body.sha =
            data.sha;
        }

        const result =
          await github(
            `/repos/${encodeURIComponent(owner())}` +
            `/${encodeURIComponent(repo)}` +
            `/contents/${encodePath(path)}`,

            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(body)
            }
          );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "Upload berhasil.",
            result
          }
        );
      }

      /*
       * DELETE
       */

      if (
        pathname === "/api/delete"
      ) {
        if (
          req.method !== "DELETE" &&
          req.method !== "POST"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        const data =
          await readBody(req);

        const repo =
          String(
            data.repo || ""
          ).trim();

        const path =
          cleanPath(
            data.path
          );

        if (
          !repo ||
          !path
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo dan path wajib diisi."
            }
          );
        }

        const result =
          await deleteFile(
            repo,
            path,
            data.sha,
            data.message
          );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "File berhasil dihapus.",
            result
          }
        );
      }

      /*
       * RENAME
       */

      if (
        pathname === "/api/rename"
      ) {
        if (
          req.method !== "POST" &&
          req.method !== "PUT"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        const data =
          await readBody(req);

        const repo =
          String(
            data.repo || ""
          ).trim();

        const oldPath =
          cleanPath(
            data.oldPath
          );

        const newPath =
          cleanPath(
            data.newPath
          );

        if (
          !repo ||
          !oldPath ||
          !newPath
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo, oldPath dan newPath wajib diisi."
            }
          );
        }

        const result =
          await renameFile(
            repo,
            oldPath,
            newPath,
            data.message
          );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "Rename berhasil.",
            result
          }
        );
      }

      /*
       * FOLDER
       */

      if (
        pathname === "/api/folder"
      ) {
        if (
          req.method !== "POST"
        ) {
          return send(
            res,
            405,
            {
              ok: false,
              error:
                "Method not allowed"
            }
          );
        }

        const data =
          await readBody(req);

        const repo =
          String(
            data.repo || ""
          ).trim();

        const path =
          cleanPath(
            data.path
          );

        if (
          !repo ||
          !path
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo dan path wajib diisi."
            }
          );
        }

        const result =
          await createFolder(
            repo,
            path,
            data.message
          );

        return send(
          res,
          201,
          {
            ok: true,
            message:
              "Folder berhasil dibuat.",
            result
          }
        );
      }

      /*
       * DOWNLOAD
       */

      if (
        pathname === "/api/download"
      ) {
        const repo =
          String(
            url.searchParams.get(
              "repo"
            ) || ""
          ).trim();

        const path =
          cleanPath(
            url.searchParams.get(
              "path"
            ) || ""
          );

        if (
          !repo ||
          !path
        ) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "repo dan path wajib diisi."
            }
          );
        }

        const result =
          await downloadInfo(
            repo,
            path
          );

        return send(
          res,
          200,
          {
            ok: true,
            data: result
          }
        );
      }

      /*
       * SEARCH
       */

      if (
        pathname === "/api/search"
      ) {
        const query =
          String(
            url.searchParams.get(
              "q"
            ) || ""
          ).trim();

        const repo =
          String(
            url.searchParams.get(
              "repo"
            ) || ""
          ).trim();

        if (!query) {
          return send(
            res,
            400,
            {
              ok: false,
              error:
                "q wajib diisi."
            }
          );
        }

        const results =
          repo
            ? await searchCode(
                query,
                repo
              )
            : await searchRepos(
                query
              );

        return send(
          res,
          200,
          {
            ok: true,
            query,
            results
          }
        );
      }

      return send(
        res,
        404,
        {
          ok: false,
          error:
            "Endpoint tidak ditemukan.",
          path: pathname
        }
      );

    } catch (error) {

      console.error(
        "YasamGit error:",
        error
      );

      send(
        res,
        error.status >= 400
          ? error.status
          : 500,
        {
          ok: false,
          error:
            error.message ||
            "Internal server error"
        }
      );
    }
  };