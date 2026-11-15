const base = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')
export async function api(path, body, method = 'POST') {
  const response = await fetch(`${base}/api/v1${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: body === undefined ? {} : {'Content-Type': 'application/json'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(error?.error?.message || `Request failed (${response.status}).`)
  }
  return response.json()
}
export function checkInPayload(form) {
  return {mood: form.mood, stress: form.stress, energy: form.energy, loneliness: 6 - form.connection}
}
export function missionItem(task) {
  return {...task, done: task.completed, tag: task.category.replaceAll('_', ' '), detail: `Source: ${task.source}`}
}
export function chartHistory(points, today) {
  const end = Date.parse(`${today}T00:00:00Z`)
  return Array.from({length: 7}, (_, i) => {
    const date = new Date(end - (6-i)*86400000).toISOString().slice(0,10)
    const point = points.find(p => p.timestamp.slice(0,10) === date)
    return {day: date, sleep: point?.sleep_hours, mood: point?.mood}
  })
}
