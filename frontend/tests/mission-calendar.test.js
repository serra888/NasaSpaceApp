import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarCells,demoDateForMission} from '../src/mission-calendar.js'
test('September 2026 starts on Tuesday and has 30 dates in a Monday-first grid',()=>{
 const dates=calendarCells(2026,8)
 assert.equal(dates[0],null)
 assert.equal(dates[1],'2026-09-01')
 assert.equal(dates.filter(Boolean).length,30)
 assert.equal(dates.length%7,0)
})
test('calendar handles leap years and rolling into a new year',()=>{
 assert.equal(calendarCells(2028,1).filter(Boolean).length,29)
 assert.equal(calendarCells(2026,12).find(Boolean),'2027-01-01')
})
test('the demo calendar starts at mission day one',()=>{
 assert.equal(demoDateForMission(1),'2026-09-18')
 assert.equal(demoDateForMission(2),'2026-09-19')
})
