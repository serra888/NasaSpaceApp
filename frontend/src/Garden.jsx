import {useId,useState} from 'react'
import {Icon} from './Hero'
import SiteLink from './SiteLink'
import {missionLimit,plantImage,plantOptions,plantStates} from './garden-model'
import {PageFooter} from './Profile'

function Plant({id,stage,...props}){
  return <img src={plantImage(id,stage)} alt="" {...props}/>
}

function CrewShelves({member,crew,plantId,onPlant}){
  const plants=[{...member,slot:1,plantId},...crew]
  return <section className="trends-shell garden-crew" id="crew-garden" tabIndex={-1} aria-labelledby="crew-garden-title">
    <div className="section-cap micro"><span>01</span><i/> CREW GARDEN</div>
    <div className="garden-shelf-head"><h2 id="crew-garden-title">A shelf of your own.</h2><p>Choose a plant for the top shelf. Your crewmates’ plants stay in their own bays.</p></div>
    <div className="garden-deck">
      <div className="garden-scene" aria-label="Four crew grow bays">
        <img className="garden-shelves-img" src="/media/garden/crew-shelves.webp" width="1536" height="1024" alt="" />
        {plants.map(plant=><div key={plant.slot} className="garden-bay" data-slot={plant.slot}>
          <div className="bay-caption"><b>{plant.name}{plant.slot===1?' · You':''}</b><span>{plant.slot===1 ? plantStates[plant.plantStage]+' · Demo state' : plantStates[plant.plantStage]}</span></div>
          <Plant id={plant.plantId} stage={plant.plantStage} className="garden-potted"/>
        </div>)}
      </div>
      <fieldset className="plant-picker">
        <legend className="micro">CHOOSE YOUR PLANT</legend>
        {plantOptions.map((option,i)=><button className="plant-option" type="button" key={option.id} aria-pressed={plantId===option.id} onClick={()=>onPlant(option.id)}>
          <Plant id={option.id} stage={0} width="94" height="92"/>
          <span><small className="micro">0{i+1}</small><strong>{option.name}</strong><span>{plantId===option.id?'On your shelf':'Select plant'}</span></span>
          {plantId===option.id&&<Icon name="check" size={16}/>}
        </button>)}
      </fieldset>
    </div>
    <div className="shelf-legend"><span><i/> YOUR SHELF</span><span>03 CREWMATE PREVIEWS · DEMO DATA</span></div>
  </section>
}

const why={rest:'A quiet pause gives you a low-effort starting point.',reset:'A short pause makes room between demanding tasks.',crew:'A small exchange helps you stay connected to the crew.',reflect:'A brief reflection turns your check-in into one concrete step.',mobility:'It’s an easy break to fit between activities.',space:'A small reset keeps the space around you usable.'}
function MissionCard({task,index,selected,done,full,onSelect,onToggle,busy}){
  return <article className={'panel mission-card'+(selected?' selected':'')}>
    <div className="mission-label"><span className="micro">{task.custom?'PERSONAL MISSION':`MISSION / ${String(index+1).padStart(2,'0')}`}</span><Icon name={task.custom?'note':['sleep','crew','note','heart','spark'][index%5]} size={22}/></div>
    <span className="mission-tag">{task.tag??'Self-assigned'}{task.assigned&&' · Assigned'}</span>
    <h3>{task.title}</h3>
    {task.detail&&<p>{task.detail}</p>}
    {!task.custom&&<details><summary>Why this mission?</summary><p>{why[task.id]??'A small, manageable step for your mission day.'}</p></details>}
    <div className="mission-actions">
      {!task.assigned&&<button type="button" className="button outline" aria-pressed={selected} disabled={busy||(full&&!selected)} onClick={()=>onSelect(task.id)}>{selected?'Selected':'Select mission'}</button>}
      {selected&&<button type="button" className={'button '+(done?'complete':'muted')} aria-pressed={done} disabled={busy} onClick={()=>onToggle(task.id,!done)}>{done?<><Icon name="check" size={16}/> Completed</>:'Mark complete'}</button>}
    </div>
  </article>
}

