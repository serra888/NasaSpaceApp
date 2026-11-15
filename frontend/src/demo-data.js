// API integration seam: replace this mock store with a client that returns the same data shape.
const MOCK_KEY = 'orbitone.demo.v1'
export const startDay = 127
export const checkFields = [
  { key:'mood', name:'Mood', low:'Low', high:'Great' },
  { key:'stress', name:'Stress', low:'Calm', high:'High' },
  { key:'energy', name:'Energy', low:'Low', high:'High' },
  { key:'connection', name:'Sense of connection', low:'Isolated', high:'Connected' },
]
const sleepHours = [7.1,7.6,6.9,7.2,7.4,6.7,5.9]
export const history = sleepHours.map((sleep,i)=>({
  day:121+i, sleep, heart:[66,70,65,68,68,70,72][i],
  oxygen:[98,98,97,99,98,98,97][i], index:[86,89,85,90,88,85,82][i],
}))
const initial = {day:startDay, checkins:{}, dailyMissions:{}, closeouts:{}}
export function loadState(storage=globalThis.localStorage) {
  try {
    const data = JSON.parse(storage?.getItem(MOCK_KEY) ?? 'null')
    if (data && Number.isInteger(data.day) && data.day>=startDay && data.checkins && data.dailyMissions && data.closeouts) return data
  } catch {}
  return {...initial}
}
export function saveState(state,storage=globalThis.localStorage) {
  try { storage?.setItem(MOCK_KEY,JSON.stringify(state)); return !!storage } catch { return false }
}
export function getReadings(day) {
  if(day<=startDay) return history.filter(x=>x.day<=day)
  return [...history,...Array.from({length:day-startDay},(_,i)=>({
    day:startDay+i+1, sleep:[6.2,6.8,7.1,7.3][i%4], heart:[70,68,69,67][i%4],
    oxygen:[98,97,98,99][i%4], index:[84,86,87,90][i%4],
  }))]
}
export function validCheckin(values) {
  return checkFields.every(({key})=>Number.isInteger(values?.[key])&&values[key]>=1&&values[key]<=5)
}
export function moodIndex(values) {
  if(!validCheckin(values)) return null
  return Math.round((((values.mood+(6-values.stress)+values.energy+values.connection)/4)-1)*25)
}
export function sleepObservation(rows) {
  const r=rows.slice(-3)
  if(r.length<3||r.some(x=>!Number.isFinite(x.sleep))||r[1].day!==r[0].day+1||r[2].day!==r[1].day+1)
    return 'Not enough data to show a trend yet.'
  if(r[0].sleep>r[1].sleep&&r[1].sleep>r[2].sleep)
    return 'Your recorded sleep has decreased over the last three mission days.'
  if(r[0].sleep<r[1].sleep&&r[1].sleep<r[2].sleep)
    return 'Your recorded sleep has increased over the last three mission days.'
  return 'Your recorded sleep did not move consistently in one direction over the last three mission days.'
}
const mission=(id,tag,title,detail)=>({id,tag,title,detail,done:false})
export function suggestMissions(reading,checkin){
  return [
    reading?.sleep<6.5||checkin?.energy<=2
      ? mission('rest','Recovery','Make room for a quiet pause','Take five quiet minutes away from your screen.')
      : mission('reset','Recovery','Pause between tasks','Use a short break to reset before your next task.'),
    checkin?.connection<=2
      ? mission('crew','Connection','Check in with a crew member','Ask how their day is going and make time to listen.')
      : mission('crew','Connection','Share a small win','Share one thing that went well today with a crew member.'),
    checkin?.stress>=4||checkin?.mood<=2
      ? mission('reflect','Reflection','Write down one thing you can control','Pick a small, manageable action for the rest of your day.')
      : mission('reflect','Reflection','Log one small positive moment','A single sentence is enough.'),
  ]
}
