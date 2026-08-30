const GITHUB_API =
  "https://api.github.com";

function githubHeaders() {
  return {
    "Accept":
      "application/vnd.github+json",

    "X-GitHub-Api-Version":
      "2022-11-28",

    "User-Agent":
      "YasamGit-V5.2",

    "Authorization":
      `Bearer ${process.env.GITHUB_TOKEN}`
  };
}

async function github(
  endpoint,
  options = {}
) {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN belum dikonfigurasi."
    );
  }

  const response = await fetch(
    GITHUB_API + endpoint,
    {
      ...options,

      headers: {
        ...githubHeaders(),
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        message: text
      };
    }
  }

  return {
    response,
    data
  };
}

function repoPath(owner, repo) {
  return (
    `/repos/${encodeURIComponent(owner)}` +
    `/${encodeURIComponent(repo)}`
  );
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

function contentsPath(
  owner,
  repo,
  path = ""
) {
  const base =
    `${repoPath(owner, repo)}/contents`;

  if (!path) {
    return base;
  }

  return (
    `${base}/` +
    encodePath(path)
  );
}

module.exports = {
  github,
  repoPath,
  encodePath,
  contentsPath
};