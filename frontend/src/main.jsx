import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import Hero,{Icon} from './Hero'
import Garden from './Garden'
import Profile from './Profile'
import TrendChart from './Charts'
import {extraMissions,missionLimit,mockGarden,plantOptions} from './garden-model'
import SiteLink from './SiteLink'
import {Guide} from './Guide'
import {checkFields,validCheckin} from './demo-data'
import {api,checkInPayload,missionItem,chartHistory} from './api'
import './style.css'
import './trends.css'
import './garden.css'

const copy={
 welcome:'How are you feeling today? Check in, then visit Mission Garden to see today’s assigned missions.',
 returning:'How are you feeling today? Check in, then visit Mission Garden to see today’s assigned missions.',
 energy:'Check-in saved. You reported low energy, so I picked a quieter first step. See your three assigned missions in Mission Garden.',
 ready:'Check-in saved. Visit Mission Garden to see your assigned missions.',
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
const localKey = 'orbitone.connected-ui.v1'
const isMissionDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const utcDate = (offset=0) => new Date(Date.now()+offset*86400000).toISOString().slice(0,10)
const todoPath = date => '/todos?mission_date='+encodeURIComponent(date)
const assignedTasks = tasks => tasks.map(task=>({...missionItem(task),assigned:true}))
const sameId = (a,b) => String(a)===String(b)

function readLocal(){
  try{return JSON.parse(localStorage.getItem(localKey)??'null')??{}}catch{return {}}
}

function tasksOn(date,remote,local){
  const assigned=remote[date]??[]
  const extras=local.extras?.[date]??{}
  const custom=extras.custom??[]
  const chosen=extras.chosen??[]
  const limit=Math.max(0,Math.min(2,missionLimit.max-assigned.length))
  const optional=[...extraMissions,...custom]
  const selected=chosen.map(id=>optional.find(task=>sameId(task.id,id))).filter(Boolean)
    .slice(0,limit).map(task=>({...task,done:!!extras.checked?.[task.id]}))
  return {all:[...assigned,...selected],candidates:[...assigned,...optional]}
}

function App(){
  const [server,setServer]=useState(null)
  const [chartPoints,setChartPoints]=useState([])
  const [remoteTasks,setRemoteTasks]=useState({})
  const [connectionError,setConnectionError]=useState('')
  const [feedback,setFeedback]=useState('')
  const [saved,setSaved]=useState(false)
  const [uiError,setUiError]=useState('')
  const [busy,setBusy]=useState(false)
  const [pendingNote,setPendingNote]=useState(false)
  const [form,setForm]=useState(cleanForm)
  const [local,setLocal]=useState(readLocal)
  const [route,setRoute]=useState(()=>routeFor(location.pathname))
  const [pendingNav,setPendingNav]=useState(null)
  const [visible,setVisible]=useState(false)
  const [open,setOpen]=useState(false)
  const [messageEvent,setMessageEvent]=useState('')
  const heroRef=useRef(null)
  const active=useRef(false)
  const mutation=useRef(false)
  const sequence=useRef(0)
  const polling=useRef(false)
  const lastDate=useRef('')
  const dateRequests=useRef(new Map())
  const taskVersions=useRef(new Map())

  const day=isMissionDate(server?.mission_date)?server.mission_date:''
  const {all:missions,candidates}=day?tasksOn(day,remoteTasks,local):{all:[],candidates:[]}
  const rows=chartHistory(chartPoints,utcDate())
  const days=rows.map(row=>row.day)
  const reading=server?.latest_measurement
  const plantId=plantOptions.some(plant=>plant.id===local.plantId)?local.plantId:plantOptions[0].id
  const records=Object.fromEntries(Object.keys({...remoteTasks,...local.extras,...(day?{[day]:true}:{})})
    .filter(isMissionDate).map(date=>[date,{tasks:tasksOn(date,remoteTasks,local).all}]))
  const message=messageEvent?copy[messageEvent]??'':server?.astronaut_message??''

  function go(href,{replace=false}={}){
    const url=new URL(href,location.href)
    if(url.pathname!==location.pathname||url.hash!==location.hash){
      window.history[replace?'replaceState':'pushState'](null,'',url.pathname+url.hash)
    }
    setRoute(routeFor(url.pathname))
    setPendingNav({hash:url.hash})
  }
  useEffect(()=>{
    const pop=()=>{setRoute(routeFor(location.pathname));setPendingNav({hash:location.hash})}
    const previousRestoration=window.history.scrollRestoration
    window.history.scrollRestoration='manual'
    addEventListener('popstate',pop)
    if(location.hash||routeFor(location.pathname)!=='home')setPendingNav({hash:location.hash})
    return ()=>{window.history.scrollRestoration=previousRestoration;removeEventListener('popstate',pop)}
  },[])
  useLayoutEffect(()=>{
    if(!pendingNav)return
    const target=pendingNav.hash?document.getElementById(pendingNav.hash.slice(1)):null
    if(target){
      target.scrollIntoView({block:'start',behavior:'instant'})
      target.focus({preventScroll:true})
    }else window.scrollTo({top:0,behavior:'instant'})
  },[route,pendingNav])

  async function refresh({afterWrite=false}={}){
    if(!afterWrite&&(polling.current||mutation.current))return
    if(!afterWrite)polling.current=true
    const request=++sequence.current
    try{
      const status=await api('/status')
      if(!isMissionDate(status.mission_date))throw new Error('The server returned an invalid mission date.')
      const [todos,chart]=await Promise.all([
        api(todoPath(status.mission_date)),
        api('/dashboard?bucket=day&start='+utcDate(-6)+'T00:00:00Z')
      ])
      if(!active.current||request!==sequence.current)return
      setServer(status)
      setChartPoints(chart.points)
      setRemoteTasks(old=>({...old,[status.mission_date]:assignedTasks(todos)}))
      setConnectionError('')
      if(lastDate.current&&lastDate.current!==status.mission_date)setMessageEvent('next')
      lastDate.current=status.mission_date
    }catch(error){
      if(active.current&&request===sequence.current)setConnectionError('Backend unavailable: '+error.message)
    }finally{
      if(!afterWrite)polling.current=false
    }
  }
  useEffect(()=>{
    active.current=true
    void refresh()
    const timer=setInterval(()=>void refresh(),5000)
    return ()=>{active.current=false;sequence.current++;clearInterval(timer)}
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
    if(visible&&!message&&!server?.latest_check_in){setMessageEvent('welcome');setOpen(true)}
  },[visible,message,server])
  useEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const nodes=document.querySelectorAll('[data-reveal]')
    const watcher=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){
        entry.target.classList.add('in-view')
        watcher.unobserve(entry.target)
      }
    },{threshold:.14})
    nodes.forEach(node=>watcher.observe(node))
    return ()=>watcher.disconnect()
  },[route])

  async function loadCalendarDate(date){
    if(!day||!isMissionDate(date)||date>day||date===day||dateRequests.current.has(date))return
    const version=taskVersions.current.get(date)??0
    dateRequests.current.set(date,true)
    setUiError('')
    try{
      const tasks=assignedTasks(await api(todoPath(date)))
      if(active.current&&(taskVersions.current.get(date)??0)===version){
        setRemoteTasks(old=>({...old,[date]:tasks}))
      }
    }catch(error){
      setUiError('Could not load missions for '+date+': '+error.message)
    }finally{dateRequests.current.delete(date)}
  }

  async function runWrite(work,afterWrite=true){
    if(mutation.current)return
    mutation.current=true;sequence.current++;setBusy(true)
    try{await work()}
    finally{
      if(afterWrite)await refresh({afterWrite:true})
      mutation.current=false
      setBusy(false)
    }
  }

  function report(message,ok=false){setFeedback(message);setSaved(ok)}
  async function submit(e){
    e.preventDefault()
    if(mutation.current||!server||pendingNote)return
    if(!validCheckin(form)){report('Choose a score from 1 to 5 for every field.');return}
    const note=form.note.trim()
    await runWrite(async()=>{
      try{
        const result=await api('/check-ins',checkInPayload(form))
        if(result?.mood)setServer(old=>({...old,mood:result.mood}))
        report('Check-in saved.',true)
        setMessageEvent('ready');setOpen(true)
      }catch(error){report(error.message);return}
      if(note){
        try{await api('/journal',{text:note})}
        catch{
          setPendingNote(true)
          report('Check-in saved, but note saving was not confirmed. Check for a duplicate before using Save note only.')
          return
        }
      }
      setForm(cleanForm)
    })
  }

  async function saveNote(){
    const text=form.note.trim()
    if(mutation.current||!server||!text)return
    await runWrite(async()=>{
      try{
        await api('/journal',{text})
        setForm(pendingNote?cleanForm:old=>({...old,note:''}))
        setPendingNote(false)
        report('Note saved.',true)
      }catch(error){report(error.message)}
    },false)
  }

  function saveLocal(next){
    try{
      localStorage.setItem(localKey,JSON.stringify(next))
      setLocal(next);setUiError('')
      return true
    }catch{
      setUiError('Unable to save on this device. Check your browser storage settings.')
      return false
    }
  }
  function changeExtras(date,fn){
    if(!isMissionDate(date))return false
    const previous=local.extras?.[date]??{chosen:[],custom:[],checked:{}}
    return saveLocal({...local,extras:{...local.extras,[date]:fn(previous)}})
  }
  function selectTask(id){
    const choice=candidates.find(task=>sameId(task.id,id)&&!task.assigned)
    if(!choice)return
    const isSelected=missions.some(task=>sameId(task.id,id))
    if(!isSelected&&(missions.length>=missionLimit.max||missions.filter(task=>!task.assigned).length>=2))return
    changeExtras(day,old=>({...old,
      chosen:isSelected?old.chosen.filter(key=>!sameId(key,id)):[...old.chosen,id],
      checked:{...old.checked,[id]:false},
    }))
  }
  function addTask(title){
    if(!day||!title.trim()||missions.length>=missionLimit.max||missions.filter(task=>!task.assigned).length>=2)return false
    const item={id:crypto.randomUUID(),title:title.trim().slice(0,100),custom:true}
    return changeExtras(day,old=>({...old,custom:[...old.custom,item],chosen:[...old.chosen,item.id]}))
  }

  async function completeTask(date,id,done){
    const task=records[date]?.tasks.find(item=>sameId(item.id,id))
    if(!task||mutation.current)return
    if(!task.assigned){
      changeExtras(date,old=>({...old,checked:{...old.checked,[id]:done}}))
      return
    }
    setUiError('')
    await runWrite(async()=>{
      try{
        taskVersions.current.set(date,(taskVersions.current.get(date)??0)+1)
        await api('/todos/'+encodeURIComponent(id),{completed:done},'PATCH')
        taskVersions.current.set(date,(taskVersions.current.get(date)??0)+1)
        setRemoteTasks(old=>({...old,[date]:(old[date]??[]).map(item=>sameId(item.id,id)?{...item,done}:item)}))
        if(done){setMessageEvent('logged');setOpen(true)}
      }catch(error){setUiError('Could not update mission: '+error.message)}
    })
  }

  function updateJournal(date,body){
    if(!isMissionDate(date))return false
    const journal={...local.journal}
    if(body===null)delete journal[date]
    else journal[date]={body,updatedAt:new Date().toISOString()}
    return saveLocal({...local,journal})
  }

  const skip=route==='home'?['#status','mission status']:route==='garden'?['#crew-garden','crew garden']:['#mission-calendar','mission calendar']
  return <>
  <a className="skip" href={skip[0]}>Skip to {skip[1]}</a>
  <SiteHeader route={route} go={go}/>
  {(connectionError||uiError)&&<p className="garden-feedback" role="alert">{uiError||connectionError+' Previously loaded data may be outdated.'}</p>}
  {route==='garden'?<Garden go={go} member={mockGarden.member} crew={mockGarden.crew} plantId={plantId}
    onPlant={id=>saveLocal({...local,plantId:id})} candidates={candidates} tasks={missions}
    onSelect={selectTask} onToggle={(id,done)=>completeTask(day,id,done)} onAdd={addTask} connected busy={busy} ready={!!day}/>
    :route==='profile'?<Profile go={go} member={mockGarden.member} day={day} records={records} today={day}
      onToggle={completeTask} entries={local.journal??{}} onJournalChange={updateJournal}
      onOpenDay={loadCalendarDate} connected busy={busy}/>:<>
  <Hero heroRef={heroRef}/>
  <main className="starfield">
   <div className="mission-layout">
   <div className="mission-content">
   <section className="section section-status" id="status" tabIndex={-1}>
    <SectionCap n="01">FLIGHT STATUS</SectionCap>
    <div className="heading-row" data-reveal><div><h2>Today’s status.</h2><p>A moment to check in with the person behind the suit.</p></div><span className="day-chip micro"><i/> Mission date {day||"Loading…"}</span></div>
    <div className="status-grid" data-reveal>
      <StatusCard name="Health" icon="heart" value={server?.health?.value??null} label={server?.health?.stale?"Stale demo data":"Demo index"} missing="No health summary yet" theme="health"/>
      <StatusCard name="Mood" icon="mood" value={server?.mood?.value??null} label={server?.mood?.stale?"Stale check-in":"Self-reported"} missing="No check-in yet" theme="mood"/>
    </div>
    <p className="telemetry micro"><i/> SIMULATED TELEMETRY {reading&&<span>· {reading.heart_rate??'—'} BPM · SpO₂ {reading.spo2??'—'}%</span>}</p>
    {!!server?.health?.missing_fields?.length&&<p>Missing measurements: {server.health.missing_fields.join(', ')}</p>}
    {server?.alerts?.map(alert=><p key={alert} role="alert">{alert}</p>)}
    <SectionCap n="02">PERSONAL LOG</SectionCap>
    <form className="panel checkin" onSubmit={submit} aria-labelledby="daily-check-in">
      <div><span className="micro accent">PERSONAL LOG / {day}</span><h3 id="daily-check-in" tabIndex={-1}>Daily check-in</h3><p>How are you feeling right now? Choose one answer on each scale.</p></div>
      <div className="ratings-grid">{checkFields.map(field=><Rating key={field.key} field={field} value={form[field.key]} onChange={n=>{setForm({...form,[field.key]:n});setFeedback('')}}/>)}</div>
      <label className="note-label">Short note <span>Optional · saved to your backend journal</span><textarea name="note" maxLength={320} rows={3} placeholder="Anything you’d like to remember?" value={form.note||''} onChange={e=>{setForm({...form,note:e.target.value});setFeedback('')}}/></label>
      {pendingNote&&<p className="caption">The check-in is already saved. Retry the note alone, or <button type="button" className="text-link" disabled={busy} onClick={()=>{setPendingNote(false);setForm(cleanForm);report('Check-in saved. Unconfirmed note cleared.',true)}}>clear the unconfirmed note</button>.</p>}
      <div className="form-end"><button type="submit" disabled={busy||!server||pendingNote} className="button primary">Save Check-in <Icon name="right" size={17}/></button><button type="button" className="button outline" disabled={busy||!server||!form.note.trim()} onClick={saveNote}>Save note only</button><span role="status" className={saved?'saved':'error'}>{feedback}</span></div>
    </form>
   </section>
   <section className="section home-check-history" id="history" tabIndex={-1} aria-labelledby="history-title">
    <div className="history-prologue">
      <div><div className="trends-rule" aria-hidden="true"/><SectionCap n="03">CHECK-IN HISTORY</SectionCap><h2 id="history-title">Last 7 days</h2><p>Simulated sleep telemetry and the mood you report are shown separately.</p></div>
      <figure className="history-transmission"><img src="/media/trends-flight-portrait.webp" alt="A landscape reflected in an astronaut’s visor" width="630" height="960" loading="lazy"/><figcaption className="micro">ORBITONE / FIELD NOTES</figcaption></figure>
    </div>
    <div className="charts-grid">
      <TrendChart id="sleep-trend" title="Sleep Duration" unit="hours" min={0} max={24} ticks={[0,6,12,18,24]} days={days} values={rows.map(row=>row.sleep)} color="#7FB8FF" empty="No sleep readings yet."/>
      <TrendChart id="mood-trend" title="Mood Check-ins" unit="Mood score / 100" min={0} max={100} ticks={[0,25,50,75,100]} days={days} values={rows.map(row=>row.mood)} color="#BDABFA" empty="No mood check-ins in this period."/>
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
