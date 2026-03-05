import express from "express";
import { usersContainer } from "./cosmos.js";

const router = express.Router();

// GET /leaderboard?limit=20  (PÚBLICO)
router.get("/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);

    const querySpec = {
      query: `
        SELECT TOP @limit
          c.userId, c.displayName, c.points, c.closedCount
        FROM c
        ORDER BY c.points DESC
      `,
      parameters: [{ name: "@limit", value: limit }],
    };

    const { resources } = await usersContainer.items
      .query(querySpec, { enableCrossPartitionQuery: true })
      .fetchAll();

    res.json(resources || []);
  } catch (err) {
    console.error("GET /leaderboard error:", err);
    res.status(500).json({ error: "leaderboard_failed" });
  }
});

export default router;