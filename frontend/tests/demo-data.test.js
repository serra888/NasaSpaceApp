import test from 'node:test'
import assert from 'node:assert/strict'
import {getReadings,moodIndex,validCheckin,sleepObservation,suggestMissions,loadState,saveState} from '../src/demo-data.js'
test('a missing mood is unknown and stress contributes in reverse',()=>{
  assert.equal(moodIndex(null),null)
  assert.equal(validCheckin({mood:9,stress:1,energy:5,connection:5}),false)
  assert.equal(moodIndex({mood:5,stress:1,energy:5,connection:5}),100)
  assert.equal(moodIndex({mood:1,stress:5,energy:1,connection:1}),0)
})
test('sleep observation requires three consecutive genuine records',()=>{
  assert.match(sleepObservation(getReadings(127)),/decreased/)
  assert.match(sleepObservation([{day:1,sleep:7},{day:3,sleep:6},{day:4,sleep:5}]),/Not enough/)
  assert.match(sleepObservation(getReadings(130)),/increased/)
})
test('three distinct tasks are personalized by a saved check-in',()=>{
  const tasks=suggestMissions({sleep:7},{mood:2,stress:4,energy:2,connection:1})
  assert.equal(new Set(tasks.map(x=>x.id)).size,3)
  assert.match(tasks[0].title,/quiet pause/)
  assert.match(tasks[1].title,/crew member/)
  assert.match(tasks[2].title,/you can control/)
})
test('local persistence and simulated day advancement',()=>{
  let raw=null
  const storage={getItem:()=>raw,setItem:(_,s)=>{raw=s}}
  const state=loadState(storage)
  assert.equal(state.day,127)
  state.day++
  saveState(state,storage)
  assert.equal(loadState(storage).day,128)
  assert.equal(getReadings(128).at(-1).day,128)
})
