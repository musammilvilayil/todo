// StudyForge 4.1 Off Day + Daily Routine layer.
// Loaded after Personal OS v4. Keeps prayer/routines alive while work is moved forward.

function sf41Store(){
  S.offDay=S.offDay||{};
  S.routineChecks=S.routineChecks||{};
  return S.offDay;
}
function sf41OverrideFor(k=keyFor()){
  const o=sf40OS();
  const base=o.dayOverrides[k]||{};
  return Object.assign({mode:o.settings.workloadMode,energy:o.settings.energy,limitMinutes:null,emergency:false,offDay:false},base);
}
function sf41IsOffDay(k=keyFor()){return !!sf41OverrideFor(k).offDay}
function sf41RoutineChecks(k=keyFor()){S.routineChecks=S.routineChecks||{};S.routineChecks[k]=S.routineChecks[k]||{};return S.routineChecks[k]}
function sf41RoutineDone(id,k=keyFor()){return !!sf41RoutineChecks(k)[id]}
function sf41ToggleRoutine(id){const c=sf41RoutineChecks();c[id]=!c[id];save();render()}
function sf41DefaultRoutines(k=keyFor()){
  return [
    {id:`routine-${k}-morning`,time:'07:30',duration:20,title:'Morning reset',skill:'Daily routine',type:'routine',priority:'low',reason:'Freshen up, hydrate and start the day calmly',locked:true,emoji:'🌤️'},
    {id:`routine-${k}-breakfast`,time:'08:00',duration:30,title:'Breakfast',skill:'Daily routine',type:'routine',priority:'low',reason:'Fuel and settle into the day',locked:true,emoji:'🥣'},
    {id:`routine-${k}-lunch`,time:'13:00',duration:40,title:'Lunch + reset',skill:'Daily routine',type:'routine',priority:'low',reason:'Meal and a proper mental reset',locked:true,emoji:'🍽️'},
    {id:`routine-${k}-move`,time:'17:00',duration:20,title:'Move + refresh',skill:'Daily routine',type:'routine',priority:'low',reason:'Walk, stretch or get away from the screen',locked:true,emoji:'🚶'},
    {id:`routine-${k}-dinner`,time:'20:00',duration:40,title:'Dinner / personal reset',skill:'Daily routine',type:'routine',priority:'low',reason:'Protect a normal evening meal and reset',locked:true,emoji:'🍲'},
    {id:`routine-${k}-wind`,time:'22:00',duration:30,title:'Wind-down',skill:'Daily routine',type:'routine',priority:'low',reason:'Reduce intensity and close the day',locked:true,emoji:'🌙'}
  ];
}
function sf41EnsureRoutines(k=keyFor()){
  S.plans[k]=S.plans[k]||[];
  const ids=new Set(S.plans[k].filter(x=>x.type==='routine').map(x=>x.id));
  for(const r of sf41DefaultRoutines(k)){
    const sameTitle=S.plans[k].some(x=>x.type==='routine'&&x.title===r.title);
    if(!ids.has(r.id)&&!sameTitle)S.plans[k].push(r);
  }
  S.plans[k].sort((a,b)=>mins(a.time)-mins(b.time));
}
function sf41NextActiveDate(from=new Date()){
  const o=sf40OS();
  for(let i=1;i<=21;i++){
    const d=new Date(from);d.setDate(d.getDate()+i);
    const k=keyFor(d),day=d.getDay();
    if(!S.profile.availableDays.includes(day))continue;
    if(o.dayOverrides?.[k]?.offDay)continue;
    return {date:d,key:k,day};
  }
  return null;
}
function sf41TargetWindows(day){
  const hours=(S.profile.availabilityByDay?.[day]||[]).map(Number).sort((a,b)=>a-b);
  if(!hours.length)return [];
  const out=[];let start=hours[0],prev=hours[0];
  for(let i=1;i<=hours.length;i++){
    if(i<hours.length&&hours[i]===prev+1){prev=hours[i];continue}
    out.push([start*60,(prev+1)*60]);start=hours[i];prev=hours[i];
  }
  return out;
}
function sf41Overlap(a,b,x,y){return a<y&&x<b}
function sf41FindFutureSlot(windows,occupied,duration,cursor){
  for(const [a,b] of windows){
    let s=Math.max(a,cursor||a);
    s=Math.ceil(s/5)*5;
    while(s+duration<=b){
      const hit=occupied.find(([x,y])=>sf41Overlap(s,s+duration,x,y));
      if(!hit)return s;
      s=Math.ceil((hit[1]+10)/5)*5;
    }
  }
  return null;
}
function sf41UpsertBank(item,remaining=null){
  if(!sf33IsWork(item))return;
  const duration=Math.max(10,Number(remaining||item.duration)||S.profile.sessionMinutes);
  let bank=S.tasks.find(t=>!t.done&&(t.id===item.id||t.title===item.title));
  if(bank){bank.duration=duration;bank.priority=item.priority||bank.priority||'medium';bank.skill=item.skill||bank.skill||'General';return bank}
  bank={id:item.id||`carry-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,title:item.title,skill:item.skill||'General',duration,priority:item.priority||'medium',deadline:item.deadline||'',done:false,type:item.type||'task'};
  S.tasks.push(bank);return bank;
}
function sf41CaptureRunningForOffDay(){
  const L=sf34LiveState();
  if(!L.activeId||!L.startedAt)return null;
  const task=todayPlan().find(x=>x.id===L.activeId);
  if(!task){L.activeId=null;L.startedAt=null;L.pausedAt=null;L.totalPausedMs=0;return null}
  const activeMinutes=Math.max(0,Math.round(sf34ActiveElapsedMs()/60000));
  const planned=Math.max(10,Number(task.duration)||S.profile.sessionMinutes);
  const remaining=Math.max(10,planned-activeMinutes);
  const meta=sf40Meta(task.id);
  meta.partialFocusMinutes=(Number(meta.partialFocusMinutes)||0)+activeMinutes;
  meta.progress=Math.max(Number(meta.progress)||0,Math.min(95,Math.round(activeMinutes/planned*100)));
  sf41UpsertBank(task,remaining);
  L.activeId=null;L.startedAt=null;L.pausedAt=null;L.totalPausedMs=0;
  return {task,activeMinutes,remaining};
}
function sf41RemoveCarriedCopies(sourceKey){
  for(const [k,plan] of Object.entries(S.plans||{})){
    if(k===sourceKey)continue;
    S.plans[k]=(plan||[]).filter(x=>x._carriedFrom!==sourceKey);
  }
}
function sf41ScheduleCarried(sourceKey,items){
  const target=sf41NextActiveDate();
  if(!target||!items.length)return null;
  const windows=sf41TargetWindows(target.day);
  if(!windows.length)return target.key;
  S.plans[target.key]=S.plans[target.key]||[];
  const targetPlan=S.plans[target.key];
  const existingIds=new Set(targetPlan.map(x=>x.id));
  const occupied=targetPlan.map(x=>[mins(x.time),mins(x.time)+(Number(x.duration)||S.profile.sessionMinutes)]).filter(([a,b])=>a>=0&&b>a);
  let cursor=windows[0][0];
  const priority={high:0,medium:1,low:2};
  for(const src of [...items].sort((a,b)=>(priority[a.priority]??1)-(priority[b.priority]??1))){
    const bank=sf41UpsertBank(src);
    if(existingIds.has(bank.id))continue;
    const dur=Math.max(10,Number(bank.duration)||S.profile.sessionMinutes);
    const start=sf41FindFutureSlot(windows,occupied,dur,cursor);
    if(start==null)continue;
    const copy={...src,id:bank.id,time:hhmm(start),duration:dur,locked:false,_carriedFrom:sourceKey,reason:`Moved from Off Day ${sourceKey}`};
    targetPlan.push(copy);existingIds.add(copy.id);occupied.push([start,start+dur]);occupied.sort((a,b)=>a[0]-b[0]);cursor=start+dur+10;
  }
  targetPlan.sort((a,b)=>mins(a.time)-mins(b.time));
  sf40OS().tomorrowDraft[target.key]=(targetPlan.filter(x=>x._carriedFrom===sourceKey)).map(x=>clone(x));
  return target.key;
}
function sf41ApplyOffDay(){
  const k=keyFor();sf40Snapshot('before Off Day');
  const running=sf41CaptureRunningForOffDay();
  const work=todayPlan().filter(x=>sf33IsWork(x)&&!sf33IsDone(x.id));
  for(const t of work){
    if(running?.task?.id===t.id)continue;
    sf41UpsertBank(t);
  }
  const unique=[];const seen=new Set();
  for(const t of work){if(!seen.has(t.id)){seen.add(t.id);unique.push(t)}}
  if(running?.task&&!seen.has(running.task.id))unique.push({...running.task,duration:running.remaining});
  S.plans[k]=todayPlan().filter(x=>x.type==='routine'||x.type==='event'||(x.hardFixed&&x.type!=='break'));
  sf41EnsureRoutines(k);
  sf41RemoveCarriedCopies(k);
  const nextKey=sf41ScheduleCarried(k,unique);
  sf41Store()[k]={setAt:Date.now(),moved:unique.length,nextKey};
  save();render();
  return {moved:unique.length,nextKey};
}
function sf41CancelOffDay(){
  const k=keyFor();sf41Snapshot('cancel Off Day');sf41RemoveCarriedCopies(k);delete sf41Store()[k];save();
}

const sf41BaseGenerate=generatePlan;
generatePlan=async function(silent=false){
  if(sf41IsOffDay()){
    sf41EnsureRoutines();save();if(!silent)toast('Off Day is active — work stays rescheduled');render();return;
  }
  return sf41BaseGenerate(silent);
}
const sf41BaseStart=sf33StartTask;
sf33StartTask=function(id){if(sf41IsOffDay()){toast('Off Day is active — work is moved to the next active day');return}return sf41BaseStart(id)}

function sf40QuickDay(){
  const x=sf41OverrideFor();
  document.getElementById('modalRoot').innerHTML=`<div class="modal" onclick="if(event.target===this)closeModal()"><div class="sheet"><h3>Quick day override</h3><div class="note">Changes today only. Your normal weekly setup stays untouched.</div><div class="switchrow card sf41-off-switch"><div><b>🌿 Off Day</b><div class="note">Move study/work forward. Keep prayer, daily routines and fixed commitments.</div></div><button id="sf41OffDay" class="switch ${x.offDay?'on':''}"><i></i></button></div><div id="sf41WorkControls" class="${x.offDay?'sf41-disabled':''}"><label class="label">DAY MODE</label><div class="grid2">${['light','balanced','intense','deadline'].map(v=>`<button class="mode ${x.mode===v?'active':''}" data-daymode="${v}">${v}</button>`).join('')}</div><label class="label">ENERGY</label><div class="grid3">${['low','normal','high'].map(v=>`<button class="mode ${x.energy===v?'active':''}" data-energy="${v}">${v}</button>`).join('')}</div><label class="label">MAX FOCUS TODAY</label><select id="sf40Limit" class="select"><option value="">Automatic</option>${[60,120,180,240,300,360].map(n=>`<option value="${n}" ${x.limitMinutes===n?'selected':''}>${n/60}h</option>`).join('')}</select><div class="switchrow card" style="margin-top:12px"><div><b>Emergency day reset</b><div class="note">Keep fixed events/routines; move flexible work out.</div></div><button id="sf40Emergency" class="switch ${x.emergency?'on':''}"><i></i></button></div></div><button class="btn ${x.offDay?'green':''}" onclick="sf40SaveQuickDay()">${x.offDay?'Save Off Day':'Apply + reflow'}</button></div></div>`;
  document.querySelectorAll('[data-daymode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-daymode]').forEach(y=>y.classList.remove('active'));b.classList.add('active')});
  document.querySelectorAll('[data-energy]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-energy]').forEach(y=>y.classList.remove('active'));b.classList.add('active')});
  document.getElementById('sf40Emergency').onclick=e=>e.currentTarget.classList.toggle('on');
  document.getElementById('sf41OffDay').onclick=e=>{e.currentTarget.classList.toggle('on');document.getElementById('sf41WorkControls').classList.toggle('sf41-disabled',e.currentTarget.classList.contains('on'))};
}
async function sf40SaveQuickDay(){
  const o=sf40OS(),k=keyFor(),before=sf41IsOffDay(),off=document.getElementById('sf41OffDay').classList.contains('on');
  sf40Snapshot('before day override');
  o.dayOverrides[k]={mode:document.querySelector('[data-daymode].active')?.dataset.daymode||'balanced',energy:document.querySelector('[data-energy].active')?.dataset.energy||'normal',limitMinutes:Number(document.getElementById('sf40Limit').value)||null,emergency:document.getElementById('sf40Emergency').classList.contains('on'),offDay:off};
  save();closeModal();
  if(off){const r=sf41ApplyOffDay();toast(r.nextKey?`Off Day set · ${r.moved} task(s) moved to ${r.nextKey}`:'Off Day set · work moved to backlog');return}
  if(before&&!off){sf41CancelOffDay();await sf41BaseGenerate(false);render();toast('Off Day removed — today rebuilt');return}
  sf40ApplyPolicy();sf33CommitReflow(sf33NowMinute());render();toast('Today adapted');
}

function sf41RoutineRow(x){
  const done=sf41RoutineDone(x.id),now=sf33NowMinute(),at=mins(x.time),late=Math.max(0,now-at);
  const status=done?'Completed':now>=at?(late?`${late}m pending`:'Ready now'):`In ${at-now}m`;
  return `<div class="timeline routine-line ${done?'done':''}"><div class="time">${pretty(x.time)}<div class="note">routine</div></div><div class="emoji">${x.emoji||'↻'}</div><div><div class="task-meta">Daily routine · ${done?'done':now>=at?'pending':'upcoming'}</div><div class="t-title">${esc(x.title)}</div><div class="note">${esc(status)} · ${esc(x.reason||'Daily routine')}</div></div><div class="task-actions"><button class="check ${done?'on':''}" onclick="sf41ToggleRoutine('${x.id}')">${done?'✓':''}</button></div></div>`;
}
const sf41BaseTaskRow=taskRow;
taskRow=function(x){if(x.type==='routine')return sf41RoutineRow(x);return sf41BaseTaskRow(x)}

const sf41BaseToday=todayView;
todayView=function(){
  if(sf41IsOffDay())sf41EnsureRoutines();
  let base=sf41BaseToday();
  if(!sf41IsOffDay())return base;
  const info=sf41Store()[keyFor()]||{};
  const moved=Number(info.moved)||0,next=info.nextKey||'next active day';
  const banner=`<div class="sf41-off-banner"><div><div class="eyebrow">OFF DAY</div><b>Recovery + routine day 🌿</b><div class="note">${moved} work task(s) moved to ${esc(next)}. Prayer and daily routines stay active.</div></div><button onclick="sf40QuickDay()">Manage</button></div>`;
  return base.replace('<div class="sf40-home-strip">',`${banner}<div class="sf40-home-strip sf41-off-strip">`);
}

const sf41BaseCapacity=sf40CapacityCard;
sf40CapacityCard=function(){if(sf41IsOffDay())return `<div class="card sf41-off-cap"><div class="eyebrow">TODAY</div><b>Off Day 🌿</b><div class="note">No study/work capacity today. Prayer, routines and fixed commitments only.</div></div>`;return sf41BaseCapacity()}

sf41Store();
if(sf41IsOffDay()){sf41ApplyOffDay()}else{sf41EnsureRoutines()}
save();render();
