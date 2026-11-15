// Demo calendar anchor only. A backend-provided start date can replace it.
const anchor=Date.UTC(2026,8,18)
const dayMs=86_400_000
export function demoDateForMission(day){
  return new Date(anchor+(day-1)*dayMs).toISOString().slice(0,10)
}
export function calendarCells(year,month){
  const first = new Date(Date.UTC(year,month,1))
  const blanks=(first.getUTCDay()+6)%7
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate()
  const dates=Array.from({length:count},(_,i)=>new Date(Date.UTC(year,month,i+1)).toISOString().slice(0,10))
  return [...Array(blanks).fill(null),...dates,...Array((7-(blanks+count)%7)%7).fill(null)]
}
