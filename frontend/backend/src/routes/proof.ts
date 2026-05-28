import express from 'express';

import { AleoService } from "../services/aleo.service";

const router = express.Router();

router.post(
  '/generate',
  async (req, res) => {

    try {

      const { age } = req.body;

      const result = await AleoService.generateProof(age);

      res.json({

        success: true,

        valid: result.valid,

        proof: result.raw
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({

        success: false,

        error: String(err)
      });
    }
  }
);

export default router;