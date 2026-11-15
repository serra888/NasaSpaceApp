import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {yawForPointer,pitchForPointer} from './helmet-motion'
import {helmetOutline,detailBox,heroImage} from './helmet-detail'
const clamp=n=>Math.max(-1,Math.min(1,n))
const LiveHelmet=lazy(()=>import('./LiveHelmet'))
export function Icon({name,size=20,...props}){
  const paths={orbit:<><circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-34 12 12)"/><circle cx="19" cy="6" r="1.3" fill="currentColor"/></>,
  down:<><path d="M12 4v14m-5-5 5 5 5-5"/></>, right:<path d="M4 12h15m-6-6 6 6-6 6"/>, heart:<path d="M2 12h5l2-6 4 12 3-6h6"/>,
  mood:<><circle cx="12" cy="12" r="9"/><path d="M8 14c2 3 6 3 8 0M9 9h.01M15 9h.01"/></>,
  check:<path d="m5 12 4 4L19 6"/>, clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
  close:<path d="m7 7 10 10M17 7 7 17"/>, expand:<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>, spark:<path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>,
  sleep:<path d="M19 15a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/>, crew:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-15a3 3 0 0 1 0 6m1 2a5 5 0 0 1 3 5v2"/></>, note:<path d="M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5"/>}
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
export default function Hero({heroRef}){
  const pointer=useRef({x:0,y:0})
  const [engaged,setEngaged]=useState(false)
  const [interactive,setInteractive]=useState(false)
  const [ready,setReady]=useState(false)
  const [gpu,setGpu]=useState(false)
  useEffect(()=>{
    if(!interactive){setGpu(false);return}
    try{
      const ctx=document.createElement('canvas').getContext('webgl2')
      setGpu(!!ctx)
      ctx?.getExtension('WEBGL_lose_context')?.loseContext()
    }catch{setGpu(false)}
  },[interactive])
  useEffect(()=>{
    const capability=window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    const update=()=>{setInteractive(capability.matches);if(!capability.matches){setEngaged(false);pointer.current={x:0,y:0}}}
    update()
    capability.addEventListener('change',update)
    return ()=>capability.removeEventListener('change',update)
  },[])
  function move(e){
    if(!interactive||e.pointerType==='touch')return
    setEngaged(true)
    const b=e.currentTarget.getBoundingClientRect()
    pointer.current={x:clamp((e.clientX-b.left)/b.width*2-1),y:clamp((e.clientY-b.top)/b.height*2-1)}
  }
  const tracking=interactive&&engaged&&ready
  return <header ref={heroRef} id="top" className="hero" data-helmet={tracking?(gpu?'3d':'photo'):'still'} onPointerMove={move} onPointerLeave={()=>{pointer.current={x:0,y:0}}}>
    <div className="hero-haze" aria-hidden="true"/>
    <a className="brand" href="#top" aria-label="Orbitone home"><Icon name="orbit" size={25}/> ORBITONE</a>
    <span className="hero-watermark" aria-hidden="true">ORBITONE</span>
    <div className="portrait" aria-label="Waist-up astronaut with a reflective gold visor" role="img">
      <svg className="portrait-img" viewBox="529 150 614 640" aria-hidden="true">
        <defs>
          <mask id="suit-mask" maskUnits="userSpaceOnUse" x="529" y="150" width="614" height="640">
            <path fill="white" d="M529 150h614v640H529z"/>
            <path fill="black" d={helmetOutline}/>
          </mask>
          <radialGradient id="suit-shadow"><stop stopColor="#050508"/><stop offset=".86" stopColor="#141319"/><stop offset="1" stopColor="#241f23"/></radialGradient>
        </defs>
        <rect x="700" y="180" width="280" height="294" fill="url(#suit-shadow)"/>
        <image href={heroImage} width="1672" height="941" mask={tracking?'url(#suit-mask)':undefined}/>
      </svg>
      {interactive&&engaged&&<div className={'helmet-stage'+(gpu?'':' helmet-stage-photo')} data-ready={tracking} aria-hidden="true">
        {gpu?<Suspense fallback={null}><LiveHelmet pointer={pointer} onReady={setReady} onError={()=>{setReady(false);setGpu(false)}}/></Suspense>:<PhotoHelmet pointer={pointer} onReady={setReady}/>}
      </div>}
    </div>
    <div className="hero-copy">
      <h1>You’re part of<br className="desktop-break"/> the mission, too.</h1>
      <p>Check in with yourself.<br/> See what’s changed.<br/> Take one small step.</p>
    </div>
    <a className="scroll-cue" href="#status" aria-label="Scroll to today’s status"><Icon name="down" size={20}/></a>
  </header>
}


// No WebGL: turn a single sharp copy of the original visor, without blending multiple images.
function PhotoHelmet({pointer,onReady}) {
  const ref=useRef()
  useEffect(()=>{
    const layer=ref.current
    let frame=0, last=0, x=0, y=0
    function draw(now){
      const blend=1-Math.exp(-5.2*Math.min((now-(last||now))/1000,.08))
      last=now
      x+=(pointer.current.x-x)*blend
      y+=(pointer.current.y-y)*blend
      const pitch=pitchForPointer(y), yaw=yawForPointer(x)
      layer.style.transform=`perspective(620px) translate(${x*8}px,${y*6}px) rotateX(${-pitch}rad) rotateY(${yaw}rad) rotateZ(${x*.027}rad)`
      layer.dataset.yaw=yaw.toFixed(3)
      layer.dataset.pitch=pitch.toFixed(3)
      frame=requestAnimationFrame(draw)
    }
    let active=true
    const source=new Image()
    source.onload=()=>{if(active){frame=requestAnimationFrame(draw);onReady(true)}}
    source.src=heroImage
    return ()=>{active=false;cancelAnimationFrame(frame);onReady(false)}
  },[pointer,onReady])
  const {x,y,width,height}=detailBox
  return <svg ref={ref} className="photo-helmet" viewBox={`${x} ${y} ${width} ${height}`} style={{width:'100%',height:'100%'}}>
    <defs><clipPath id="photo-helmet-outline"><path d={helmetOutline}/></clipPath></defs>
    <image href={heroImage} width="1672" height="941" clipPath="url(#photo-helmet-outline)"/>
  </svg>
}
