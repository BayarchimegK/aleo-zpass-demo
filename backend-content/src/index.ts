import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import contentRoutes from "./routes/content";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Aleo zPass Content Backend Running");
});

app.use("/content", contentRoutes);

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`Content backend running on port ${PORT}`);
});
