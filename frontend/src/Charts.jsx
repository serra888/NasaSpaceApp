const isDateLabel = value =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export default function TrendChart({id,title,unit,min,max,ticks,days,values,color,empty}){
  const width=460,height=224
  const left=38,right=13,top=18,bottom=47
  const usesDates=days.some(isDateLabel)
  const hasLabel=day=>isDateLabel(day)||(Number.isInteger(day)&&day>0)
  const x=i=>left+i*(width-left-right)/Math.max(days.length-1,1)
  const y=value=>top+(max-value)*(height-top-bottom)/(max-min)
  const points=days.map((day,i)=>hasLabel(day)&&Number.isFinite(values[i])?[x(i),y(values[i])]:null)
  const available=points.filter(Boolean).length
  const path=points.map((point,i)=>point?`${i>0&&points[i-1]?'L':'M'} ${point[0]} ${point[1]}`:'').join(' ')

  return <figure className="panel chart-card" id={id} tabIndex={-1}>
    <figcaption><h3>{title}</h3><span>{unit}</span></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${available} recorded days in the last seven-day window.`}>
      {ticks.map(tick=><g key={tick}>
        <line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} className="chart-grid"/>
        <text x={left-13} y={y(tick)+4} textAnchor="end">{tick}</text>
      </g>)}
      {days.map((day,i)=><text key={i} x={x(i)} y={height-19} textAnchor="middle">
        {isDateLabel(day)?day.slice(5):hasLabel(day)?day:'–'}
      </text>)}
      <path d={path} fill="none" stroke={color} strokeWidth="2.8" strokeLinejoin="round"/>
      {points.map((point,i)=>point&&<circle key={i} cx={point[0]} cy={point[1]} r={4.4} stroke="var(--surface)" strokeWidth="1.4" fill={color}>
        <title>{`${isDateLabel(days[i])?days[i]:'Day '+days[i]} · ${values[i]} ${unit}`}</title>
      </circle>)}
    </svg>
    {!available&&<p className="chart-empty">{empty}</p>}
    <details className="chart-data">
      <summary>View chart values</summary>
      <table>
        <thead><tr><th>{usesDates?'Date (UTC)':'Mission day'}</th><th>{title}</th></tr></thead>
        <tbody>{days.map((day,i)=><tr key={i}>
          <td>{hasLabel(day)?day:usesDates?'–':'Before mission start'}</td>
          <td>{points[i]?values[i]:'No data'}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </figure>
}
