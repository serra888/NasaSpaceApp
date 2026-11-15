import { useEffect, useRef } from 'react'
import {yawForPointer,pitchForPointer,stepHelmetMotion} from './helmet-motion'
import {helmetOutline,detailBox,heroImage} from './helmet-detail'
const clamp=n=>Math.max(-1,Math.min(1,n))
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
  const hero=useRef(null)
  const helmet=useRef(null)
  useHelmetTracking(hero,helmet)
  return <header ref={node=>{hero.current=node;heroRef.current=node}} id="top" className="hero">
    <div className="hero-haze" aria-hidden="true"/>
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
        <image className="astronaut-photo" href={heroImage} width="1672" height="941"/>
      </svg>
      <div className="helmet-stage-photo" aria-hidden="true">
        <PhotoHelmet layerRef={helmet}/>
      </div>
    </div>
    <div className="hero-copy">
      <div className="hero-side hero-side-left">
        <h1>You’re part of<br className="desktop-break"/> the mission, too.</h1>
      </div>
      <div className="hero-side hero-side-right">
        <p>Check in with yourself.<br/> See what’s changed.<br/> Take one small step.</p>
      </div>
    </div>
    <a className="scroll-cue" href="#status" aria-label="Scroll to today’s status"><Icon name="down" size={20}/></a>
  </header>
}


// Both layers reference the same source image. Nothing heavier loads on mouse entry.
function useHelmetTracking(heroRef,layerRef){
  useEffect(()=>{
    const hero=heroRef.current
    const layer=layerRef.current
    const capability=window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let frame=0,last=0,x=0,y=0,targetX=0,targetY=0,decoded=false,inView=true
    const source=new Image()
    source.src=heroImage
    source.decode().then(()=>{decoded=true}).catch(()=>{})
    function draw(now){
      frame=0
      const dt=last?now-last:1000/60
      last=now
      x=stepHelmetMotion(x,targetX,dt)
      y=stepHelmetMotion(y,targetY,dt)
      hero.toggleAttribute('data-tracking',x!==0||y!==0)
      layer.style.transform=x===0&&y===0?'':`perspective(620px) translate(${x*8}px,${y*6}px) rotateX(${-pitchForPointer(y)}rad) rotateY(${yawForPointer(x)}rad) rotateZ(${x*.027}rad)`
      if(x!==targetX||y!==targetY)frame=requestAnimationFrame(draw)
      else last=0
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
    function move(e){
      if(!decoded||!inView||!capability.matches||e.pointerType==='touch')return
      const b=hero.getBoundingClientRect()
      targetX=clamp((e.clientX-b.left)/b.width*2-1)
      targetY=clamp((e.clientY-b.top)/b.height*2-1)
      if(x!==targetX||y!==targetY)schedule()
    }
    function recenter(){targetX=0;targetY=0;if(x!==0||y!==0||frame)schedule()}
    function reset(){
      cancelAnimationFrame(frame)
      frame=last=x=y=targetX=targetY=0
      hero.removeAttribute('data-tracking')
      layer.style.transform=''
    }
    const visibility=new IntersectionObserver(([entry])=>{
      inView=entry.isIntersecting
      if(!inView)reset()
    })
    visibility.observe(hero)
    hero.addEventListener('pointermove',move,{passive:true})
    hero.addEventListener('pointerleave',recenter)
    capability.addEventListener('change',reset)
    document.addEventListener('visibilitychange',reset)
    return ()=>{
      reset()
      visibility.disconnect()
      hero.removeEventListener('pointermove',move)
      hero.removeEventListener('pointerleave',recenter)
      capability.removeEventListener('change',reset)
      document.removeEventListener('visibilitychange',reset)
    }
  },[heroRef,layerRef])
}
function PhotoHelmet({layerRef}){
  const {x,y,width,height}=detailBox
  return <svg ref={layerRef} className="photo-helmet" viewBox={`${x} ${y} ${width} ${height}`}>
    <defs><clipPath id="photo-helmet-outline"><path d={helmetOutline}/></clipPath></defs>
    <image href={heroImage} width="1672" height="941" clipPath="url(#photo-helmet-outline)"/>
  </svg>
}
