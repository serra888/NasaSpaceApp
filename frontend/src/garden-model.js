// Frontend only. Replace the mock snapshot with backend values once available.
export const plantOptions=[
 {id:'zinnia',name:'Zinnia'},
 {id:'pothos',name:'Pothos'},
 {id:'fern',name:'Fern'},
]
export const plantStates=['Green','Light green','Yellow','Amber','Brown']
export const mockGarden={
 member:{name:'Alice',location:'Orbital Habitat · Crew Module',plantStage:0},
 crew:[
  {slot:2,name:'Crewmate 02',plantId:'pothos',plantStage:1},
  {slot:3,name:'Crewmate 03',plantId:'zinnia',plantStage:3},
  {slot:4,name:'Crewmate 04',plantId:'fern',plantStage:4},
 ],
}
export const plantImage=(id,stage)=>`/media/garden/${id}-${stage}.webp`
export const missionLimit={min:3,max:5}
export const extraMissions=[
 {id:'mobility',tag:'Movement',title:'Take a short stretch break',detail:'Make a little time to move between activities.'},
 {id:'space',tag:'Routine',title:'Clear a corner of your workspace',detail:'Pick one small area and put it back in order.'},
]
export const newPlan={chosen:[],custom:[],checked:{},reviewed:false}
export function changeSelection(plan,id,assigned=[]){
 if(assigned.some(task=>task.id===id))return plan
 plan=includeAssigned(plan,assigned)
 const selected=plan.chosen.includes(id)
 if(!selected&&plan.chosen.length>=missionLimit.max)return plan
 return {...plan,chosen:selected?plan.chosen.filter(k=>k!==id):[...plan.chosen,id],
  checked:{...plan.checked,[id]:selected?false:plan.checked[id]},reviewed:false}
}
// The first three assignments are supplied by the demo/AI source, not chosen by the user.
export function includeAssigned(plan,assigned){
 const required=assigned.map(task=>task.id)
 const chosen=[...new Set([...required,...plan.chosen])].slice(0,missionLimit.max)
 return chosen.length===plan.chosen.length&&chosen.every((id,i)=>id===plan.chosen[i])?plan:{...plan,chosen}
}
export function selectedMissions(plan,candidates){
 return includeAssigned(plan,candidates.filter(task=>task.assigned)).chosen.flatMap(id=>{
  const task=candidates.find(item=>item.id===id)
  return task?[{...task,done:!!plan.checked[id]}]:[]
 })
}
