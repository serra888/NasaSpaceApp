import {useEffect,useId,useRef,useState} from 'react'
import {Icon} from './Hero'
import {calendarCells} from './mission-calendar'

const weekday=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const monthName=new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'})
const dateName=new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})
const titleOf=date=>dateName.format(new Date(date+'T00:00:00Z'))
export function MissionCalendar({records,today,onToggle,openRequest}){
  const [year,month]=today.split('-').map(Number)
  const [view,setView]=useState({year,month:month-1})
  const [active,setActive]=useState(null)
  const dialog=useRef()
  const heading=useId()
  const current=new Date(Date.UTC(view.year,view.month,1))
  const label=monthName.format(current)
  const record=active?records[active]:null
  const completed=record?.tasks.filter(t=>t.done).length??0
  function changeMonth(by){
    const moved=new Date(Date.UTC(view.year,view.month+by,1))
    setView({year:moved.getUTCFullYear(),month:moved.getUTCMonth()})
  }
  function openDay(date){setActive(date)}
  useEffect(()=>{if(active&&!dialog.current.open)dialog.current.showModal()},[active])
  useEffect(()=>{
    if(!openRequest)return
    setView({year,month:month-1})
    openDay(today)
  },[openRequest])
  function close(){dialog.current.close()}
  return <section className="trends-shell lunar-calendar" id="mission-calendar" tabIndex={-1} aria-labelledby="calendar-title">
    <div className="trends-rule" aria-hidden="true"/>
    <div className="calendar-intro">
      <div><span className="micro accent">CREW LOG / MONTHLY VIEW</span><h2 id="calendar-title">Mission calendar.</h2><p>Select a day to see its missions and tick off what you completed.</p></div>
      <div className="calendar-pager" aria-label="Change calendar month"><button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)}>‹</button><button type="button" onClick={()=>setView({year,month:month-1})}>Current demo month</button><button type="button" aria-label="Next month" onClick={()=>changeMonth(1)}>›</button></div>
    </div>
    <div className="calendar-paper">
      <div className="month-plate" aria-live="polite"><span>{view.year}</span><strong>{label}</strong><img src="/media/trends-calendar-moon.webp" alt="" width="305" height="304" loading="lazy"/><span className="month-plate-caption">ORBITONE / FLIGHT LOG</span></div>
      <div className="calendar-table" role="group" aria-label={label+' '+view.year}>
        <div className="calendar-week">{weekday.map(d=><span key={d} title={d} aria-label={d}>{d.slice(0,3)}</span>)}</div>
        <div className="calendar-days">
          {calendarCells(view.year,view.month).map((date,i)=>{
            if(!date)return <div className="calendar-empty-cell" key={'empty-'+i} aria-hidden="true"/>
            const day=records[date], total=day?.tasks.length??0
            const done=day?.tasks.filter(t=>t.done).length??0
            return <button type="button" className="calendar-day" key={date} data-recorded={total>0} data-complete={total>0&&done===total} aria-current={today===date?'date':undefined} aria-label={`${titleOf(date)}${today===date?', demo today':''}, ${total?done+' of '+total+' complete':'no missions'}`} onClick={()=>openDay(date)}>
              <span className="calendar-number">{Number(date.slice(-2))}</span>
              {total>0&&<span className="calendar-progress"><i aria-hidden="true"/>{done}/{total}</span>}
            </button>
          })}
        </div>
      </div>
    </div>
    <div className="calendar-key"><span><i/> Missions logged</span><span><i className="finished"/> All complete</span><span>Local demo · Shows missions selected in Mission Garden.</span></div>
    <dialog ref={dialog} className="mission-day-dialog" aria-labelledby={heading} onClose={()=>{if(!dialog.current.open)setActive(null)}} onClick={e=>{if(e.target===e.currentTarget)close()}}>
      {active&&<div className="mission-day-panel">
        <div className="mission-day-top"><span className="micro amber">{record?.missionDay!=null?`MISSION DAY ${record.missionDay} / CLOSEOUT`:'DAILY MISSION LOG'}</span><button type="button" className="icon-button" aria-label="Close day details" onClick={close} autoFocus><Icon name="close" size={19}/></button></div>
        <h3 id={heading}>{titleOf(active)}</h3><p>Did you complete your missions?</p>
        {record?.tasks.length>0?<><p className="day-modal-count" aria-live="polite">{completed} of {record.tasks.length} completed</p><div className="day-checklist">{record.tasks.map(task=><label key={task.id}><input type="checkbox" checked={task.done} onChange={e=>onToggle(active,task.id,e.target.checked)}/><span>{task.title}</span></label>)}</div></>:<p className="day-modal-empty">No missions logged for this date.</p>}
        <button type="button" className="button primary" onClick={close}>Done <Icon name="check" size={17}/></button>
      </div>}
    </dialog>
  </section>
}
