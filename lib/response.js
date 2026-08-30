function getAllowedOrigin() {
  return process.env.FRONTEND_ORIGIN || "*";
}

function corsHeaders() {
  const origin = getAllowedOrigin();

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Vary": "Origin"
  };
}

function applyCors(res) {
  const headers = corsHeaders();

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function json(res, status, data) {
  applyCors(res);

  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.end(JSON.stringify(data));
}

function method(req, res, allowed) {
  if (req.method === "OPTIONS") {
    applyCors(res);
    res.statusCode = 204;
    res.end();
    return false;
  }

  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));

    json(res, 405, {
      ok: false,
      error: "Method not allowed"
    });

    return false;
  }

  return true;
}

async function body(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "object") {
      return req.body;
    }

    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve, reject) => {
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
  });
}

module.exports = {
  corsHeaders,
  applyCors,
  json,
  method,
  body
};