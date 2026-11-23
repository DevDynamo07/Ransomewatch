const weights = {
  NORMAL_FILE_ACCESS: 2,
  SUSPICIOUS_PROCESS: 20,
  RAPID_FILE_MODIFICATION: 15,
  MASS_FILE_MODIFICATION: 35,
  RANSOM_NOTE_DETECTED: 45,
  BACKUP_ACTIVITY: -10
};

export function scoreEvent(event) {
  return weights[event.type] ?? 1;
}

export function evaluateEvents(events) {
  const score = Math.max(0, events.reduce((sum, e) => sum + scoreEvent(e), 0));
  let level = "LOW";
  if (score >= 80) level = "CRITICAL";
  else if (score >= 50) level = "HIGH";
  else if (score >= 25) level = "MEDIUM";

  const indicators = events
    .filter(e => ["SUSPICIOUS_PROCESS","MASS_FILE_MODIFICATION","RANSOM_NOTE_DETECTED"].includes(e.type))
    .map(e => e.type);

  return { score: Math.min(score, 100), level, indicators };
}