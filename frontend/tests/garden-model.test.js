import test from 'node:test'
import assert from 'node:assert/strict'
import {changeSelection,includeAssigned,newPlan,plantImage,plantOptions,plantStates,selectedMissions} from '../src/garden-model.js'
import {access} from 'node:fs/promises'
const assigned=['a','b','c'].map(id=>({id,assigned:true}))
test('the three assigned missions are always active and cannot be removed',()=>{
 const plan=includeAssigned(newPlan,assigned)
 assert.deepEqual(plan.chosen,['a','b','c'])
 assert.equal(changeSelection(plan,'b',assigned),plan)
 assert.deepEqual(selectedMissions(newPlan,assigned).map(task=>task.id),['a','b','c'])
})
test('optional missions fill at most two slots and can be removed',()=>{
 let plan=changeSelection(newPlan,'d',assigned)
 plan=changeSelection(plan,'e',assigned)
 assert.equal(plan.chosen.length,5)
 assert.equal(changeSelection(plan,'f',assigned),plan)
 plan=changeSelection({...plan,checked:{d:true}},'d',assigned)
 assert.equal(plan.checked.d,false)
 assert.deepEqual(plan.chosen,['a','b','c','e'])
})
test('calendar gets the same assignments and completion state as Garden',()=>{
 const candidates=[...assigned,{id:'d',title:'Stretch'},{id:'e',title:'Custom'}]
 const result=selectedMissions({...newPlan,chosen:['e'],checked:{b:true,e:true}},candidates)
 assert.deepEqual(result.map(({id,done})=>[id,done]),[['a',false],['b',true],['c',false],['e',true]])
})
test('all five server-selectable shades exist for each of the three plants',async()=>{
 for(const plant of plantOptions)
  for(let stage=0;stage<plantStates.length;stage++)
   await access(new URL('../public'+plantImage(plant.id,stage),import.meta.url))
})
