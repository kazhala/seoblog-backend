const express = require("express");
const router = express();
const { runValidation } = require("../validators");
const { tagCreateValidator } = require("../validators/tag");
const { adminMiddleware, requireSignin } = require("../controllers/auth");
const { create, list, read, remove } = require("../controllers/tag");

router.post(
  "/tag",
  tagCreateValidator,
  runValidation,
  requireSignin,
  adminMiddleware,
  create
);

router.get("/tags", list);
router.get("/tag/:slug", read);
router.delete("/tag/:slug", requireSignin, adminMiddleware, remove);

module.exports = router;
