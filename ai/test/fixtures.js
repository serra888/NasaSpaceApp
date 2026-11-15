export function backendContext() {
  return {
    contract_version: "1.0",
    astronaut_id: "orbiton-demo",
    mission_date: "2026-11-15",
    health: {
      value: 82,
      used_fields: ["heart_rate", "spo2", "sleep_hours"],
      missing_fields: [],
      calculated_at: "2026-11-15T09:00:00Z",
      observed_at: "2026-11-15T08:59:59Z",
      stale: false,
      is_demo: true
    },
    mood: {
      value: 56,
      used_fields: ["mood", "stress", "energy", "loneliness"],
      missing_fields: [],
      calculated_at: "2026-11-15T09:00:00Z",
      observed_at: "2026-11-15T08:58:00Z",
      stale: false,
      is_demo: true
    },
    latest_measurement: {
      id: "measurement-demo",
      astronaut_id: "orbiton-demo",
      measured_at: "2026-11-15T08:59:59Z",
      heart_rate: 72,
      spo2: 98,
      sleep_hours: 6.2,
      steps: 1200,
      body_temperature_c: 36.7,
      source: "simulator"
    },
    check_in: { mood: 3, stress: 4, energy: 2, loneliness: 3 },
    alerts: [],
    task_catalog: [
      { template_id: "quiet_rest", category: "rest", title: "Take a five-minute quiet rest break." },
      { template_id: "breathing_pause", category: "breathing", title: "Take a short breathing break." },
      { template_id: "positive_moment", category: "reflection", title: "Write down one positive moment." },
      { template_id: "crew_connection", category: "social", title: "Check in with a crew member." },
      { template_id: "medical_review", category: "medical_review", title: "Ask the medical team to review readings." }
    ],
    constraints: { task_count: 3, distinct_templates: true, no_diagnosis: true }
  };
}
