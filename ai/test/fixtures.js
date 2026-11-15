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

export function backendContextV11() {
  const legacy = backendContext();
  return {
    ...legacy,
    contract_version: "1.1",
    trend_summary: {
      window_days: 3,
      sleep: "decreasing",
      mood: "stable",
      stress: "increasing",
      energy: "decreasing",
      connection: "insufficient_data"
    },
    task_catalog: [
      {
        template_id: "earth_gaze_reset",
        category: "recovery",
        title: "Take a two-minute Earth-view or quiet-view reset when available.",
        duration_minutes: 2,
        intensity: "low",
        reason_codes: ["high_stress", "protect_energy", "short_sleep"]
      },
      {
        template_id: "crew_voice_checkin",
        category: "social",
        title: "Share a short voice check-in with a crew member.",
        duration_minutes: 5,
        intensity: "low",
        reason_codes: ["low_connection", "support_mood"]
      },
      {
        template_id: "single_priority_block",
        category: "focus",
        title: "Choose one priority for the next work block.",
        duration_minutes: 3,
        intensity: "low",
        reason_codes: ["protect_energy", "support_focus", "balanced_day"]
      },
      {
        template_id: "hydration_reminder",
        category: "hydration",
        title: "Set a reminder for your existing mission-approved hydration schedule.",
        duration_minutes: 2,
        intensity: "low",
        reason_codes: ["balanced_day", "support_focus"]
      },
      {
        template_id: "medium_demo_task",
        category: "focus",
        title: "A non-selectable medium-intensity test task.",
        duration_minutes: 12,
        intensity: "medium",
        reason_codes: ["support_focus"]
      }
    ],
    reason_catalog: [
      { reason_code: "short_sleep", description: "Recent sleep is short or decreasing." },
      { reason_code: "high_stress", description: "Reported stress is high or increasing." },
      { reason_code: "protect_energy", description: "Keep this action short and low intensity." },
      { reason_code: "low_connection", description: "Support a small moment of crew connection." },
      { reason_code: "support_mood", description: "Support reported mood with a small action." },
      { reason_code: "support_focus", description: "Support a bounded next work block." },
      { reason_code: "balanced_day", description: "Provide a balanced preventive action." }
    ],
    constraints: {
      task_count: 3,
      distinct_templates: true,
      no_diagnosis: true,
      max_duration_minutes: 10,
      allowed_intensities: ["low"]
    }
  };
}
