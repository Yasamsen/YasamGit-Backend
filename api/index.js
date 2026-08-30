const crypto = require("crypto");

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.FRONTEND_ORIGIN || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods":
      "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Vary": "Origin"
  };
}

function json(data, status = 200, extra = {}) {
  return {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      ...extra
    },
    body: JSON.stringify(data)
  };
}

function randomId(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64url(input) {
  input = input
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (input.length % 4) {
    input += "=";
  }

  return Buffer.from(input, "base64").toString();
}

function sign(value) {
  return base64url(
    crypto
      .createHmac(
        "sha256",
        process.env.SESSION_SECRET
      )
      .update(value)
      .digest()
  );
}

function createSession() {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
    id: randomId(16)
  };

  const data = base64url(
    JSON.stringify(payload)
  );

  const signature = sign(data);

  return `${data}.${signature}`;
}

function getCookie(request, name) {
  const cookie = request.headers.cookie || "";

  const parts = cookie.split(";");

  for (const part of parts) {
    const [key, ...rest] =
      part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(
        rest.join("=")
      );
    }
  }

  return null;
}

function verifySession(session) {
  if (!session) return null;

  const parts = session.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [data, signature] = parts;

  const expected = sign(data);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      fromBase64url(data)
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

function getSession(request) {
  const cookie = getCookie(
    request,
    "yasamgit_session"
  );

  return verifySession(cookie);
}

function requireEnvironment() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN belum diset."
    );
  }

  if (!process.env.ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD belum diset."
    );
  }

  if (!process.env.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET belum diset."
    );
  }
}

function githubHeaders() {
  return {
    Accept:
      "application/vnd.github+json",

    "X-GitHub-Api-Version":
      API_VERSION,

    "User-Agent":
      "YasamGit-V5.2",

    Authorization:
      `Bearer ${process.env.GITHUB_TOKEN}`
  };
}

async function github(path, options = {}) {
  const response = await fetch(
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
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    response,
    data
  };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function encodePath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function repoPath(owner, repo) {
  return (
    `/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}`
  );
}

/* =========================
   LOGIN
========================= */

async function login(request) {
  requireEnvironment();

  const data =
    await readBody(request);

  const password =
    String(data.password || "");

  if (!password) {
    return json(
      {
        ok: false,
        error: "Password wajib diisi."
      },
      400
    );
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(
        process.env.ADMIN_PASSWORD
      )
    )
  ) {
    return json(
      {
        ok: false,
        error: "Password salah."
      },
      401
    );
  }

  const session =
    createSession();

  return json(
    {
      ok: true,
      message: "Login berhasil.",
      expiresIn: 86400
    },
    200,
    {
      "Set-Cookie":
        `yasamgit_session=${encodeURIComponent(session)}; ` +
        "HttpOnly; Secure; SameSite=None; Path=/; Max-Age=86400"
    }
  );
}

async function logout() {
  return json(
    {
      ok: true
    },
    200,
    {
      "Set-Cookie":
        "yasamgit_session=; " +
        "HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0"
    }
  );
}

async function sessionInfo(request) {
  const session =
    getSession(request);

  if (!session) {
    return json(
      {
        ok: false,
        authenticated: false
      },
      401
    );
  }

  return json({
    ok: true,
    authenticated: true,
    expiresAt: session.exp
  });
}

/* =========================
   GITHUB USER
========================= */

