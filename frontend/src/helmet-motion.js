export const yawForPointer = x => x * .155
// Screen Y increases downwards. The GLB faces +Z, so positive X rotation looks downwards.
export const pitchForPointer = y => y * .115
