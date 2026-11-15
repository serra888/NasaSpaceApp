import test from 'node:test'
import assert from 'node:assert/strict'
import {api,checkInPayload,missionItem,chartHistory} from '../src/api.js'
test('connection is inverted for backend loneliness',()=>{
 assert.deepEqual(checkInPayload({mood:2,stress:4,energy:2,connection:5,note:'private'}),{mood:2,stress:4,energy:2,loneliness:1})
 assert.equal(checkInPayload({connection:1}).loneliness,5)
})
test('tasks preserve server identity and completion',()=>{
 const item=missionItem({id:'uuid',completed:true,category:'medical_review',source:'fallback',title:'Review'})
 assert.equal(item.id,'uuid');assert.equal(item.done,true);assert.equal(item.tag,'medical review')
})
test('charts preserve missing days rather than fabricate zero readings',()=>{
 const rows=chartHistory([{timestamp:'2026-11-15T00:00:00Z',sleep_hours:null,mood:25}],'2026-11-15')
 assert.equal(rows.length,7);assert.equal(rows[0].day,'2026-11-09');assert.equal(rows[0].mood,undefined);assert.equal(rows[6].sleep,null);assert.equal(rows[6].mood,25)
})
test('client uses PATCH and exposes server errors',async()=>{
 const previous=globalThis.fetch
 try{
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/v1/todos/task');assert.equal(options.method,'PATCH');assert.equal(options.body,'{"completed":true}');return {ok:true,json:async()=>({completed:true})}}
 assert.deepEqual(await api('/todos/task',{completed:true},'PATCH'),{completed:true})
 globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({error:{message:'Database unavailable.'}})})
 await assert.rejects(api('/status'),/Database unavailable/)
 }finally{globalThis.fetch=previous}
})