function MissionPicker({candidates,tasks,onSelect,onToggle,onAdd,connected=false,busy=false,ready=true}){
  const formId=useId()
  const [draft,setDraft]=useState('')
  const full=tasks.length>=missionLimit.max
  const completed=tasks.filter(task=>task.done).length
  const suggested=candidates.filter(task=>task.assigned)
  const optional=candidates.filter(task=>!task.assigned&&!task.custom)
  const personal=candidates.filter(task=>task.custom)
  const [extras,setExtras]=useState(false)
  function card(task,index){const selected=tasks.find(m=>m.id===task.id);return <MissionCard key={task.id} task={task} index={index} selected={!!selected} done={selected?.done} full={full} busy={busy} onSelect={onSelect} onToggle={onToggle}/>}
  return <section className="trends-shell garden-missions section-missions" id="missions" tabIndex={-1} aria-labelledby="missions-heading">
    <div className="section-cap micro"><span>02</span><i/> SMALL STEPS</div>
    <div className="heading-row"><div><h2 id="missions-heading">Today’s missions.</h2><p>Three missions are assigned each day. You can add up to two more.</p></div><div className="mission-counts" aria-live="polite"><span className="day-chip micro">{tasks.length} / 5 missions</span><span className="day-chip micro">{completed} of {tasks.length} completed</span></div></div>
    <div className="mission-grid">{suggested.map(card)}</div>
    {!suggested.length&&<p className="caption">{ready?'No assigned missions yet. Save a check-in on Home to get your missions.':'Waiting for server missions.'}</p>}
    {optional.length>0&&<div className="additional-missions">
      <button type="button" className="button outline" aria-expanded={extras} onClick={()=>setExtras(v=>!v)}>{extras?'Hide extra suggestions':'See extra suggestions'} <Icon name="down" size={16}/></button>
      {extras&&<div className="mission-grid">{optional.map((task,i)=>card(task,i+suggested.length))}</div>}
    </div>}
    <p className="caption">{connected?'Assigned missions come from the backend. Optional missions stay on this device.':'Required missions are assigned automatically in this demo.'}</p>
    <form className="personal-mission" onSubmit={e=>{e.preventDefault();if(!full&&draft.trim()&&onAdd(draft.trim()))setDraft('')}}>
      <div><label htmlFor={formId}>Write your own mission</label><p>{full?'You’ve reached today’s five-mission limit.':'Add one small step that fits your day.'}</p></div>
      <div className="personal-mission-fields"><input id={formId} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="e.g. Stretch after lunch" maxLength={100} required/><button className="button primary" type="submit" disabled={busy||!ready||full||!draft.trim()}>Add mission <span aria-hidden="true">+</span></button></div>
    </form>
    {personal.length>0&&<div className="mission-grid home-personal-missions">{personal.map(card)}</div>}
  </section>
}

export default function Garden({go,member,crew,plantId,onPlant,candidates,tasks,onSelect,onToggle,onAdd,connected=false,busy=false,ready=true}){
  return <main className="orbit-secondary garden-page trends-starfield" id="top">
    <section className="trends-opening garden-hero" aria-labelledby="garden-title">
      <div className="trends-shell trends-hero-inner">
        <div className="trends-hero-copy">
          <div className="trends-rule" aria-hidden="true"/>
          <p className="micro trends-hero-kicker">ORBITONE / CREW GROW BAY</p>
          <h1 id="garden-title">Mission <span>Garden</span></h1>
          <p className="trends-hero-summary">A shared garden in orbit. Grow it with the small things you do each day.</p>
          <SiteLink href="/mission-garden/#crew-garden" go={go} className="trends-explore"><span><Icon name="down" size={16}/></span> Enter the grow bay</SiteLink>
        </div>
      </div>
      <p className="zinnia-caption"><em>In 2016, a zinnia became the first flower to bloom in the space station’s Veggie facility. Even in orbit, small acts of care can help something bloom.</em> <a href="https://www.nasa.gov/image-article/first-flower-grown-space-stations-veggie-facility/" target="_blank" rel="noreferrer">NASA</a></p>
    </section>
    <section className="garden-prologue">
      <div className="trends-shell garden-prologue-inner">
        <span className="trends-watermark" aria-hidden="true">GROW</span>
        <div className="garden-prologue-copy"><span className="micro trends-hero-kicker">LIFE ABOARD / SHARED MODULE</span><div className="trends-rule"/><h2>Life in<br/>the grow bay.</h2><p>Care for your own plant alongside the rest of your crew.</p></div>
        <figure className="garden-window"><img src="/media/trends-space.webp" alt="The bright edge of Earth seen from orbit" width="720" height="1280" loading="lazy"/><figcaption className="micro">ORBITONE / IN ORBIT</figcaption></figure>
      </div>
    </section>
    <CrewShelves member={member} crew={crew} plantId={plantId} onPlant={onPlant}/>
    <MissionPicker candidates={candidates} tasks={tasks} connected={connected} busy={busy} ready={ready} onSelect={onSelect} onToggle={onToggle} onAdd={onAdd}/>
    <section className="trends-shell garden-rules">
      <div><span className="micro">GARDEN FIELD GUIDE</span><h2>How your plant changes.</h2></div>
      <div><p>Complete your three assigned missions and any extras you’ve added to help keep your plant green. At the end of the day, unfinished missions can move it through five color states.</p>
      <p className="caption">This demo previews fixed colors. The live garden will use the plant state returned by the server.</p>
      <div className="plant-colors" aria-label="Five plant color states">{plantStates.map((s,i)=><span key={s}><i data-color={i}/>{s}</span>)}</div></div>
    </section>
    <div className="trends-shell garden-profile-link"><SiteLink href="/profile/" go={go} className="button primary">Show more details <Icon name="right" size={17}/></SiteLink></div>
    <PageFooter go={go}/>
  </main>
}
