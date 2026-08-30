module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: "YasamGit Backend",
    version: "5.2.0",
    message: "Backend berhasil terhubung ke Vercel"
  });
};