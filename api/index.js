const crypto = require("crypto");

const GITHUB_API = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function corsHeaders() {
  const origin = process.env.FRONTEND_ORIGIN || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods":
      "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

function send(res, status, data, extraHeaders = {}) {
  res.statusCode = status;

  const headers = {
    ...corsHeaders(),
    "Content-Type":
      "application/json; charset=utf-8",
    ...extraHeaders
  };

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  res.end(JSON.stringify(data));
}

function getCookie(req, name) {
  const cookieHeader =
    req.headers.cookie || "";

  const cookies =
    cookieHeader
      .split(";")
      .map(x => x.trim());

  for (const cookie of cookies) {
    const index = cookie.indexOf("=");

    if (index === -1) continue;

    const key =
      cookie.slice(0, index);

    const value =
      cookie.slice(index + 1);

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| Session
|--------------------------------------------------------------------------
*/

function createSession() {
  const payload = {
    id: crypto.randomBytes(16).toString("hex"),
    iat: Date.now(),
    exp:
      Date.now() +
      24 * 60 * 60 * 1000
  };

  const data =
    Buffer.from(
      JSON.stringify(payload)
    ).toString("base64url");

  const signature =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(data)
      .digest("base64url");

  return `${data}.${signature}`;
}

function verifySession(token) {
  if (!token) return null;

  const parts =
    token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [data, signature] =
    parts;

  const expected =
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(data)
      .digest("base64url");

  try {
    const a =
      Buffer.from(signature);

    const b =
      Buffer.from(expected);

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          data,
          "base64url"
        ).toString("utf8")
      );

    if (
      !payload.exp ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return payload;

  } catch {
    return null;
  }
}

function getSession(req) {
  return verifySession(
    getCookie(
      req,
      "yasamgit_session"
    )
  );
}

function requireSession(req, res) {
  const session =
    getSession(req);

  if (!session) {
    send(res, 401, {
      ok: false,
      error:
        "Session tidak valid atau sudah expired."
    });

    return null;
  }

  return session;
}

/*
|--------------------------------------------------------------------------
| GitHub
|--------------------------------------------------------------------------
*/

function githubHeaders() {
  return {
    Accept:
      "application/vnd.github+json",

    "X-GitHub-Api-Version":
      GITHUB_API_VERSION,

    "User-Agent":
      "YasamGit-V5.2",

    Authorization:
      `Bearer ${process.env.GITHUB_TOKEN}`
  };
}

async function github(
  endpoint,
  options = {}
) {
  const response =
    await fetch(
      GITHUB_API + endpoint,
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
        : {};
  } catch {
    data = {
      message: text
    };
  }

  return {
    response,
    data
  };
}

function encodePath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(
      part =>
        encodeURIComponent(part)
    )
    .join("/");
}

function repoPath(owner, repo) {
  return (
    `/repos/` +
    `${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}`
  );
}

async function readBody(req) {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    return req.body;
  }

  return new Promise(
    resolve => {
      let body = "";

      req.on(
        "data",
        chunk => {
          body += chunk;
        }
      );

      req.on(
        "end",
        () => {
          try {
            resolve(
              body
                ? JSON.parse(body)
                : {}
            );
          } catch {
            resolve({});
          }
        }
      );

      req.on(
        "error",
        () => resolve({})
      );
    }
  );
}

/*
|--------------------------------------------------------------------------
| HEALTH
|--------------------------------------------------------------------------
*/

async function health(req, res) {
  send(res, 200, {
    ok: true,
    service:
      "YasamGit Backend",
    version: "5.2.0",
    status: "online"
  });
}

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

