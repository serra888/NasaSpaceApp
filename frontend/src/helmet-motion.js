export const yawForPointer = x => x * .155
// Screen Y increases downwards. The GLB faces +Z, so positive X rotation looks downwards.
export const pitchForPointer = y => y * .115

// Ease toward the pointer, then snap clear of subpixel drift and stop drawing.
export function stepHelmetMotion(current,target,elapsedMs){
  if(Math.abs(target-current)<.001)return target
  return current+(target-current)*(1-Math.exp(-8.5*Math.min(elapsedMs,50)/1000))
}
