import test from 'node:test'
import assert from 'node:assert/strict'
import {Vector3} from 'three'
import {yawForPointer,pitchForPointer} from '../src/helmet-motion.js'
test('GLB faces up for a pointer above center, down below center',()=>{
  const look = y => new Vector3(0,0,1).applyAxisAngle(new Vector3(1,0,0),pitchForPointer(y)).y
  assert.ok(look(-1)>0)
  assert.ok(look(1)<0)
  assert.equal(look(0),0)
})
test('horizontal tracking keeps the original left-to-right movement',()=>{
  assert.deepEqual([-1,0,1].map(yawForPointer),[-.155,0,.155])
})
