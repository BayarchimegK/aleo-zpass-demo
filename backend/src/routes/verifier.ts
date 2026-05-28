import express from "express";

const router = express.Router();

router.post("/verify", async (req, res) => {
  try {
    const { proof } = req.body;

    const valid = typeof proof === "string" && proof.includes("true");

    res.json({
      valid,
    });
  } catch (err) {
    res.status(500).json({
      valid: false,
    });
  }
});

export default router;