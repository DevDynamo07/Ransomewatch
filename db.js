import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "store.json");

export async function initStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify({
      simulations: [], events: [], alerts: [], responses: [], reports: []
    }, null, 2));
  }

  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
      console.log("MongoDB connected");
      return "mongo";
    } catch {
      console.log("MongoDB unavailable; using local JSON store");
    }
  }
  return "json";
}

export function readStore() {
  return JSON.parse(fs.readFileSync(storeFile, "utf8"));
}

export function writeStore(data) {
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2));
}