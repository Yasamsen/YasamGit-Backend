export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "YasamGit Backend",
    version: "5.2.0",
    status: "online"
  });
}