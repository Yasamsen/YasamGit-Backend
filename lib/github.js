const API =
  "https://api.github.com";

function token() {
  return process.env.GITHUB_TOKEN || "";
}

function username() {
  return process.env.GITHUB_USERNAME || "";
}

function headers() {
  const t = token();

  if (!t) {
    throw new Error(
      "GITHUB_TOKEN belum dikonfigurasi."
    );
  }

  return {
    "Accept":
      "application/vnd.github+json",

    "Authorization":
      `Bearer ${t}`,

    "X-GitHub-Api-Version":
      "2022-11-28",

    "User-Agent":
      "YasamGit/5.2"
  };
}

async function github(
  path,
  options = {}
) {
  const response =
    await fetch(
      API + path,
      {
        ...options,

        headers: {
          ...headers(),
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

  if (!response.ok) {
    const error =
      new Error(
        data.message ||
        `GitHub HTTP ${response.status}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}

function encodePath(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map(
      encodeURIComponent
    )
    .join("/");
}

async function getRepositories() {
  const user =
    username();

  if (!user) {
    throw new Error(
      "GITHUB_USERNAME belum dikonfigurasi."
    );
  }

  const all = [];

  let page = 1;

  while (true) {

    const data =
      await github(
        `/users/${encodeURIComponent(user)}/repos?per_page=100&page=${page}&sort=updated`
      );

    all.push(...data);

    if (
      data.length < 100
    ) {
      break;
    }

    page++;
  }

  return all;
}

async function getContents(
  repo,
  path = ""
) {
  const user =
    username();

  const encoded =
    encodePath(path);

  const url =
    encoded
      ? `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encoded}`
      : `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents`;

  return github(url);
}

async function getFile(
  repo,
  path
) {
  const user =
    username();

  const encoded =
    encodePath(path);

  return github(
    `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encoded}`
  );
}

async function createRepository(
  name,
  description = ""
) {
  return github(
    `/user/repos`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          name,
          description,
          private: false,
          auto_init: true
        })
    }
  );
}

async function putFile(
  repo,
  path,
  content,
  message,
  sha
) {
  const user =
    username();

  const body = {
    message:
      message ||
      `Update ${path}`,

    content,

    branch:
      process.env.GITHUB_BRANCH ||
      "main"
  };

  if (sha) {
    body.sha = sha;
  }

  return github(
    `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
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
  const user =
    username();

  return github(
    `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`,
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
            `Delete ${path}`,

          sha,

          branch:
            process.env.GITHUB_BRANCH ||
            "main"
        })
    }
  );
}

async function getRepo(
  repo
) {
  const user =
    username();

  return github(
    `/repos/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`
  );
}

module.exports = {
  github,
  encodePath,
  getRepositories,
  getContents,
  getFile,
  createRepository,
  putFile,
  deleteFile,
  getRepo
};