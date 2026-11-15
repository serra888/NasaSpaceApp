import React,{useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import Hero,{Icon} from './Hero'
import TrendChart from './Charts'
import {Guide} from './Guide'
import {checkFields,getReadings,loadState,moodIndex,saveState,sleepObservation,suggestMissions,validCheckin} from './demo-data'
import './style.css'

const copy={
 welcome:'How are you feeling today? Check in to get three small missions for your day.',
 returning:'How are you feeling today? Check in to get three small missions for your day.',
 energy:'Check-in saved. You reported low energy, so I picked a quieter first step. Choose one of your three missions.',
 ready:'Check-in saved. Your Mood is updated and your three missions are ready. Pick one to start.',
 updated:'Check-in updated. Your Mood and trend now reflect your new answers. Your missions are unchanged.',
 trend:'You logged less sleep on each of the last three mission days. Want to see the trend?',
 logged:'Logged. That’s one thing you did for yourself today.',
 review:'Time to log the day. What did you get done? It’s okay to leave some boxes unchecked.',
 next:'New mission day. Check in to update your Mood and get today’s three missions.',
}
const checkInAction={label:'Check in now',target:'daily-check-in'}
const missionsAction={label:'View today’s missions',target:'missions'}
const companionActions={
 welcome:checkInAction,returning:checkInAction,next:checkInAction,
 energy:missionsAction,ready:missionsAction,updated:missionsAction,
 trend:{label:'View sleep trend',target:'sleep-trend'},
}
const SectionCap=({n,children})=><div className="section-cap micro"><span>{n}</span><i/>{children}</div>
const cleanForm={mood:null,stress:null,energy:null,connection:null,note:''}
function StatusCard({name,icon,value,label,missing,theme}){
  return <article className={'panel status-card '+theme}>
    <div className="status-top"><span className="status-icon"><Icon name={icon} size={22}/></span><span className="mini-label">{label}</span></div>
    <h3>{name}</h3>
    {value===null?<p className="no-data">{missing}</p>:<p className="score">{value}<span>/ 100</span></p>}
    <div className="meter" role={value===null?undefined:'meter'} aria-label={value===null?undefined:name+' score'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value??undefined}><span style={{width:(value??0)+'%'}}/></div>
  </article>
}
function Rating({field,value,onChange}){
 return <fieldset className="rating">
   <legend>{field.name}</legend>
   <div className="rating-buttons">{[1,2,3,4,5].map(n=><label key={n}><input type="radio" name={field.key} value={n} checked={value===n} required onChange={()=>onChange(n)}/><span>{n}</span></label>)}</div>
   <div className="scale-labels"><span>{field.low}</span><span>{field.high}</span></div>
 </fieldset>
}
function App(){
 const [state,setState]=useState(loadState)
 const [form,setForm]=useState(()=>state.checkins[state.day]||cleanForm)
 const [feedback,setFeedback]=useState('')
 const [reviewOpen,setReviewOpen]=useState(false)
 const [visible,setVisible]=useState(false)
 const [open,setOpen]=useState(false)
 const [messageEvent,setMessageEvent]=useState(()=>{
   try {
     const last=JSON.parse(localStorage.getItem('orbitone.companion.v1')||'null')
     if(last?.day===state.day&&state.checkins[state.day])return copy[last.event]?last.event:''
   }catch{}
   return ''
 })
 const message=copy[messageEvent]||''
 const heroRef=useRef(null), observationRef=useRef(null)
 const previousVisit=useRef(false)
 const seen=useRef(new Set())
 const priority=useRef(0)
 const day=state.day
 const checkin=state.checkins[day]
 const rows=getReadings(day)
 const reading=rows.at(-1)
 const missions=state.dailyMissions[day]?.items||[]
 const lead=state.dailyMissions[day]?.lead
 const done=missions.filter(x=>x.done).length
 const recap=state.closeouts[day]
 const observation=sleepObservation(rows)
 const days=Array.from({length:7},(_,i)=>day-6+i)
 function speak(event,direct=false,eventDay=day){
   const key=eventDay+':'+event
   if(!direct&&(seen.current.has(key)||Date.now()-priority.current<4500))return
   if(direct)priority.current=Date.now()
   seen.current.add(key)
   setMessageEvent(event);setOpen(true)
   try{localStorage.setItem('orbitone.companion.v1',JSON.stringify({day:eventDay,event}))}catch{}
 }
 useEffect(()=>{
   try{previousVisit.current=localStorage.getItem('orbitone.visit.v1')==='1';localStorage.setItem('orbitone.visit.v1','1')}catch{}
   function checkHero(){setVisible((heroRef.current?.getBoundingClientRect().bottom??1)<=0)}
   checkHero()
   addEventListener('scroll',checkHero,{passive:true})
   addEventListener('resize',checkHero)
   return ()=>{removeEventListener('scroll',checkHero);removeEventListener('resize',checkHero)}
 },[])
 useEffect(()=>{
   if(visible&&!checkin&&!message)speak(previousVisit.current?'returning':'welcome')
 },[visible,checkin,message,day])
 useEffect(()=>{
   if(!visible||!observation.includes('has decreased'))return
   const watcher=new IntersectionObserver(([entry])=>{
     if(entry.isIntersecting)speak('trend')
   },{threshold:.46})
   if(observationRef.current)watcher.observe(observationRef.current)
   return ()=>watcher.disconnect()
 },[visible,day,observation])
 useEffect(()=>{
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
   const nodes=document.querySelectorAll('[data-reveal]')
   const watcher=new IntersectionObserver(entries=>{
     for(const item of entries)if(item.isIntersecting){
       item.target.classList.add('in-view')
       watcher.unobserve(item.target)
     }
   },{threshold:.14})
   nodes.forEach(n=>watcher.observe(n))
   return ()=>watcher.disconnect()
 },[])
 function commit(next){
   if(!saveState(next)){setFeedback('Unable to save to this browser. Please allow local storage and try again.');return false}
   setState(next);return true
 }
 function submit(e){
   e.preventDefault()
   if(!validCheckin(form)){setFeedback('Choose a score from 1 to 5 for every field.');return}
   const next={...state,checkins:{...state.checkins,[day]:{...form,note:(form.note||'').trim()}},dailyMissions:{...state.dailyMissions,[day]:state.dailyMissions[day]||{items:suggestMissions(reading,form),lead:null}}}
   if(commit(next)){
     setFeedback('Check-in saved. Your Mood and trend have been updated.')
     speak(missions.length?'updated':form.energy<=2?'energy':'ready',true)
   }
 }
 function setLead(id){
   const current=state.dailyMissions[day]
   commit({...state,dailyMissions:{...state.dailyMissions,[day]:{...current,lead:id}}})
 }
 function toggle(item){
   const current=state.dailyMissions[day]
   const items=current.items.map(x=>x.id===item.id?{...x,done:!x.done}:x)
   const closeouts={...state.closeouts}
   if(closeouts[day])delete closeouts[day]
   if(commit({...state,dailyMissions:{...state.dailyMissions,[day]:{...current,items}},closeouts})&&!item.done)speak('logged',true)
 }
 function showReview(){
   setReviewOpen(v=>!v)
   if(!reviewOpen&&missions.length&&done<missions.length)speak('review',true)
 }
 function saveReview(){
   commit({...state,closeouts:{...state.closeouts,[day]:{done,total:missions.length}}})
 }
 function advance(){
   const nextDay=day+1
   if(commit({...state,day:nextDay})){setForm(cleanForm);setFeedback('');setReviewOpen(false);speak('next',true,nextDay)}
 }
 return <>
  <a className="skip" href="#status">Skip to mission status</a>
  <Hero heroRef={heroRef}/>
  <main className="starfield">
   <div className="mission-layout">
   <div className="mission-content">
   <section className="section section-status" id="status">
    <SectionCap n="01">FLIGHT STATUS</SectionCap>
    <div className="heading-row" data-reveal><div><h2>Today’s status.</h2><p>A moment to check in with the person behind the suit.</p></div><span className="day-chip micro"><i/> Mission Day {day}</span></div>
    <div className="status-grid" data-reveal>
      <StatusCard name="Health" icon="heart" value={reading?.index??null} label="Demo index" missing="No health summary yet" theme="health"/>
      <StatusCard name="Mood" icon="mood" value={moodIndex(checkin)} label="Self-reported" missing="No check-in yet" theme="mood"/>
    </div>
    <p className="telemetry micro"><i/> SIMULATED TELEMETRY {reading&&<span>· {reading.heart} BPM · SpO₂ {reading.oxygen}%</span>}</p>
    <form className="panel checkin" onSubmit={submit} aria-labelledby="daily-check-in">
      <div><span className="micro accent">PERSONAL LOG / {day}</span><h3 id="daily-check-in" tabIndex={-1}>Daily check-in</h3><p>How are you feeling right now? Choose one answer on each scale.</p></div>
      <div className="ratings-grid">{checkFields.map(field=><Rating key={field.key} field={field} value={form[field.key]} onChange={n=>{setForm({...form,[field.key]:n});setFeedback('')}}/>)}</div>
      <label className="note-label">Short note <span>Optional · stored on this device</span><textarea name="note" maxLength={320} rows={3} placeholder="Anything you’d like to remember?" value={form.note||''} onChange={e=>{setForm({...form,note:e.target.value});setFeedback('')}}/></label>
      <div className="form-end"><button type="submit" className="button primary">Save Check-in <Icon name="right" size={17}/></button><span role="status" className={feedback.startsWith('Check-in')?'saved':'error'}>{feedback}</span></div>
    </form>
   </section>
   <section className="section section-insight" id="insight" ref={observationRef}>
     <SectionCap n="02">ONE OBSERVATION</SectionCap>
     <div data-reveal><h2>What changed?</h2><p className="observation">{observation}</p><a href="#sleep-trend" className="text-link" onClick={()=>requestAnimationFrame(()=>document.getElementById('sleep-trend')?.focus({preventScroll:true}))}>View sleep trend <Icon name="right" size={18}/></a></div>
   </section>
   <section className="section section-missions" id="missions" tabIndex={-1}>
     <SectionCap n="03">SMALL STEPS</SectionCap>
     <div className="heading-row" data-reveal><div><h2>Today’s missions.</h2><p>Pick one to start. The rest can wait.</p></div>{!!missions.length&&<span className="day-chip micro" aria-live="polite">{done} of 3 completed</span>}</div>
     {missions.length===0?<div className="panel empty-missions"><Icon name="spark" size={26}/><p>Your missions will appear after you save today’s check-in.</p><a className="text-link" href="#status">Go to daily check-in <Icon name="right" size={16}/></a></div>:
     <><div className="mission-grid" data-reveal>{missions.map((item,i)=><article className={'panel mission-card '+(lead===item.id?'selected':'')} key={item.id} style={{'--delay':i*65+'ms'}}>
       <div className="mission-label"><span className="micro">MISSION / 0{i+1}</span><Icon name={['sleep','crew','note'][i]} size={23}/></div>
       <span className="mission-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.detail}</p>
       <details><summary>Why this mission?</summary><p>{item.id==='rest'?'Recent simulated sleep or your reported energy prompted a gentler option.':item.id==='crew'?'This is a small way to make room for social connection.':item.id==='reflect'?'A short reflection helps turn a check-in into one concrete step.':'Short pauses create space between demanding tasks.'}</p></details>
       <div className="mission-actions"><button type="button" className="button outline" aria-pressed={lead===item.id} onClick={()=>setLead(item.id)}>{lead===item.id?'Starting here':'Start here'}</button><button type="button" className={'button '+(item.done?'complete':'muted')} aria-pressed={item.done} onClick={()=>toggle(item)}>{item.done?<><Icon name="check" size={16}/> Completed</>:'Mark complete'}</button></div>
     </article>)}</div>
     {done===3&&<p className="all-done" role="status">All three missions complete. Nice work looking after yourself today, Commander.</p>}
     <p className="caption">Personalized demo suggestions · No live AI connection.</p></>}
   </section>
   <section className="section section-trends" id="trends">
     <SectionCap n="04">MISSION HISTORY</SectionCap>
     <div className="heading-row" data-reveal><div><h2>Last 7 Mission Days.</h2><p>Sleep telemetry and the mood you report are tracked separately.</p></div></div>
     <div className="charts-grid" data-reveal>
       <TrendChart id="sleep-trend" title="Sleep Duration" unit="hours" min={0} max={10} ticks={[0,2,4,6,8,10]} days={days} values={days.map(d=>rows.find(x=>x.day===d)?.sleep)} color="#7FB8FF" empty="No sleep readings yet."/>
       <TrendChart id="mood-trend" title="Mood Check-ins" unit="1–5 rating" min={1} max={5} ticks={[1,2,3,4,5]} days={days} values={days.map(d=>state.checkins[d]?.mood)} color="#BDABFA" empty="No mood check-ins in this period."/>
     </div>
     <div className="review-wrap">
       <article className="panel review" id="review">
         <div className="review-head"><div><div className="micro amber"><Icon name="clock" size={16}/> MISSION DAY {day} / CLOSEOUT</div><h3>End-of-Day Review</h3><p>Did you complete today’s missions?</p></div><button type="button" className="button outline" aria-expanded={reviewOpen} aria-controls="review-panel" onClick={showReview}>{reviewOpen?'Hide review':'Review Today'} <Icon name="down" size={15}/></button></div>
         <div className="review-progress">{missions.length?`${done} of 3 completed`:'No missions yet'} {recap&&<span><Icon name="check" size={15}/> Review saved</span>}</div>
         {reviewOpen&&<div id="review-panel" className="review-open">{missions.length?missions.map(item=><label key={item.id}><input type="checkbox" checked={item.done} onChange={()=>toggle(item)}/>{item.title}</label>):<p>Save a check-in to get today’s missions.</p>}<div className="review-actions"><button type="button" className="button primary" onClick={saveReview}>Save Review</button><button type="button" className="button outline" onClick={advance}>Next Mission Day <span className="micro">DEMO</span></button></div></div>}
       </article>
     </div>
   </section>
   <footer className="section footer"><div><a className="brand-footer" href="#top"><Icon name="orbit" size={22}/> ORBITONE</a><p>A NASA Space Apps 2026 prototype. Demo indexes are not clinical scores.</p></div><div><a href="https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/">Challenge brief <Icon name="right" size={14}/></a><small>Hero helmet generated with Tripo Studio.</small></div></footer>
   </div>
   <div className="companion-rail">
     <Guide visible={visible} message={message} action={companionActions[messageEvent]} open={open} setOpen={setOpen}/>
   </div>
   </div>
  </main>
 </>
}
createRoot(document.getElementById('root')).render(<App/>)
