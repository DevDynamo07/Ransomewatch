import argparse
import json
import time
import urllib.request
import urllib.error
import uuid

# SAFE EDUCATIONAL SIMULATOR:
# These events are synthetic. This program NEVER creates, encrypts, deletes,
# renames, or modifies user files and never performs real network propagation.

SCENARIOS = {
    "ransomware": [
        ("NORMAL_FILE_ACCESS", "LOW", "Synthetic document access observed", "Endpoint WS-042", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic suspicious process started", "Endpoint WS-042", 1),
        ("RAPID_FILE_MODIFICATION", "MEDIUM", "Synthetic rapid file modification pattern observed", "File System", 1),
        ("MASS_FILE_MODIFICATION", "HIGH", "Synthetic burst of file modifications detected", "File System", 1),
        ("RANSOM_NOTE_DETECTED", "CRITICAL", "Synthetic ransom-note indicator detected", "Endpoint WS-042", 1),
    ],
    "phishing": [
        ("NORMAL_FILE_ACCESS", "LOW", "Synthetic phishing email attachment opened", "Mail Gateway", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic suspicious child process launched", "Endpoint WS-017", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic script interpreter activity detected", "Endpoint WS-017", 1),
    ],
    "lateral": [
        ("NORMAL_FILE_ACCESS", "LOW", "Synthetic internal host discovery observed", "Network Sensor", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic credential access pattern detected", "Endpoint WS-031", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic new internal host communication observed", "Network Sensor", 1),
        ("MASS_FILE_MODIFICATION", "HIGH", "Synthetic lateral propagation threshold exceeded", "Network Sensor", 1),
    ],
    "exfiltration": [
        ("NORMAL_FILE_ACCESS", "LOW", "Synthetic sensitive-file access observed", "Endpoint WS-055", 1),
        ("RAPID_FILE_MODIFICATION", "MEDIUM", "Synthetic archive staging activity observed", "Endpoint WS-055", 1),
        ("SUSPICIOUS_PROCESS", "HIGH", "Synthetic unusual outbound transfer pattern detected", "Network Sensor", 1),
    ],
    "backup": [
        ("BACKUP_ACTIVITY", "LOW", "Synthetic backup completed successfully", "Backup Node", 1),
        ("NORMAL_FILE_ACCESS", "LOW", "Synthetic routine file access observed", "Endpoint WS-009", 1),
    ],
}

def post(url, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.loads(response.read().decode())

def main():
    parser = argparse.ArgumentParser(description="RansomWatch safe synthetic attack simulator")
    parser.add_argument("--url", default="http://localhost:5000")
    parser.add_argument("--scenario", choices=SCENARIOS.keys(), default="ransomware")
    parser.add_argument("--delay", type=float, default=None,
                        help="Override delay between synthetic events in seconds")
    args = parser.parse_args()

    scenario_name = args.scenario
    sim = post(args.url + "/api/simulations", {
        "name": "Safe " + scenario_name.title() + " Simulation",
        "scenario": scenario_name,
    })

    print(f"Simulation started: {sim['id']}")
    print(f"Scenario: {scenario_name.upper()}")
    print("SAFE MODE: synthetic telemetry only; no real files are touched.\n")

    for event_type, severity, message, source, delay in SCENARIOS[scenario_name]:
        result = post(args.url + "/api/events", {
            "simulationId": sim["id"],
            "type": event_type,
            "severity": severity,
            "message": message,
            "source": "safe-simulator",
            "metadata": {
                "synthetic": True,
                "eventId": str(uuid.uuid4()),
                "sourceNode": source,
            },
        })
        evaluation = result["evaluation"]
        print(f"[{severity:8}] {message:<62} risk={evaluation['score']:>3} level={evaluation['level']}")
        time.sleep(args.delay if args.delay is not None else delay)

    report = post(args.url + f"/api/simulations/{sim['id']}/complete", {})
    print("\n=== SIMULATION REPORT ===")
    print(json.dumps(report, indent=2))
    print("\nSimulation finished safely.")

if __name__ == "__main__":
    main()
