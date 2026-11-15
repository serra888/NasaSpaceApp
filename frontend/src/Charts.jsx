export default function TrendChart({id,title,unit,min,max,ticks,days,values,color,empty}){
  const width=460,height=224
  const left=38,right=13,top=18,bottom=47
  const x=i=>left+i*(width-left-right)/6
  const y=v=>top+(max-v)*(height-top-bottom)/(max-min)
  const points=values.map((v,i)=>Number.isFinite(v)?[x(i),y(v)]:null)
  let path=''
  points.forEach((p,i)=>{if(p)path+=(i&&points[i-1]?' L':' M')+p[0]+' '+p[1]})
  const available=values.filter(Number.isFinite).length
  return <figure className="panel chart-card" id={id} tabIndex={-1}>
    <figcaption><h3>{title}</h3><span>{unit}</span></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} · ${available} recorded days in the last seven-day window.`}>
      {ticks.map(tick=><g key={tick}><line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} className="chart-grid"/><text x={left-13} y={y(tick)+4} textAnchor="end">{tick}</text></g>)}
      {days.map((day,i)=><text key={day} x={x(i)} y={height-19} textAnchor="middle">{day>0?day:'–'}</text>)}
      <path d={path} fill="none" stroke={color} strokeWidth="2.8" strokeLinejoin="round"/>
      {points.map((p,i)=>p&&<circle key={days[i]} cx={p[0]} cy={p[1]} r={4.4} stroke="var(--surface)" strokeWidth="1.4" fill={color}><title>{`Day ${days[i]} · ${values[i]} ${unit}`}</title></circle>)}
    </svg>
    {!available&&<p className="chart-empty">{empty}</p>}
    <details className="chart-data"><summary>View chart values</summary><table><thead><tr><th>Mission day</th><th>{title}</th></tr></thead><tbody>{days.map((day,i)=><tr key={day}><td>{day>0?day:'Before mission start'}</td><td>{Number.isFinite(values[i])?values[i]:'No data'}</td></tr>)}</tbody></table></details>
  </figure>
}
