// StudyForge 3.3 Live Day Engine.
// Loaded after app.js and scheduler-v32.js. It keeps the home screen simple,
// tracks real task runtime with timestamps, and projects/reschedules remaining work.

function sf33LiveState(){
  S.liveByDate=S.liveByDate||{};
  const k=keyFor();
  if(!S.liveByDate[k])S.liveByDate[k]={activeId:null,startedAt:null,actuals:{},moved:{}};
  return S.liveByDate[k];
}
function sf33NowMinute(){const d=new Date();return d.getHours()*60+d.getMinutes()}
function sf33StampMinute(ts){const d=new Date(ts);return d.getHours()*60+d.getMinutes()}
function sf33ClockFromStamp(ts){const d=new Date(ts);return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function sf33ElapsedMinutes(){const L=sf33LiveState();return L.activeId&&L.startedAt?Math.max(0,Math.floor((Date.now()-L.startedAt)/60000)):0}
function sf33ElapsedLabel(){const total=sf33ElapsedMinutes(),h=Math.floor(total/60),m=total%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m`}
function sf33IsWork(item){return !['routine','break','prayer'].includes(item?.type)}
function sf33IsDone(id){return !!checks()[id]}
function sf33Actual(id){return sf33LiveState().actuals?.[id]||null}
function sf33EffectiveHours(){
  const hours=activeHours();
  return typeof sf32IsFullDayLike==='function'&&sf32IsFullDayLike(hours)?hours.filter(h=>h>=7&&h<23):hours;
}
function sf33Windows(){
  const hours=sf33EffectiveHours();
  if(!hours.length)return [];
  const out=[];let start=hours[0],prev=hours[0];
  for(let i=1;i<=hours.length;i++){
    if(i<hours.length&&hours[i]===prev+1){prev=hours[i];continue}
    out.push([start*60,(prev+1)*60]);start=hours[i];prev=hours[i];
  }
  const prayerBlocks=S.profile.prayerMode?Object.values(prayers()).map(t=>[Math.max(0,mins(t)-10),Math.min(1440,mins(t)+20)]):[];
  return sf33Subtract(out,prayerBlocks);
}
function sf33Subtract(slots,blocks){
  let result=slots.map(x=>[...x]);
  for(const [x,y] of blocks){
    result=result.flatMap(([a,b])=>{
      if(y<=a||x>=b)return [[a,b]];
      return [[a,Math.max(a,x)],[Math.min(b,y),b]].filter(([s,e])=>e-s>=10);
    });
  }
  return result.sort((a,b)=>a[0]-b[0]);
}
function sf33FixedBlocks(plan,activeId){
  const blocks=[];
  for(const item of plan){
    if(item.id===activeId||sf33IsDone(item.id))continue;
    const fixed=item.type==='routine'||(item.locked&&item.type!=='break');
    if(!fixed)continue;
    const a=mins(item.time),b=a+(Number(item.duration)||S.profile.sessionMinutes);
    if(a>=0&&b>a)blocks.push([a,b]);
  }
  return blocks;
}
function sf33AnchorForActive(active){
  const L=sf33LiveState();
  if(!active||!L.startedAt)return sf33NowMinute();
  const elapsed=Math.max(0,(Date.now()-L.startedAt)/60000);
  const remaining=Math.max(0,(Number(active.duration)||S.profile.sessionMinutes)-elapsed);
  return Math.min(1439,Math.round(sf33NowMinute()+remaining));
}
function sf33Place(slots,cursor,duration){
  for(const [a,b] of slots){
    const s=Math.max(a,cursor);
    if(s+duration<=b)return s;
  }
  return null;
}
function sf33ProjectedPlan(anchorOverride=null){
  const plan=todayPlan().map(x=>({...x}));
  const L=sf33LiveState();
  if(anchorOverride==null&&!L.activeId)return plan;
  const active=plan.find(x=>x.id===L.activeId)||null;
  const anchor=anchorOverride==null?sf33AnchorForActive(active):anchorOverride;
  let slots=sf33Subtract(sf33Windows(),sf33FixedBlocks(plan,L.activeId));
  slots=slots.map(([a,b])=>[Math.max(a,anchor),b]).filter(([a,b])=>b-a>=10);

  const flex=plan.filter(item=>{
    if(item.id===L.activeId||sf33IsDone(item.id)||item.type==='routine')return false;
    if(item.locked&&item.type!=='break')return false;
    return true;
  }).sort((a,b)=>mins(a.time)-mins(b.time));

  let cursor=anchor;
  const projected=new Map();
  for(const item of flex){
    const dur=Math.max(5,Number(item.duration)||S.profile.sessionMinutes);
    const start=sf33Place(slots,cursor,dur);
    if(start==null){projected.set(item.id,{...item,_deferred:true});continue}
    projected.set(item.id,{...item,_displayTime:hhmm(start),_moved:hhmm(start)!==item.time});
    cursor=start+dur;
  }

  return plan.map(item=>projected.get(item.id)||item);
}
function sf33CarryToBank(item){
  if(!sf33IsWork(item))return;
  const exists=S.tasks.some(t=>!t.done&&(t.id===item.id||t.title===item.title));
  if(exists)return;
  S.tasks.push({
    id:`carry-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    title:item.title,skill:item.skill||'General',duration:Number(item.duration)||S.profile.sessionMinutes,
    priority:item.priority||'medium',deadline:'',done:false,type:item.type||'task'
  });
}
function sf33CommitReflow(anchorMinute){
  const projected=sf33ProjectedPlan(anchorMinute);
  const map=new Map(projected.map(x=>[x.id,x]));
  const next=[];
  for(const original of todayPlan()){
    const p=map.get(original.id)||original;
    if(p._deferred){sf33CarryToBank(p);continue}
    if(p._displayTime)original.time=p._displayTime;
    next.push(original);
  }
  S.plans[keyFor()]=next.sort((a,b)=>mins(a.time)-mins(b.time));
  S.ai.lastSummary=`Live schedule adjusted from ${pretty(hhmm(anchorMinute))}.`;
  save();
}
function sf33OverduePrayer(){
  if(!S.profile.prayerMode)return null;
  const now=sf33NowMinute(),pc=pchecks();
  return PRAYERS.map(name=>({name,time:prayers()[name]})).find(p=>!pc[p.name]&&mins(p.time)<=now)||null;
}
function sf33StartTask(id){
  const L=sf33LiveState();
  if(L.activeId&&L.activeId!==id){toast('Complete the running task first');return}
  const task=todayPlan().find(x=>x.id===id);
  if(!task||!sf33IsWork(task)||sf33IsDone(id))return;
  const prayer=sf33OverduePrayer();
  if(prayer)toast(`${prayer.name} is still pending`);
  L.activeId=id;L.startedAt=Date.now();
  save();render();sf33Tick();
}
function sf33CompleteActive(){
  const L=sf33LiveState();
  if(!L.activeId||!L.startedAt)return;
  const id=L.activeId,task=todayPlan().find(x=>x.id===id);
  if(!task){L.activeId=null;L.startedAt=null;save();render();return}
  const completedAt=Date.now();
  const wallMinutes=Math.max(1,Math.round((completedAt-L.startedAt)/60000));
  const delayMinutes=Math.round(sf33StampMinute(L.startedAt)-mins(task.time));
  L.actuals=L.actuals||{};
  L.actuals[id]={startedAt:L.startedAt,completedAt,actualMinutes:wallMinutes,plannedMinutes:Number(task.duration)||S.profile.sessionMinutes,delayMinutes};
  S.checks[keyFor()]=S.checks[keyFor()]||{};S.checks[keyFor()][id]=true;
  const bank=S.tasks.find(t=>!t.done&&(t.id===id||t.title===task.title));if(bank)bank.done=true;
  L.activeId=null;L.startedAt=null;
  sf33CommitReflow(sf33NowMinute());
  save();render();toast('Completed — rest of the day reflowed');
}
function sf33MoveTask(id){
  const task=todayPlan().find(x=>x.id===id);if(!task||!sf33IsWork(task))return;
  sf33CarryToBank(task);
  S.plans[keyFor()]=todayPlan().filter(x=>x.id!==id);
  sf33CommitReflow(sf33NowMinute());
  save();render();toast('Moved to the task bank');
}
function sf33PrayerItems(){
  if(!S.profile.prayerMode)return [];
  const pc=pchecks();
  return PRAYERS.map(name=>({id:`prayer-${name}`,time:prayers()[name],duration:1,title:name,skill:'Prayer',type:'prayer',priority:'high',reason:pc[name]?'Completed':'Prayer block',emoji:'🕌',locked:true,_prayerName:name,_done:!!pc[name]}));
}
function sf33PrayerRow(x){
  const now=sf33NowMinute(),at=mins(x.time),done=x._done;
  const late=Math.max(0,now-at);
  const status=done?'Completed':now>=at?(late?`${late}m pending`:'Pending now'):`In ${at-now}m`;
  return `<div class="timeline prayer-line ${done?'done':''}"><div class="time">${pretty(x.time)}<div class="note">fixed</div></div><div class="emoji">🕌</div><div><div class="task-meta">Prayer · ${done?'done':now>=at?'pending':'upcoming'}</div><div class="t-title">${esc(x.title)}</div><div class="note">${status}</div></div><div class="task-actions"><button class="check ${done?'on':''}" onclick="togglePrayer('${esc(x._prayerName)}')">${done?'✓':''}</button></div></div>`;
}
function sf33RowTime(item){return item._displayTime||item.time}
function taskRow(x){
  if(x.type==='prayer')return sf33PrayerRow(x);
  const L=sf33LiveState(),active=L.activeId===x.id,done=sf33IsDone(x.id),actual=sf33Actual(x.id);
  const display=sf33RowTime(x),scheduled=mins(x.time),now=sf33NowMinute();
  const late=!done&&!active&&sf33IsWork(x)&&now>scheduled?now-scheduled:0;
  const passive=['routine','break'].includes(x.type);
  const moved=x._moved&&display!==x.time;
  let note=x.reason||'Planned for this slot';
  if(done&&actual)note=`Actual ${actual.actualMinutes}m · ${actual.delayMinutes>0?`started ${actual.delayMinutes}m late`:actual.delayMinutes<0?`started ${Math.abs(actual.delayMinutes)}m early`:'started on time'}`;
  else if(active)note=`Running · planned ${Number(x.duration)||S.profile.sessionMinutes}m`;
  else if(x._deferred)note='No safe slot left today — moved to next active day after completion';
  else if(late)note=`${late}m late · start when ready and StudyForge will reflow the rest`;
  else if(moved)note=`Projected ${pretty(display)} · originally ${pretty(x.time)}`;

  let action='';
  if(passive)action=`<span class="passive-mark">${x.type==='break'?'↻':'•'}</span>`;
  else if(done)action='<button class="check on">✓</button>';
  else if(active)action='<button class="mini-action complete" onclick="sf33CompleteActive()">Done</button>';
  else if(x._deferred)action='<span class="passive-mark">→</span>';
  else action=`<button class="mini-action" onclick="sf33StartTask('${x.id}')">Start</button><button class="move-action" onclick="sf33MoveTask('${x.id}')">Move</button>`;

  return `<div class="timeline ${done?'done':''} ${active?'live-active':''} ${x.locked?'locked':''}"><div class="time"><span data-projected-id="${esc(x.id)}">${x._deferred?'Next':pretty(display)}</span><div class="note">${x._deferred?'active day':`${x.duration||S.profile.sessionMinutes}m`}</div></div><div class="emoji">${x.emoji||'🎯'}</div><div><div class="task-meta">${esc(x.skill||'General')} · ${esc(x.type||'task')}</div><div class="t-title">${esc(x.title)}</div><div class="note">${esc(note)}</div>${active?'<div class="live-mini" data-live-elapsed>'+sf33ElapsedLabel()+'</div>':''}</div><div class="task-actions">${action}</div></div>`;
}
function sf33ActiveCard(){
  const L=sf33LiveState();if(!L.activeId)return '';
  const task=todayPlan().find(x=>x.id===L.activeId);if(!task)return '';
  const elapsed=sf33ElapsedMinutes(),planned=Number(task.duration)||S.profile.sessionMinutes,over=Math.max(0,elapsed-planned),pct=Math.min(100,Math.round(elapsed/planned*100));
  const delay=Math.round(sf33StampMinute(L.startedAt)-mins(task.time));
  return `<div class="live-card"><div class="eyebrow">NOW RUNNING</div><div class="live-title">${esc(task.title)}</div><div class="live-clock" data-live-elapsed>${sf33ElapsedLabel()}</div><div class="live-meta"><span>${delay>0?`Started ${delay}m late`:delay<0?`Started ${Math.abs(delay)}m early`:'Started on time'}</span><span data-live-overrun>${over?`+${over}m over plan`:`${Math.max(0,planned-elapsed)}m planned left`}</span></div><div class="bar"><div class="fill" data-live-progress style="width:${pct}%"></div></div><button class="btn green live-done" onclick="sf33CompleteActive()">Complete task</button></div>`;
}
function sf33Overview(projected){
  const work=projected.filter(sf33IsWork),done=work.filter(x=>sf33IsDone(x.id)).length,pct=work.length?Math.round(done/work.length*100):0;
  const actuals=Object.values(sf33LiveState().actuals||{}),focus=actuals.reduce((n,a)=>n+(Number(a.actualMinutes)||0),0);
  return `<div class="today-overview"><div><div class="eyebrow">TODAY</div><div class="overview-big">${pct}%</div><div class="note">${done}/${work.length} tasks completed</div></div><div class="overview-side"><b>${focus}m</b><span>actual focus</span><b>${activeHours().length}h</b><span>active map</span></div><div class="overview-bar"><div style="width:${pct}%"></div></div></div>`;
}
function todayView(){
  const projected=sf33ProjectedPlan();
  const combined=[...projected,...sf33PrayerItems()].sort((a,b)=>{
    const aa=a._deferred?2000:mins(sf33RowTime(a)),bb=b._deferred?2000:mins(sf33RowTime(b));return aa-bb;
  });
  return `<div class="header simple-home"><div><div class="eyebrow">${new Date().toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'})}</div><div class="title">${S.profile.name?`Hi, ${esc(S.profile.name)}`:'StudyForge'}</div></div><button class="ghost" onclick="generatePlan(false)">✨ Re-plan</button></div>${sf33Overview(projected)}${sf33ActiveCard()}<div class="section compact-section"><div><div class="eyebrow">TIMELINE</div><h3>Today’s flow</h3></div><button class="linkbtn" onclick="openQuickTask()">+ Task</button></div>${combined.length?combined.map(taskRow).join(''):`<div class="card"><b>No items for today</b><div class="note">Add a task or run AI re-plan.</div></div>`}`;
}
function progressView(){
  const plan=todayPlan(),work=plan.filter(sf33IsWork),done=work.filter(x=>sf33IsDone(x.id)).length,actuals=Object.values(sf33LiveState().actuals||{}),actual=actuals.reduce((n,a)=>n+(Number(a.actualMinutes)||0),0),planned=actuals.reduce((n,a)=>n+(Number(a.plannedMinutes)||0),0),delay=actuals.length?Math.round(actuals.reduce((n,a)=>n+(Number(a.delayMinutes)||0),0)/actuals.length):0;
  return `<div class="eyebrow">PROGRESS</div><div class="title">Real execution</div><div class="grid2"><div class="metric"><span class="note">Tasks done</span><b>${done}/${work.length}</b></div><div class="metric"><span class="note">Actual focus</span><b>${actual}m</b></div><div class="metric"><span class="note">Planned for completed</span><b>${planned}m</b></div><div class="metric"><span class="note">Avg start shift</span><b>${delay>0?'+':''}${delay}m</b></div></div><div class="card" style="margin-top:11px"><b>Adaptive rule</b><div class="note">Late starts and overruns move flexible work forward while active hours, prayer windows, routines and locked items stay protected.</div></div>`;
}
function settingsView(){return `<div class="eyebrow">CUSTOMIZE</div><div class="title">Planner setup</div><div class="card"><b>24-hour availability</b><div class="note">Change active days/hours, skills, session length or Prayer Mode from the setup wizard.</div><button class="btn" style="width:100%;margin-top:12px" onclick="resetSetup()">Run detailed setup again</button></div><div class="card"><b>Today’s active hours</b><div class="note">${availabilityText(new Date().getDay())}</div></div><div class="card"><b>Live Day Engine</b><div class="note">Task timing uses saved timestamps, so if iOS pauses this PWA in the background the elapsed time is recalculated correctly when you return.</div></div>${batteryCard()}`}
function sf33Tick(){
  const L=sf33LiveState();if(!L.activeId)return;
  const task=todayPlan().find(x=>x.id===L.activeId);if(!task)return;
  const elapsed=sf33ElapsedMinutes(),planned=Number(task.duration)||S.profile.sessionMinutes,over=Math.max(0,elapsed-planned),pct=Math.min(100,Math.round(elapsed/planned*100));
  document.querySelectorAll('[data-live-elapsed]').forEach(e=>e.textContent=sf33ElapsedLabel());
  document.querySelectorAll('[data-live-overrun]').forEach(e=>e.textContent=over?`+${over}m over plan`:`${Math.max(0,planned-elapsed)}m planned left`);
  document.querySelectorAll('[data-live-progress]').forEach(e=>e.style.width=`${pct}%`);
  const projection=sf33ProjectedPlan();
  const times=new Map(projection.map(x=>[x.id,x._deferred?'Next':pretty(sf33RowTime(x))]));
  document.querySelectorAll('[data-projected-id]').forEach(e=>{const v=times.get(e.dataset.projectedId);if(v)e.textContent=v});
}
setInterval(sf33Tick,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();sf33Tick()}});
render();
