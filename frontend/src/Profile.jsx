import {Icon} from './Hero'
import SiteLink from './SiteLink'
import {MissionCalendar} from './Calendar'
import Journal from './Journal'

export function PageFooter({go}){
  return <footer className="trends-shell trends-footer"><SiteLink href="/" go={go} className="trends-brand"><Icon name="orbit" size={22}/> ORBITONE</SiteLink><span className="micro">CREW WELLBEING PROTOTYPE</span><SiteLink href="/" go={go} className="text-link">Back to Home <Icon name="right" size={16}/></SiteLink></footer>
}
export default function Profile({go,member,day,records,today,onToggle,entries,onJournalChange,onNextDay,onOpenDay,connected=false,busy=false}){
  return <main className="orbit-secondary profile-page trends-starfield" id="top">
    <section className="trends-opening profile-hero" aria-labelledby="profile-title">
      <div className="trends-shell trends-hero-inner">
        <div className="trends-hero-copy">
          <div className="trends-rule" aria-hidden="true"/>
          <p className="micro trends-hero-kicker">ORBITONE / CREW PROFILE</p>
          <h1 id="profile-title">{member.name}</h1>
          <p className="profile-day">{connected?('Mission date '+(day||'Loading…')):('Mission Day '+day)}</p>
          <p className="profile-location"><Icon name="orbit" size={20}/> {member.location}</p>
          <SiteLink href="/profile/#mission-calendar" go={go} className="trends-explore"><span><Icon name="down" size={16}/></span> View mission calendar</SiteLink>
        </div>
      </div>
      <div className="profile-portrait" aria-hidden="true"><img src="/media/trends-astronaut.webp" width="605" height="1380" alt=""/></div>
    </section>
    <div className="trends-light trends-calendar-band">
      {today?<MissionCalendar key={today} records={records} today={today} onToggle={onToggle} onOpenDay={onOpenDay} connected={connected} busy={busy}/>:<p className="trends-shell lunar-calendar">Waiting for the server’s mission date.</p>}
    </div>
    {day&&<Journal day={day} entries={entries} onChange={onJournalChange}/>}
    {onNextDay&&<div className="trends-shell profile-demo-day"><button type="button" className="button outline" onClick={onNextDay}>Next Mission Day <span className="micro">DEMO</span></button></div>}
    <PageFooter go={go}/>
  </main>
}