async function login(req, res) {
  if (
    !process.env.ADMIN_PASSWORD
  ) {
    return send(res, 500, {
      ok: false,
      error:
        "ADMIN_PASSWORD belum diset di Vercel."
    });
  }

  if (
    !process.env.SESSION_SECRET
  ) {
    return send(res, 500, {
      ok: false,
      error:
        "SESSION_SECRET belum diset di Vercel."
    });
  }

  const body =
    await readBody(req);

  const password =
    String(body.password || "");

  if (!password) {
    return send(res, 400, {
      ok: false,
      error:
        "Password wajib diisi."
    });
  }

  const input =
    Buffer.from(password);

  const stored =
    Buffer.from(
      String(
        process.env.ADMIN_PASSWORD
      )
    );

  let valid = false;

  if (
    input.length === stored.length
  ) {
    valid =
      crypto.timingSafeEqual(
        input,
        stored
      );
  }

  if (!valid) {
    return send(res, 401, {
      ok: false,
      error:
        "Password salah."
    });
  }

  const session =
    createSession();

  send(
    res,
    200,
    {
      ok: true,
      message:
        "Login berhasil.",
      expiresIn:
        24 * 60 * 60
    },
    {
      "Set-Cookie":
        `yasamgit_session=${encodeURIComponent(session)}; ` +
        `HttpOnly; ` +
        `Secure; ` +
        `SameSite=None; ` +
        `Path=/; ` +
        `Max-Age=86400`
    }
  );
}

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

async function logout(req, res) {
  send(
    res,
    200,
    {
      ok: true,
      message:
        "Logout berhasil."
    },
    {
      "Set-Cookie":
        "yasamgit_session=; " +
        "HttpOnly; " +
        "Secure; " +
        "SameSite=None; " +
        "Path=/; " +
        "Max-Age=0"
    }
  );
}

/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

async function session(req, res) {
  const current =
    getSession(req);

  if (!current) {
    return send(res, 401, {
      ok: false,
      authenticated: false
    });
  }

  send(res, 200, {
    ok: true,
    authenticated: true,
    expiresAt:
      current.exp
  });
}

/*
|--------------------------------------------------------------------------
| GITHUB USER
|--------------------------------------------------------------------------
*/

