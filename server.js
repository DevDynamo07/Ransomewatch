import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { initStore, readStore, writeStore } from "./db.js";
import { evaluateEvents } from "./detection.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const id = () => crypto.randomUUID();

app.get("/api/health", (_, res) => res.json({ ok: true, service: "ransomware-awareness-api" }));

app.get("/api/dashboard", (_, res) => {
  const db = readStore();
  const events = db.events;
  const alerts = db.alerts;
  const reports = db.reports;
  const score = events.length ? evaluateEvents(events).score : 0;
  res.json({
    stats: {
      simulations: db.simulations.length,
      events: events.length,
      alerts: alerts.filter(a => a.status !== "resolved").length,
      detectionRate: reports.length ? Math.round(reports.reduce((a,r)=>a+r.detectionRate,0)/reports.length) : 0,
      readiness: Math.max(0, 100 - Math.round(score * 0.35))
    },
    threat: evaluateEvents(events),
    recentEvents: events.slice(-10).reverse(),
    recentAlerts: alerts.slice(-6).reverse()
  });
});

app.get("/api/simulations", (_, res) => res.json(readStore().simulations.slice().reverse()));
app.get("/api/events", (_, res) => res.json(readStore().events.slice().reverse()));
app.get("/api/alerts", (_, res) => res.json(readStore().alerts.slice().reverse()));
app.get("/api/reports", (_, res) => res.json(readStore().reports.slice().reverse()));

app.post("/api/simulations", (req, res) => {
  const db = readStore();
  const simulation = {
    id: id(),
    name: req.body.name || "Ransomware Behavior Simulation",
    scenario: req.body.scenario || "ransomware",
    status: "running",
    startedAt: new Date().toISOString(),
    eventCount: 0
  };
  db.simulations.push(simulation);
  writeStore(db);
  res.status(201).json(simulation);
});

app.post("/api/events", (req, res) => {
  const db = readStore();
  const event = {
    id: id(),
    simulationId: req.body.simulationId,
    type: req.body.type || "NORMAL_FILE_ACCESS",
    severity: req.body.severity || "LOW",
    message: req.body.message || "Synthetic event generated",
    source: req.body.source || "simulation-endpoint",
    timestamp: new Date().toISOString(),
    metadata: req.body.metadata || {}
  };
  db.events.push(event);

  const related = db.events.filter(e => e.simulationId === event.simulationId);
  const evaluation = evaluateEvents(related);

  if (evaluation.level === "HIGH" || evaluation.level === "CRITICAL") {
    const already = db.alerts.find(a => a.simulationId === event.simulationId && a.status !== "resolved");
    if (!already) {
      db.alerts.push({
        id: id(),
        simulationId: event.simulationId,
        title: evaluation.level === "CRITICAL" ? "Possible ransomware behavior detected" : "Suspicious activity detected",
        severity: evaluation.level,
        riskScore: evaluation.score,
        indicators: evaluation.indicators,
        status: "open",
        createdAt: new Date().toISOString()
      });
    }
  }

  const sim = db.simulations.find(s => s.id === event.simulationId);
  if (sim) sim.eventCount = related.length;
  writeStore(db);
  res.status(201).json({ event, evaluation });
});

app.post("/api/simulations/:id/complete", (req, res) => {
  const db = readStore();
  const sim = db.simulations.find(s => s.id === req.params.id);
  if (!sim) return res.status(404).json({ error: "Simulation not found" });

  const events = db.events.filter(e => e.simulationId === sim.id);
  const evaluation = evaluateEvents(events);
  const detected = events.filter(e => e.type !== "NORMAL_FILE_ACCESS").length;
  const detectionRate = events.length ? Math.round((detected / events.length) * 100) : 0;

  sim.status = "completed";
  sim.completedAt = new Date().toISOString();

  const report = {
    id: id(),
    simulationId: sim.id,
    simulationName: sim.name,
    durationSeconds: Math.max(1, Math.round((Date.parse(sim.completedAt)-Date.parse(sim.startedAt))/1000)),
    eventsGenerated: events.length,
    detectedIndicators: detected,
    detectionRate,
    riskScore: evaluation.score,
    threatLevel: evaluation.level,
    readiness: Math.max(0, 100 - Math.round(evaluation.score * 0.35)),
    generatedAt: new Date().toISOString()
  };
  db.reports.push(report);
  writeStore(db);
  res.json(report);
});

app.patch("/api/alerts/:id", (req, res) => {
  const db = readStore();
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  alert.status = req.body.status || alert.status;
  alert.updatedAt = new Date().toISOString();
  if (req.body.action) {
    db.responses.push({
      id: id(), alertId: alert.id, action: req.body.action,
      result: "SIMULATED_SUCCESS", timestamp: new Date().toISOString()
    });
  }
  writeStore(db);
  res.json(alert);
});

app.post("/api/demo/reset", (_, res) => {
  writeStore({ simulations: [], events: [], alerts: [], responses: [], reports: [] });
  res.json({ ok: true });
});

initStore().then(() => {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
});