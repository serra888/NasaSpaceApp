import {useId,useState} from 'react'
import {Icon} from './Hero'

const MAX_LENGTH=10000

function JournalEntry({day,entry,onChange}){
  const inputId=useId()
  const [editing,setEditing]=useState(!entry)
  const [draft,setDraft]=useState(entry?.body??'')
  const [confirmDelete,setConfirmDelete]=useState(false)
  const [feedback,setFeedback]=useState('')
  function save(e){
    e.preventDefault()
    if(!draft.trim())return
    if(onChange(day,draft.trim())){setEditing(false);setConfirmDelete(false);setFeedback('Entry saved.')}
  }
  function remove(){
    if(onChange(day,null)){setConfirmDelete(false);setDraft('');setEditing(true);setFeedback('Entry deleted.')}
  }
  return <div className="journal-entry">
    {editing?<form onSubmit={save}>
      <label htmlFor={inputId}>Write your journal entry</label>
      <textarea id={inputId} value={draft} rows={6} maxLength={MAX_LENGTH} placeholder="Write whatever’s on your mind…" onChange={e=>{setDraft(e.target.value);setFeedback('')}}/>
      <div className="journal-actions">
        <button type="submit" className="button primary" disabled={!draft.trim()}>Save entry <Icon name="check" size={16}/></button>
        {!!entry&&<button type="button" className="button outline" onClick={()=>{setDraft(entry.body);setEditing(false)}}>Cancel</button>}
      </div>
    </form>:<>
      <p className="journal-entry-body">{entry?.body}</p>
      {!confirmDelete&&<div className="journal-actions">
        <button type="button" className="button outline" onClick={()=>{setDraft(entry?.body??'');setEditing(true);setFeedback('')}}>Edit entry <Icon name="note" size={15}/></button>
        <button type="button" className="button journal-delete" onClick={()=>{setConfirmDelete(true);setFeedback('')}}>Delete entry</button>
      </div>}
      {confirmDelete&&<div className="journal-delete-prompt"><p>Delete the journal entry for Mission Day {day}?</p><div className="journal-actions">
        <button type="button" className="button journal-delete" onClick={remove}>Confirm delete</button>
        <button type="button" className="button outline" onClick={()=>setConfirmDelete(false)}>Keep entry</button>
      </div></div>}
    </>}
    <span className="journal-feedback" role="status">{feedback}</span>
  </div>
}

export default function Journal({day,entries,onChange}){
  const [showHistory,setShowHistory]=useState(false)
  const historyId=useId()
  const earlier=Object.keys(entries).map(Number).filter(n=>n<day).sort((a,b)=>b-a)
  return <section className="mission-journal" id="journal" aria-labelledby="journal-title" tabIndex={-1}>
    <div className="trends-shell journal-content">
      <div className="journal-intro">
        <div className="trends-rule" aria-hidden="true"/>
        <span className="micro"><Icon name="note" size={15}/> PERSONAL LOG / MISSION DAY {day}</span>
        <h2 id="journal-title">Mission Journal</h2>
        <p>A place to put the day into words. Write about whatever’s on your mind.</p>
      </div>
      <div className="journal-notebook">
        <div className="journal-current"><h3>Today’s entry</h3><span className="micro">DAY {day}</span></div>
        <JournalEntry key={day} day={day} entry={entries[day]} onChange={onChange}/>
        <p className="caption">Saved only in this browser. Journal entries are not sent to a server.</p>
        <div className="journal-history">
          <button type="button" className="button outline" aria-expanded={showHistory} aria-controls={historyId} onClick={()=>setShowHistory(v=>!v)}>{showHistory?'Hide journal history':'Read my history'} <Icon name="down" size={16}/></button>
          <div hidden={!showHistory} id={historyId} className="journal-history-list">
            {earlier.length>0?earlier.map(n=><details className="past-journal" key={n}>
              <summary>Mission Day {n}</summary>
              <JournalEntry day={n} entry={entries[n]} onChange={onChange}/>
            </details>):<p>No entries from earlier mission days yet.</p>}
          </div>
        </div>
      </div>
    </div>
  </section>
}