async function getUser() {
  const result =
    await github("/user");

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   REPOSITORIES
========================= */

async function getRepos(request) {
  const url =
    new URL(request.url);

  const page =
    url.searchParams.get("page") ||
    "1";

  const perPage =
    Math.min(
      Number(
        url.searchParams.get(
          "per_page"
        ) || 100
      ),
      100
    );

  const result =
    await github(
      `/user/repos?page=${page}` +
      `&per_page=${perPage}` +
      `&sort=updated`
    );

  return json(
    result.data,
    result.response.status
  );
}

async function createRepo(request) {
  const data =
    await readBody(request);

  if (!data.name) {
    return json(
      {
        ok: false,
        error:
          "Nama repository wajib."
      },
      400
    );
  }

  const payload = {
    name: String(data.name),
    description:
      String(
        data.description || ""
      ),
    private:
      Boolean(data.private),
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

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   CONTENTS
========================= */

async function listContents(request) {
  const url =
    new URL(request.url);

  const owner =
    url.searchParams.get("owner");

  const repo =
    url.searchParams.get("repo");

  const path =
    url.searchParams.get("path") || "";

  const ref =
    url.searchParams.get("ref");

  if (!owner || !repo) {
    return json(
      {
        ok: false,
        error:
          "owner dan repo wajib."
      },
      400
    );
  }

  let endpoint =
    `${repoPath(owner, repo)}` +
    `/contents/${encodePath(path)}`;

  if (ref) {
    endpoint +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  const result =
    await github(endpoint);

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   GET FILE
========================= */

async function getFile(request) {
  const url =
    new URL(request.url);

  const owner =
    url.searchParams.get("owner");

  const repo =
    url.searchParams.get("repo");

  const path =
    url.searchParams.get("path");

  const ref =
    url.searchParams.get("ref");

  if (!owner || !repo || !path) {
    return json(
      {
        ok: false,
        error:
          "owner, repo dan path wajib."
      },
      400
    );
  }

  let endpoint =
    `${repoPath(owner, repo)}` +
    `/contents/${encodePath(path)}`;

  if (ref) {
    endpoint +=
      `?ref=${encodeURIComponent(ref)}`;
  }

  const result =
    await github(endpoint);

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   UPLOAD / OVERWRITE
========================= */

async function uploadFile(request) {
  const data =
    await readBody(request);

  const owner =
    data.owner;

  const repo =
    data.repo;

  const path =
    data.path;

  const content =
    data.content;

  if (
    !owner ||
    !repo ||
    !path ||
    content === undefined
  ) {
    return json(
      {
        ok: false,
        error:
          "owner, repo, path dan content wajib."
      },
      400
    );
  }

  let sha =
    data.sha || null;

  /*
   * Kalau SHA tidak dikirim,
   * cek apakah file sudah ada.
   */

  if (!sha) {
    const existing =
      await github(
        `${repoPath(owner, repo)}` +
        `/contents/${encodePath(path)}`
      );

    if (
      existing.response.ok &&
      existing.data.sha
    ) {
      sha =
        existing.data.sha;
    }
  }

  /*
   * content harus berupa Base64.
   *
   * Foto/video:
   * data:image/jpeg;base64,...
   *
   * kita ambil bagian Base64-nya.
   */

  let finalContent =
    String(content);

  if (
    finalContent.includes(
      "base64,"
    )
  ) {
    finalContent =
      finalContent.split(
        "base64,"
      )[1];
  }

  const payload = {
    message:
      data.message ||
      `YasamGit: ${
        sha
          ? "update"
          : "upload"
      } ${path}`,

    content:
      finalContent
  };

  if (sha) {
    payload.sha = sha;
  }

  if (data.branch) {
    payload.branch =
      data.branch;
  }

  const result =
    await github(
      `${repoPath(owner, repo)}` +
      `/contents/${encodePath(path)}`,
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

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   DELETE
========================= */

async function deleteFile(request) {
  const data =
    await readBody(request);

  if (
    !data.owner ||
    !data.repo ||
    !data.path ||
    !data.sha
  ) {
    return json(
      {
        ok: false,
        error:
          "owner, repo, path dan sha wajib."
      },
      400
    );
  }

  const payload = {
    message:
      data.message ||
      `YasamGit: delete ${data.path}`,

    sha:
      data.sha
  };

  if (data.branch) {
    payload.branch =
      data.branch;
  }

  const result =
    await github(
      `${repoPath(
        data.owner,
        data.repo
      )}` +
      `/contents/${encodePath(
        data.path
      )}`,
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

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   RENAME
========================= */

async function renameFile(request) {
  const data =
    await readBody(request);

  if (
    !data.owner ||
    !data.repo ||
    !data.oldPath ||
    !data.newPath
  ) {
    return json(
      {
        ok: false,
        error:
          "owner, repo, oldPath dan newPath wajib."
      },
      400
    );
  }

  const oldFile =
    await github(
      `${repoPath(
        data.owner,
        data.repo
      )}` +
      `/contents/${encodePath(
        data.oldPath
      )}`
    );

  if (!oldFile.response.ok) {
    return json(
      oldFile.data,
      oldFile.response.status
    );
  }

  /*
   * GitHub Contents API tidak mempunyai
   * rename langsung.
   *
   * Jadi:
   * 1. Ambil file
   * 2. Buat file baru
   * 3. Hapus file lama
   */

  const createPayload = {
    message:
      data.message ||
      `YasamGit: rename ${data.oldPath}`,

    content:
      oldFile.data.content,

    sha:
      undefined
  };

  if (data.branch) {
    createPayload.branch =
      data.branch;
  }

  const newFile =
    await github(
      `${repoPath(
        data.owner,
        data.repo
      )}` +
      `/contents/${encodePath(
        data.newPath
      )}`,
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

  if (!newFile.response.ok) {
    return json(
      newFile.data,
      newFile.response.status
    );
  }

  const deletePayload = {
    message:
      `YasamGit: remove ${data.oldPath}`,

    sha:
      oldFile.data.sha
  };

  if (data.branch) {
    deletePayload.branch =
      data.branch;
  }

  const removed =
    await github(
      `${repoPath(
        data.owner,
        data.repo
      )}` +
      `/contents/${encodePath(
        data.oldPath
      )}`,
      {
        method: "DELETE",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            deletePayload
          )
      }
    );

  if (!removed.response.ok) {
    return json(
      {
        ok: false,
        error:
          "File baru berhasil dibuat tetapi file lama gagal dihapus.",
        created:
          newFile.data,
        deleteError:
          removed.data
      },
      500
    );
  }

  return json({
    ok: true,
    message:
      "Rename berhasil.",

    result:
      newFile.data
  });
}

/* =========================
   BRANCHES
========================= */

async function getBranches(request) {
  const url =
    new URL(request.url);

  const owner =
    url.searchParams.get("owner");

  const repo =
    url.searchParams.get("repo");

  if (!owner || !repo) {
    return json(
      {
        ok: false,
        error:
          "owner dan repo wajib."
      },
      400
    );
  }

  const result =
    await github(
      `${repoPath(
        owner,
        repo
      )}/branches?per_page=100`
    );

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   SEARCH REPOSITORIES
========================= */

async function searchRepos(request) {
  const url =
    new URL(request.url);

  const q =
    url.searchParams.get("q");

  if (!q) {
    return json(
      {
        ok: false,
        error:
          "Query wajib."
      },
      400
    );
  }

  const result =
    await github(
      `/search/repositories?q=${encodeURIComponent(
        q
      )}+user:${encodeURIComponent(
        ""
      )}`
    );

  return json(
    result.data,
    result.response.status
  );
}

/* =========================
   ROUTER
========================= */

async function handler(request) {
  const url =
    new URL(request.url);

  const path =
    url.pathname;

  if (
    request.method === "OPTIONS"
  ) {
    return {
      status: 204,
      headers: corsHeaders(),
      body: ""
    };
  }

  if (
    path === "/api/health"
  ) {
    return json({
      ok: true,
      service:
        "YasamGit Backend",
      version: "5.2.0"
    });
  }

  if (
    path === "/api/login" &&
    request.method === "POST"
  ) {
    return login(request);
  }

  if (
    path === "/api/logout" &&
    request.method === "POST"
  ) {
    return logout();
  }

  if (
    path === "/api/session"
  ) {
    return sessionInfo(request);
  }

  const session =
    getSession(request);

  if (!session) {
    return json(
      {
        ok: false,
        error:
          "Unauthorized. Silakan login."
      },
      401
    );
  }

  requireEnvironment();

  /* USER */

  if (
    path === "/api/github/user" &&
    request.method === "GET"
  ) {
    return getUser();
  }

  /* REPOSITORIES */

  if (
    path === "/api/github/repos" &&
    request.method === "GET"
  ) {
    return getRepos(request);
  }

  if (
    path === "/api/github/repos" &&
    request.method === "POST"
  ) {
    return createRepo(request);
  }

  /* CONTENTS */

  if (
    path === "/api/github/contents" &&
    request.method === "GET"
  ) {
    return listContents(request);
  }

  /* FILE */

  if (
    path === "/api/github/file" &&
    request.method === "GET"
  ) {
    return getFile(request);
  }

  /* UPLOAD */

  if (
    path === "/api/github/upload" &&
    request.method === "POST"
  ) {
    return uploadFile(request);
  }

  /* DELETE */

  if (
    path === "/api/github/delete" &&
    request.method === "POST"
  ) {
    return deleteFile(request);
  }

  /* RENAME */

  if (
    path === "/api/github/rename" &&
    request.method === "POST"
  ) {
    return renameFile(request);
  }

  /* BRANCHES */

  if (
    path === "/api/github/branches" &&
    request.method === "GET"
  ) {
    return getBranches(request);
  }

  /* SEARCH */

  if (
    path === "/api/github/search" &&
    request.method === "GET"
  ) {
    return searchRepos(request);
  }

  return json(
    {
      ok: false,
      error:
        "Endpoint tidak ditemukan."
    },
    404
  );
}

module.exports = async (
  request,
  response
) => {
  try {
    const result =
      await handler(request);

    response.statusCode =
      result.status;

    for (
      const [key, value]
      of Object.entries(
        result.headers || {}
      )
    ) {
      response.setHeader(
        key,
        value
      );
    }

    response.end(
      result.body || ""
    );
  } catch (error) {
    console.error(error);

    response.statusCode = 500;

    response.setHeader(
      "Content-Type",
      "application/json"
    );

    response.end(
      JSON.stringify({
        ok: false,
        error:
          error.message ||
          "Internal Server Error"
      })
    );
  }
};