async function getUser(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const result =
    await github("/user");

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| LIST REPOSITORIES
|--------------------------------------------------------------------------
*/

async function getRepos(req, res) {
  if (
    !requireSession(req, res)
  ) return;

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

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| CREATE REPOSITORY
|--------------------------------------------------------------------------
*/

async function createRepo(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const body =
    await readBody(req);

  const name =
    String(body.name || "")
      .trim();

  if (!name) {
    return send(res, 400, {
      ok: false,
      error:
        "Nama repository wajib."
    });
  }

  const payload = {
    name,

    description:
      String(
        body.description || ""
      ),

    private:
      Boolean(body.private),

    auto_init: true
  };

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
          JSON.stringify(payload)
      }
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| LIST FILES / FOLDERS
|--------------------------------------------------------------------------
*/

async function listContents(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const owner =
    req.query?.owner;

  const repo =
    req.query?.repo;

  const path =
    req.query?.path || "";

  const ref =
    req.query?.ref;

  if (!owner || !repo) {
    return send(res, 400, {
      ok: false,
      error:
        "owner dan repo wajib."
    });
  }

  let endpoint =
    `${repoPath(owner, repo)}/contents`;

  if (path) {
    endpoint +=
      `/${encodePath(path)}`;
  }

  if (ref) {
    endpoint +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  const result =
    await github(endpoint);

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| GET SINGLE FILE
|--------------------------------------------------------------------------
*/

async function getFile(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const owner =
    req.query?.owner;

  const repo =
    req.query?.repo;

  const path =
    req.query?.path;

  const ref =
    req.query?.ref;

  if (
    !owner ||
    !repo ||
    !path
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo dan path wajib."
    });
  }

  let endpoint =
    `${repoPath(owner, repo)}/contents/` +
    encodePath(path);

  if (ref) {
    endpoint +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  const result =
    await github(endpoint);

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| UPLOAD / OVERWRITE
|--------------------------------------------------------------------------
|
| content harus Base64 murni.
| Frontend bisa mengirim:
|
| data:image/png;base64,XXXX
|
| atau:
|
| XXXX
|
|--------------------------------------------------------------------------
*/

async function uploadFile(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const body =
    await readBody(req);

  const owner =
    String(body.owner || "");

  const repo =
    String(body.repo || "");

  const path =
    String(body.path || "");

  let content =
    String(body.content ?? "");

  if (
    !owner ||
    !repo ||
    !path
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo dan path wajib."
    });
  }

  /*
   * Hilangkan data URL prefix
   */

  if (
    content.startsWith(
      "data:"
    )
  ) {
    const comma =
      content.indexOf(",");

    if (comma !== -1) {
      content =
        content.slice(
          comma + 1
        );
    }
  }

  /*
   * GitHub membutuhkan Base64.
   */

  content =
    content.replace(
     (/\s+/g),
      ""
    );

  /*
   * Cari SHA jika file sudah ada.
   */

  let sha =
    body.sha || null;

  if (!sha) {
    const existing =
      await github(
        `${repoPath(owner, repo)}/contents/` +
        encodePath(path)
      );

    if (
      existing.response.ok &&
      existing.data?.sha
    ) {
      sha =
        existing.data.sha;
    }
  }

  const payload = {
    message:
      String(
        body.message ||
        (
          sha
            ? `Update ${path}`
            : `Upload ${path}`
        )
      ),

    content
  };

  if (sha) {
    payload.sha = sha;
  }

  if (body.branch) {
    payload.branch =
      String(body.branch);
  }

  const result =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(path),
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| DELETE FILE
|--------------------------------------------------------------------------
*/

async function deleteFile(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const body =
    await readBody(req);

  const owner =
    String(body.owner || "");

  const repo =
    String(body.repo || "");

  const path =
    String(body.path || "");

  const sha =
    String(body.sha || "");

  if (
    !owner ||
    !repo ||
    !path ||
    !sha
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo, path dan sha wajib."
    });
  }

  const payload = {
    message:
      String(
        body.message ||
        `Delete ${path}`
      ),

    sha
  };

  if (body.branch) {
    payload.branch =
      String(body.branch);
  }

  const result =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(path),
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

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| RENAME FILE / FOLDER ITEM
|--------------------------------------------------------------------------
|
| GitHub Contents API tidak memiliki rename
| langsung. Kita copy kemudian delete.
|
|--------------------------------------------------------------------------
*/

async function renameFile(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const body =
    await readBody(req);

  const owner =
    String(body.owner || "");

  const repo =
    String(body.repo || "");

  const oldPath =
    String(body.oldPath || "");

  const newPath =
    String(body.newPath || "");

  if (
    !owner ||
    !repo ||
    !oldPath ||
    !newPath
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo, oldPath dan newPath wajib."
    });
  }

  /*
   * Ambil file lama.
   */

  const oldFile =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(oldPath)
    );

  if (
    !oldFile.response.ok
  ) {
    return send(
      res,
      oldFile.response.status,
      oldFile.data
    );
  }

  /*
   * Buat file baru.
   */

  const createPayload = {
    message:
      String(
        body.message ||
        `Rename ${oldPath} to ${newPath}`
      ),

    content:
      String(
        oldFile.data.content || ""
      )
        .replace(
         (/\s+/g),
          ""
        )
  };

  if (body.branch) {
    createPayload.branch =
      String(body.branch);
  }

  const created =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(newPath),
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            createPayload
          )
      }
    );

  if (
    !created.response.ok
  ) {
    return send(
      res,
      created.response.status,
      created.data
    );
  }

  /*
   * Hapus file lama.
   */

  const deleted =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(oldPath),
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            message:
              `Delete old name ${oldPath}`,

            sha:
              oldFile.data.sha,

            ...(body.branch
              ? {
                  branch:
                    String(
                      body.branch
                    )
                }
              : {})
          })
      }
    );

  if (
    !deleted.response.ok
  ) {
    return send(res, 500, {
      ok: false,

      error:
        "File baru berhasil dibuat, tetapi file lama gagal dihapus.",

      created:
        created.data,

      deleteError:
        deleted.data
    });
  }

  send(res, 200, {
    ok: true,

    message:
      "Rename berhasil.",

    result:
      created.data
  });
}

/*
|--------------------------------------------------------------------------
| CREATE FOLDER
|--------------------------------------------------------------------------
|
| GitHub tidak menyimpan folder kosong.
| Folder dibuat menggunakan .gitkeep.
|
|--------------------------------------------------------------------------
*/

async function createFolder(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const body =
    await readBody(req);

  const owner =
    String(body.owner || "");

  const repo =
    String(body.repo || "");

  const folder =
    String(body.folder || "")
      .replace(
        /^\/+|\/+$/g,
        ""
      );

  if (
    !owner ||
    !repo ||
    !folder
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo dan folder wajib."
    });
  }

  const path =
    `${folder}/.gitkeep`;

  const payload = {
    message:
      String(
        body.message ||
        `Create folder ${folder}`
      ),

    content: ""
  };

  if (body.branch) {
    payload.branch =
      String(body.branch);
  }

  const result =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(path),
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| BRANCHES
|--------------------------------------------------------------------------
*/

