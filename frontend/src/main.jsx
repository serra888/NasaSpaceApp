import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import Hero,{Icon} from './Hero'
import Garden from './Garden'
import Profile from './Profile'
import TrendChart from './Charts'
import {changeSelection,extraMissions,includeAssigned,missionLimit,mockGarden,newPlan,plantOptions,selectedMissions} from './garden-model'
import SiteLink from './SiteLink'
import {demoDateForMission} from './mission-calendar'
import {Guide} from './Guide'
import {checkFields,getReadings,loadState,moodIndex,saveState,suggestMissions,validCheckin} from './demo-data'
import './style.css'
import './trends.css'
import './garden.css'

const copy={
 welcome:'How are you feeling today? Check in, then visit Mission Garden to see today’s assigned missions.',
 returning:'How are you feeling today? Check in, then visit Mission Garden to see today’s assigned missions.',
 energy:'Check-in saved. You reported low energy, so I picked a quieter first step. See your three assigned missions in Mission Garden.',
 ready:'Check-in saved. Your Mood is updated and your three missions are ready. See them in Mission Garden.',
 updated:'Check-in updated. Your Mood and trend now reflect your new answers. Your missions are unchanged.',
 logged:'Logged. That’s one thing you did for yourself today.',
 next:'New mission day. Check in to update your Mood and get today’s three missions.',
}
const checkInAction={label:'Check in now',target:'daily-check-in'}
const missionsAction={label:'View today’s missions',href:'/mission-garden/#missions'}
const companionActions={
 welcome:checkInAction,returning:checkInAction,next:checkInAction,
 energy:missionsAction,ready:missionsAction,updated:missionsAction,
}
const pages=[{key:'home',href:'/',name:'Home'},{key:'garden',href:'/mission-garden/',name:'Mission Garden'},{key:'profile',href:'/profile/',name:'Profile'}]
const routeFor=path=>pages.find(page=>page.href.replace(/\/$/,'')===path.replace(/\/$/, ''))?.key??'home'
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
function SiteHeader({route,go}){
 return <header className="site-header">
   <div className="site-header-inner">
     <SiteLink href="/" go={go} className="site-brand" aria-label="Orbitone home"><Icon name="orbit" size={23}/> ORBITONE</SiteLink>
     <nav aria-label="Main navigation">
       {pages.map(page=><SiteLink key={page.key} href={page.href} go={go} aria-current={route===page.key?'page':undefined}>{page.name}</SiteLink>)}
     </nav>
   </div>
 </header>
}
function App(){
 const [state,setState]=useState(loadState)
 const [form,setForm]=useState(()=>state.checkins[state.day]||cleanForm)
 const [feedback,setFeedback]=useState('')
 const [route,setRoute]=useState(()=>routeFor(location.pathname))
 const [gardenFeedback,setGardenFeedback]=useState('')
 const [pendingNav,setPendingNav]=useState(null)
 function go(href,{replace=false}={}){
   const url=new URL(href,location.href)
   if(url.pathname!==location.pathname||url.hash!==location.hash){
     history[replace?'replaceState':'pushState'](null,'',url.pathname+url.hash)
   }
   setRoute(routeFor(url.pathname))
   setPendingNav({hash:url.hash})
 }
 useEffect(()=>{
   const pop=()=>{setRoute(routeFor(location.pathname));setPendingNav({hash:location.hash})}
   addEventListener('popstate',pop)
   const previousRestoration=history.scrollRestoration
   history.scrollRestoration='manual'
   if(location.hash||routeFor(location.pathname)!=='home')setPendingNav({hash:location.hash})
   return ()=>{history.scrollRestoration=previousRestoration;removeEventListener('popstate',pop)}
 },[])
 useLayoutEffect(()=>{
   if(!pendingNav)return
   const target=pendingNav.hash?document.getElementById(pendingNav.hash.slice(1)):null
   if(target){target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true})}
   else window.scrollTo({top:0,behavior:'instant'})
 },[route,pendingNav])
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
 const heroRef=useRef(null)
 const previousVisit=useRef(false)
 const seen=useRef(new Set())
 const priority=useRef(0)
 const day=state.day
 const checkin=state.checkins[day]
 const rows=getReadings(day)
 const reading=rows.at(-1)
 const missions=state.dailyMissions[day]?.items||[]
 const today=demoDateForMission(day)
 const garden=state.garden??{}
 const savedPlan=garden.days?.[day]??newPlan
 const plantId=plantOptions.some(p=>p.id===garden.plantId)?garden.plantId:plantOptions[0].id
 const assignmentsFor=d=>(state.dailyMissions[d]?.items??suggestMissions(getReadings(d).at(-1),state.checkins[d])).slice(0,3).map(task=>({...task,assigned:true}))
 const assigned=assignmentsFor(day)
 const plan=includeAssigned(savedPlan,assigned)
 const candidatesFor=(d,p)=>[...assignmentsFor(d),...extraMissions,...p.custom]
 const candidates=candidatesFor(day,plan)
 const todayTasks=selectedMissions(plan,candidates)
 const calendarRecords={}
 for(const [n,p] of Object.entries({...garden.days,[day]:plan})){
   const missionDay=Number(n)
   calendarRecords[demoDateForMission(missionDay)]={missionDay,tasks:selectedMissions(p,candidatesFor(missionDay,p))}
 }
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
 },[])
 useEffect(()=>{
   document.title='ORBITONE — '+(route==='home'?'Mission Wellbeing':pages.find(page=>page.key===route).name)
   function checkHero(){setVisible(route==='home'&&(heroRef.current?.getBoundingClientRect().bottom??1)<=(document.querySelector('.site-header')?.offsetHeight??0))}
   checkHero()
   addEventListener('scroll',checkHero,{passive:true})
   addEventListener('resize',checkHero)
   return ()=>{removeEventListener('scroll',checkHero);removeEventListener('resize',checkHero)}
 },[route])
 useEffect(()=>{
   if(visible&&!checkin&&!message)speak(previousVisit.current?'returning':'welcome')
 },[visible,checkin,message,day])
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
 },[route])
 function commit(next){
   if(!saveState(next)){setFeedback('Unable to save to this browser. Please allow local storage and try again.');return false}
   setState(next);return true
 }
 function submit(e){
   e.preventDefault()
   if(!validCheckin(form)){setFeedback('Choose a score from 1 to 5 for every field.');return}
   const next={...state,checkins:{...state.checkins,[day]:{...form,note:(form.note||'').trim()}},dailyMissions:{...state.dailyMissions,[day]:state.dailyMissions[day]||(savedPlan.chosen.length?{items:assigned,lead:null}:{items:suggestMissions(reading,form),lead:null})}}
   if(commit(next)){
     setFeedback('Check-in saved. Your Mood and trend have been updated.')
     speak(missions.length?'updated':form.energy<=2?'energy':'ready',true)
   }
 }
 function saveGarden(next){
   if(!saveState(next)){setGardenFeedback('Unable to save to this browser. Please allow local storage and try again.');return false}
   setGardenFeedback('')
   setState(next)
   return true
 }
 function updatePlan(d,fn){
   const prev=includeAssigned(garden.days?.[d]??newPlan,assignmentsFor(d))
   const next=fn(prev)
   if(prev===next)return
   return saveGarden({...state,
     dailyMissions:{...state.dailyMissions,[d]:state.dailyMissions[d]??{items:assignmentsFor(d),lead:null}},
     garden:{...garden,days:{...garden.days,[d]:next}}})
 }
 function selectTask(id){
   if(!candidates.some(task=>task.id===id&&!task.assigned))return
   updatePlan(day,p=>changeSelection(p,id,assigned))
 }
 function checkTask(d,id,checked){
   updatePlan(d,p=>p.chosen.includes(id)?{...p,checked:{...p.checked,[id]:checked}}:p)
 }
 function onCalendarToggle(date,id,checked){
   const record=calendarRecords[date]
   if(record)checkTask(record.missionDay,id,checked)
 }
 function addTask(title){
   if(!title.trim()||plan.chosen.length>=missionLimit.max)return
   const task={id:crypto.randomUUID(),title:title.trim().slice(0,100),custom:true}
   return updatePlan(day,p=>changeSelection({...p,custom:[...p.custom,task]},task.id,assigned))
 }
 function nextDay(){
   const next={...state,day:day+1,
     dailyMissions:{...state.dailyMissions,[day]:state.dailyMissions[day]??{items:assigned,lead:null}},
     garden:{...garden,days:{...garden.days,[day]:plan}}}
   if(saveGarden(next)){setForm(cleanForm);setFeedback('');speak('next',true,next.day);go('/profile/')}
 }
 function updateJournal(missionDay,body){
   const journal={...state.journal}
   if(body===null)delete journal[missionDay]
   else journal[missionDay]={body,updatedAt:new Date().toISOString()}
   return saveGarden({...state,journal})
 }
 const skip=route==='home'?['#status','mission status']:route==='garden'?['#crew-garden','crew garden']:['#mission-calendar','mission calendar']
 return <>
  <a className="skip" href={skip[0]}>Skip to {skip[1]}</a>
  <SiteHeader route={route} go={go}/>
  {gardenFeedback&&<p className="garden-feedback" role="alert">{gardenFeedback}</p>}
  {route==='garden'?<Garden go={go} day={day} member={mockGarden.member} crew={mockGarden.crew} plantId={plantId} onPlant={id=>saveGarden({...state,garden:{...garden,plantId:id}})} candidates={candidates} tasks={todayTasks} onSelect={selectTask} onToggle={(id,checked)=>checkTask(day,id,checked)} onAdd={addTask} />:route==='profile'?<Profile go={go} member={mockGarden.member} day={day} records={calendarRecords} today={today} onToggle={onCalendarToggle} entries={state.journal??{}} onJournalChange={updateJournal} onNextDay={nextDay}/>:<>
  <Hero heroRef={heroRef}/>
  <main className="starfield">
   <div className="mission-layout">
   <div className="mission-content">
   <section className="section section-status" id="status" tabIndex={-1}>
    <SectionCap n="01">FLIGHT STATUS</SectionCap>
    <div className="heading-row" data-reveal><div><h2>Today’s status.</h2><p>A moment to check in with the person behind the suit.</p></div><span className="day-chip micro"><i/> Mission Day {day}</span></div>
    <div className="status-grid" data-reveal>
      <StatusCard name="Health" icon="heart" value={reading?.index??null} label="Demo index" missing="No health summary yet" theme="health"/>
      <StatusCard name="Mood" icon="mood" value={moodIndex(checkin)} label="Self-reported" missing="No check-in yet" theme="mood"/>
    </div>
    <p className="telemetry micro"><i/> SIMULATED TELEMETRY {reading&&<span>· {reading.heart} BPM · SpO₂ {reading.oxygen}%</span>}</p>
    <SectionCap n="02">PERSONAL LOG</SectionCap>
    <form className="panel checkin" onSubmit={submit} aria-labelledby="daily-check-in">
      <div><span className="micro accent">PERSONAL LOG / {day}</span><h3 id="daily-check-in" tabIndex={-1}>Daily check-in</h3><p>How are you feeling right now? Choose one answer on each scale.</p></div>
      <div className="ratings-grid">{checkFields.map(field=><Rating key={field.key} field={field} value={form[field.key]} onChange={n=>{setForm({...form,[field.key]:n});setFeedback('')}}/>)}</div>
      <label className="note-label">Short note <span>Optional · stored on this device</span><textarea name="note" maxLength={320} rows={3} placeholder="Anything you’d like to remember?" value={form.note||''} onChange={e=>{setForm({...form,note:e.target.value});setFeedback('')}}/></label>
      <div className="form-end"><button type="submit" className="button primary">Save Check-in <Icon name="right" size={17}/></button><span role="status" className={feedback.startsWith('Check-in')?'saved':'error'}>{feedback}</span></div>
    </form>
   </section>
   <section className="section home-check-history" id="history" tabIndex={-1} aria-labelledby="history-title">
    <div className="history-prologue">
      <div><div className="trends-rule" aria-hidden="true"/><SectionCap n="03">CHECK-IN HISTORY</SectionCap><h2 id="history-title">Last 7 days</h2><p>Simulated sleep telemetry and the mood you report are shown separately.</p></div>
      <figure className="history-transmission"><img src="/media/trends-flight-portrait.webp" alt="A landscape reflected in an astronaut’s visor" width="630" height="960" loading="lazy"/><figcaption className="micro">ORBITONE / FIELD NOTES</figcaption></figure>
    </div>
    <div className="charts-grid">
      <TrendChart id="sleep-trend" title="Sleep Duration" unit="hours" min={0} max={10} ticks={[0,2,4,6,8,10]} days={days} values={days.map(d=>rows.find(x=>x.day===d)?.sleep)} color="#7FB8FF" empty="No sleep readings yet."/>
      <TrendChart id="mood-trend" title="Mood Check-ins" unit="1–5 rating" min={1} max={5} ticks={[1,2,3,4,5]} days={days} values={days.map(d=>state.checkins[d]?.mood)} color="#BDABFA" empty="No mood check-ins in this period."/>
    </div>
   </section>
   <footer className="section footer"><div><a className="brand-footer" href="#top"><Icon name="orbit" size={22}/> ORBITONE</a><p>A NASA Space Apps 2026 prototype. Demo indexes are not clinical scores.</p></div><div><a href="https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/">Challenge brief <Icon name="right" size={14}/></a><small>Hero helmet generated with Tripo Studio.</small></div></footer>
   </div>
   <div className="companion-rail">
     <Guide visible={visible} message={message} action={companionActions[messageEvent]} navigate={go} open={open} setOpen={setOpen}/>
   </div>
   </div>
  </main>
  </>}
 </>
}
createRoot(document.getElementById('root')).render(<App/>)
