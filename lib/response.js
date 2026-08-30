const ALLOWED_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "https://yasamsen.github.io";

function applyCors(req, res) {
  const origin = req.headers.origin;

  if (origin === ALLOWED_ORIGIN) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Access-Control-Allow-Credentials",
    "true"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );
}

function json(req, res, status, data) {
  applyCors(req, res);

  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.end(
    JSON.stringify(data)
  );
}

function method(req, res, allowed) {
  if (req.method === "OPTIONS") {
    applyCors(req, res);

    res.statusCode = 204;
    res.end();

    return false;
  }

  if (!allowed.includes(req.method)) {
    res.setHeader(
      "Allow",
      allowed.join(", ")
    );

    json(req, res, 405, {
      ok: false,
      error: "Method not allowed"
    });

    return false;
  }

  return true;
}

async function body(req) {
  if (req.body !== undefined) {
    if (
      typeof req.body === "object"
    ) {
      return req.body;
    }

    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise(
    (resolve, reject) => {
      let raw = "";

      req.on("data", chunk => {
        raw += chunk;
      });

      req.on("end", () => {
        if (!raw) {
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({});
        }
      });

      req.on("error", reject);
    }
  );
}

module.exports = {
  applyCors,
  json,
  method,
  body
};