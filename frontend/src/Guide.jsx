import {useRef,useState} from 'react'
import {Icon} from './Hero'

const model='https://sketchfab.com/3d-models/mercenary-astronaut-7fd399d488ae4576a0fc62715892956c'
const embed='https://sketchfab.com/models/7fd399d488ae4576a0fc62715892956c/embed?autostart=1&animation_autoplay=0&ui_animations=0&ui_theme=dark&dnt=1'
const creator='https://sketchfab.com/better_peter'
const license='https://creativecommons.org/licenses/by/4.0/'
const poster='/media/mercenary-astronaut-poster.webp'

export function Guide({visible,message,action,open,setOpen}){
  const [minimized,setMinimized]=useState(false)
  const [showViewer,setShowViewer]=useState(false)
  const frameRef=useRef(null)
  if(!visible)return null

  function followAction(e){
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return
    const target=document.getElementById(action.target)
    if(!target)return
    e.preventDefault()
    if(matchMedia('(max-width:1023px)').matches)setMinimized(true)
    target.focus({preventScroll:true})
    target.scrollIntoView({block:'start'})
    if(location.hash!=='#'+action.target)history.pushState(null,'','#'+action.target)
  }
  function toggleModel(){
    if(!showViewer) requestAnimationFrame(()=>frameRef.current?.focus({preventScroll:true}))
    setShowViewer(v=>!v)
  }

  return <aside className="guide" data-minimized={minimized} aria-label="Mission companion">
    {minimized&&open&&message&&<p className="sr-only" role="status">{message}</p>}
    {minimized?<button type="button" className="companion-launch" aria-expanded={false} onClick={()=>setMinimized(false)}>
      <Icon name="orbit" size={21}/><span>Mission companion</span>{open&&message&&<i aria-label="New message"/>}<Icon name="expand" size={15}/>
    </button>:<div className="companion-console">
      <div className="companion-top">
        <span className="micro accent"><i/> MISSION COMPANION</span>
        <button type="button" className="icon-button" aria-label="Minimize mission companion" onClick={()=>setMinimized(true)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 12h14"/></svg>
        </button>
      </div>
      {open&&message?<div className="speech">
        <div className="speech-content">
          <p role="status">{message}</p>
          {action&&<a className="button primary companion-cta" href={'#'+action.target} onClick={followAction}>{action.label}<Icon name="right" size={15}/></a>}
        </div>
        <button type="button" className="icon-button" aria-label="Dismiss message" onClick={()=>setOpen(false)}><Icon name="close" size={16}/></button>
      </div>:message&&<button type="button" className="companion-replay" onClick={()=>setOpen(true)}>Replay last message <Icon name="right" size={14}/></button>}
      <figure>
        <div className="companion-stage">
          {showViewer?<iframe ref={frameRef} className="sketchfab" src={embed} title="Mercenary Astronaut interactive 3D viewer" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={()=>setShowViewer(false)}/>
          :<div className="companion-preview"><img src={poster} alt="Mercenary Astronaut by Peter_D" width="760" height="648"/></div>}
        </div>
        <figcaption className="companion-credit">
          <a href={model} target="_blank" rel="noreferrer">Mercenary Astronaut</a> by{' '}
          <a href={creator} target="_blank" rel="noreferrer">Peter_D</a> ·{' '}
          <a href={license} target="_blank" rel="noreferrer">CC BY 4.0</a>
        </figcaption>
      </figure>
      <div className="companion-actions">
        <button type="button" className="companion-source" aria-pressed={showViewer} onClick={toggleModel}>{showViewer?'Back to portrait':'Explore in 3D'} <Icon name={showViewer?'close':'expand'} size={13}/></button>
        <a className="companion-source" href={model} target="_blank" rel="noreferrer">Open in Sketchfab <Icon name="right" size={13}/></a>
      </div>
    </div>}
  </aside>
}
