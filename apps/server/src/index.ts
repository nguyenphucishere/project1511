import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Placeholder route
app.get("/health", (_req, res) => {
  res.json({ status: "placeholder" });
});

const server = http.createServer(app);

// WebSocket server placeholder
const wss = new WebSocketServer({ server, path: "/sync" });

wss.on("connection", (_ws) => {
  // TODO: Implement connection and room synchronization
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