async function branches(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const owner =
    req.query?.owner;

  const repo =
    req.query?.repo;

  if (!owner || !repo) {
    return send(res, 400, {
      ok: false,
      error:
        "owner dan repo wajib."
    });
  }

  const result =
    await github(
      `${repoPath(owner, repo)}/branches?per_page=100`
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| SEARCH REPOSITORIES
|--------------------------------------------------------------------------
*/

async function searchRepos(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const q =
    String(
      req.query?.q || ""
    ).trim();

  if (!q) {
    return send(res, 400, {
      ok: false,
      error:
        "Query wajib."
    });
  }

  const user =
    await github("/user");

  if (
    !user.response.ok
  ) {
    return send(
      res,
      user.response.status,
      user.data
    );
  }

  const username =
    user.data.login;

  const result =
    await github(
      `/search/repositories?` +
      `q=${encodeURIComponent(q)}` +
      `+user:${encodeURIComponent(username)}`
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| SEARCH FILES
|--------------------------------------------------------------------------
|
| GitHub Code Search memerlukan permission
| tertentu pada token. Jika tidak tersedia,
| frontend bisa menggunakan pencarian file
| dari folder yang sedang dibuka.
|
|--------------------------------------------------------------------------
*/

async function searchFiles(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const owner =
    String(
      req.query?.owner || ""
    );

  const repo =
    String(
      req.query?.repo || ""
    );

  const q =
    String(
      req.query?.q || ""
    ).trim();

  if (
    !owner ||
    !repo ||
    !q
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo dan q wajib."
    });
  }

  const query =
    `${q} repo:${owner}/${repo}`;

  const result =
    await github(
      `/search/code?q=${encodeURIComponent(query)}`
    );

  send(
    res,
    result.response.status,
    result.data
  );
}

/*
|--------------------------------------------------------------------------
| DOWNLOAD
|--------------------------------------------------------------------------
|
| Download binary lebih baik dilakukan langsung
| dari GitHub download_url yang diberikan API.
|
| Endpoint ini mengambil file dari GitHub dan
| mengirim binary ke browser.
|
|--------------------------------------------------------------------------
*/

async function downloadFile(req, res) {
  if (
    !requireSession(req, res)
  ) return;

  const owner =
    String(
      req.query?.owner || ""
    );

  const repo =
    String(
      req.query?.repo || ""
    );

  const path =
    String(
      req.query?.path || ""
    );

  if (
    !owner ||
    !repo ||
    !path
  ) {
    return send(res, 400, {
      ok: false,
      error:
        "owner, repo dan path wajib."
    });
  }

  const result =
    await github(
      `${repoPath(owner, repo)}/contents/` +
      encodePath(path)
    );

  if (
    !result.response.ok
  ) {
    return send(
      res,
      result.response.status,
      result.data
    );
  }

  /*
   * GitHub API mengembalikan content Base64.
   */

  if (
    result.data.content
  ) {

    const buffer =
      Buffer.from(
        String(
          result.data.content
        ).replace(
         (/\s+/g),
          ""
        ),
        "base64"
      );

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

    res.end(buffer);

    return;
  }

  /*
   * Untuk file terlalu besar, gunakan
   * download_url GitHub.
   */

  if (result.data.download_url) {

    const remote =
      await fetch(
        result.data.download_url
      );

    if (!remote.ok) {
      return send(res, 502, {
        ok: false,
        error:
          "Gagal mengambil file dari GitHub."
      });
    }

    res.statusCode =
      remote.status;

    const contentType =
      remote.headers.get(
        "content-type"
      );

    if (contentType) {
      res.setHeader(
        "Content-Type",
        contentType
      );
    }

    const buffer =
      Buffer.from(
        await remote.arrayBuffer()
      );

    res.setHeader(
      "Content-Length",
      buffer.length
    );

    res.end(buffer);

    return;
  }

  send(res, 404, {
    ok: false,
    error:
      "Download URL tidak tersedia."
  });
}

/*
|--------------------------------------------------------------------------
| ROUTER
|--------------------------------------------------------------------------
*/

async function handler(req, res) {

  /*
   * CORS preflight
   */

  if (
    req.method === "OPTIONS"
  ) {

    res.statusCode = 204;

    const headers =
      corsHeaders();

    for (
      const [key, value]
      of Object.entries(headers)
    ) {
      res.setHeader(
        key,
        value
      );
    }

    res.end();

    return;
  }

  const path =
    req.url
      .split("?")[0]
      .replace(
        /\/$/,
        ""
      );

  /*
   * Health
   */

  if (
    path === "/api" ||
    path === "/api/health"
  ) {
    return health(
      req,
      res
    );
  }

  /*
   * Auth
   */

  if (
    path === "/api/login" &&
    req.method === "POST"
  ) {
    return login(
      req,
      res
    );
  }

  if (
    path === "/api/logout" &&
    req.method === "POST"
  ) {
    return logout(
      req,
      res
    );
  }

  if (
    path === "/api/session" &&
    req.method === "GET"
  ) {
    return session(
      req,
      res
    );
  }

  /*
   * GitHub User
   */

  if (
    path === "/api/github/user" &&
    req.method === "GET"
  ) {
    return getUser(
      req,
      res
    );
  }

  /*
   * Repositories
   */

  if (
    path === "/api/github/repos" &&
    req.method === "GET"
  ) {
    return getRepos(
      req,
      res
    );
  }

  if (
    path === "/api/github/repos" &&
    req.method === "POST"
  ) {
    return createRepo(
      req,
      res
    );
  }

  /*
   * Contents
   */

  if (
    path === "/api/github/contents" &&
    req.method === "GET"
  ) {
    return listContents(
      req,
      res
    );
  }

  /*
   * Single file
   */

  if (
    path === "/api/github/file" &&
    req.method === "GET"
  ) {
    return getFile(
      req,
      res
    );
  }

  /*
   * Upload / overwrite
   */

  if (
    path === "/api/github/upload" &&
    req.method === "POST"
  ) {
    return uploadFile(
      req,
      res
    );
  }

  /*
   * Delete
   */

  if (
    path === "/api/github/delete" &&
    req.method === "POST"
  ) {
    return deleteFile(
      req,
      res
    );
  }

  /*
   * Rename
   */

  if (
    path === "/api/github/rename" &&
    req.method === "POST"
  ) {
    return renameFile(
      req,
      res
    );
  }

  /*
   * Create folder
   */

  if (
    path === "/api/github/folder" &&
    req.method === "POST"
  ) {
    return createFolder(
      req,
      res
    );
  }

  /*
   * Branches
   */

  if (
    path === "/api/github/branches" &&
    req.method === "GET"
  ) {
    return branches(
      req,
      res
    );
  }

  /*
   * Search repositories
   */

  if (
    path === "/api/github/search" &&
    req.method === "GET"
  ) {
    return searchRepos(
      req,
      res
    );
  }

  /*
   * Search files
   */

  if (
    path === "/api/github/search-files" &&
    req.method === "GET"
  ) {
    return searchFiles(
      req,
      res
    );
  }

  /*
   * Download
   */

  if (
    path === "/api/github/download" &&
    req.method === "GET"
  ) {
    return downloadFile(
      req,
      res
    );
  }

  /*
   * Not found
   */

  send(res, 404, {
    ok: false,
    error:
      "Endpoint tidak ditemukan.",
    path
  });
}

/*
|--------------------------------------------------------------------------
| VERCEL ENTRY
|--------------------------------------------------------------------------
*/

module.exports =
  async function(req, res) {

    try {

      /*
       * Pastikan konfigurasi dasar tersedia.
       */

      if (
        !process.env.GITHUB_TOKEN &&
        !(
          req.url === "/api" ||
          req.url === "/api/health"
        )
      ) {
        return send(res, 500, {
          ok: false,
          error:
            "GITHUB_TOKEN belum diset di Vercel."
        });
      }

      await handler(
        req,
        res
      );

    } catch (error) {

      console.error(
        "YasamGit Backend Error:",
        error
      );

      if (!res.headersSent) {

        send(res, 500, {
          ok: false,
          error:
            error.message ||
            "Internal Server Error"
        });

      } else {

        res.end();

      }
    }
  };