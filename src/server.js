import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { dispatch } from "./dispatcher.js";
import { getFleet, resetFleet, tick } from "./services/fleet.js";
import { getWeatherMap } from "./services/weather.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const publicDir = join(__dirname, "..", "public");

const zones = JSON.parse(readFileSync(join(dataDir, "zones.json"), "utf8"));

// In-memory state. Restart the server to reset everything.
let parcels = JSON.parse(readFileSync(join(dataDir, "parcels.json"), "utf8"));
let assignments = [];

const app = express();
app.use(express.json());
app.use(express.static(publicDir));

// --- Read endpoints --------------------------------------------------------

app.get("/api/parcels", (req, res) => res.json(parcels));
app.get("/api/drones", (req, res) => res.json(getFleet()));
app.get("/api/zones", (req, res) => res.json(zones));
app.get("/api/weather", (req, res) => res.json(getWeatherMap(zones)));
app.get("/api/assignments", (req, res) => res.json(assignments));

// --- Actions ---------------------------------------------------------------

// Run the dispatcher over all pending parcels.
app.post("/api/dispatch", (req, res) => {
  const created = dispatch(parcels);
  assignments.push(...created);
  res.status(201).json(created);
});

// Add a new parcel (handy for live demos).
app.post("/api/parcels", (req, res) => {
  const { weightKg, zoneId, priority = "STANDARD" } = req.body ?? {};
  if (typeof weightKg !== "number" || !zones.some((z) => z.id === zoneId)) {
    return res.status(400).json({ error: "weightKg (number) and a valid zoneId are required" });
  }
  const parcel = {
    id: `AWB-${1000 + parcels.length + 1}`,
    weightKg,
    zoneId,
    priority,
    createdAt: new Date().toISOString(),
    status: "PENDING",
  };
  parcels.push(parcel);
  res.status(201).json(parcel);
});

// Reset the whole simulation to seed data.
app.post("/api/reset", (req, res) => {
  parcels = JSON.parse(readFileSync(join(dataDir, "parcels.json"), "utf8"));
  assignments = [];
  resetFleet();
  res.json({ ok: true });
});

// --- Simulation loop -------------------------------------------------------

setInterval(tick, 3000);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`drone-dispatch listening on http://localhost:${PORT}`);
  console.log(`dashboard:                 http://localhost:${PORT}/`);
});
