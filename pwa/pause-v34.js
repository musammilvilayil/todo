// StudyForge 3.4 pause/resume layer for the Live Day Engine.
// Loaded after live-day-v33.js. Pause stops focus time, not real-world schedule time.

function sf34LiveState(){
  const L=sf33LiveState();
  if(typeof L.pausedAt==='undefined')L.pausedAt=null;
  if(typeof L.totalPausedMs!=='number')L.totalPausedMs=0;
  return L;
}
function sf34IsPaused(){const L=sf34LiveState();return !!(L.activeId&&L.pausedAt)}
function sf34PauseMs(includeCurrent=true){
  const L=sf34LiveState();
  let ms=Math.max(0,Number(L.totalPausedMs)||0);
  if(includeCurrent&&L.pausedAt)ms+=Math.max(0,Date.now()-L.pausedAt);
  return ms;
}
function sf34ActiveElapsedMs(){
  const L=sf34LiveState();
  if(!L.activeId||!L.startedAt)return 0;
  const end=L.pausedAt||Date.now();
  return Math.max(0,end-L.startedAt-(Number(L.totalPausedMs)||0));
}
function sf33ElapsedMinutes(){return Math.max(0,Math.floor(sf34ActiveElapsedMs()/60000))}
function sf33ElapsedLabel(){
  const total=Math.max(0,Math.floor(sf34ActiveElapsedMs()/1000));
  const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function sf34PauseLabel(){
  const total=Math.max(0,Math.floor(sf34PauseMs(true)/60000)),h=Math.floor(total/60),m=total%60;
  return h?`${h}h ${m}m`:`${m}m`;
}
function sf33AnchorForActive(active){
  const L=sf34LiveState();
  if(!active||!L.startedAt)return sf33NowMinute();
  const elapsed=sf34ActiveElapsedMs()/60000;
  const remaining=Math.max(0,(Number(active.duration)||S.profile.sessionMinutes)-elapsed);
  return Math.min(1439,Math.round(sf33NowMinute()+remaining));
}
function sf33StartTask(id){
  const L=sf34LiveState();
  if(L.activeId&&L.activeId!==id){toast('Complete or move the running task first');return}
  const task=todayPlan().find(x=>x.id===id);
  if(!task||!sf33IsWork(task)||sf33IsDone(id))return;
  const prayer=sf33OverduePrayer();
  if(prayer)toast(`${prayer.name} is still pending`);
  L.activeId=id;
  L.startedAt=Date.now();
  L.pausedAt=null;
  L.totalPausedMs=0;
  save();render();sf33Tick();
}
function sf34PauseTask(){
  const L=sf34LiveState();
  if(!L.activeId||!L.startedAt||L.pausedAt)return;
  L.pausedAt=Date.now();
  save();render();sf33Tick();toast('Task paused — focus timer stopped');
}
function sf34ResumeTask(){
  const L=sf34LiveState();
  if(!L.activeId||!L.startedAt||!L.pausedAt)return;
  L.totalPausedMs=(Number(L.totalPausedMs)||0)+Math.max(0,Date.now()-L.pausedAt);
  L.pausedAt=null;
  save();render();sf33Tick();toast('Task resumed');
}
function sf33CompleteActive(){
  const L=sf34LiveState();
  if(!L.activeId||!L.startedAt)return;
  const id=L.activeId,task=todayPlan().find(x=>x.id===id);
  if(!task){L.activeId=null;L.startedAt=null;L.pausedAt=null;L.totalPausedMs=0;save();render();return}
  const completedAt=Date.now();
  const pauseMs=sf34PauseMs(true);
  const wallMs=Math.max(0,completedAt-L.startedAt);
  const activeMs=Math.max(0,wallMs-pauseMs);
  const actualMinutes=Math.max(1,Math.round(activeMs/60000));
  const wallMinutes=Math.max(1,Math.round(wallMs/60000));
  const pauseMinutes=Math.max(0,Math.round(pauseMs/60000));
  const delayMinutes=Math.round(sf33StampMinute(L.startedAt)-mins(task.time));
  L.actuals=L.actuals||{};
  L.actuals[id]={startedAt:L.startedAt,completedAt,actualMinutes,wallMinutes,pauseMinutes,plannedMinutes:Number(task.duration)||S.profile.sessionMinutes,delayMinutes};
  S.checks[keyFor()]=S.checks[keyFor()]||{};
  S.checks[keyFor()][id]=true;
  const bank=S.tasks.find(t=>!t.done&&(t.id===id||t.title===task.title));if(bank)bank.done=true;
  L.activeId=null;L.startedAt=null;L.pausedAt=null;L.totalPausedMs=0;
  sf33CommitReflow(sf33NowMinute());
  save();render();toast('Completed — rest of the day reflowed');
}
function taskRow(x){
  if(x.type==='prayer')return sf33PrayerRow(x);
  const L=sf34LiveState(),active=L.activeId===x.id,paused=active&&!!L.pausedAt,done=sf33IsDone(x.id),actual=sf33Actual(x.id);
  const display=sf33RowTime(x),scheduled=mins(x.time),now=sf33NowMinute();
  const late=!done&&!active&&sf33IsWork(x)&&now>scheduled?now-scheduled:0;
  const passive=['routine','break'].includes(x.type);
  const moved=x._moved&&display!==x.time;
  let note=x.reason||'Planned for this slot';
  if(done&&actual)note=`Focus ${actual.actualMinutes}m · paused ${actual.pauseMinutes||0}m · wall ${actual.wallMinutes||actual.actualMinutes}m`;
  else if(active&&paused)note=`Paused · focus ${sf33ElapsedLabel()} · schedule still adapts to real time`;
  else if(active)note=`Running · planned ${Number(x.duration)||S.profile.sessionMinutes}m`;
  else if(x._deferred)note='No safe slot left today — moved to next active day after completion';
  else if(late)note=`${late}m late · start when ready and StudyForge will reflow the rest`;
  else if(moved)note=`Projected ${pretty(display)} · originally ${pretty(x.time)}`;
  let action='';
  if(passive)action=`<span class="passive-mark">${x.type==='break'?'↻':'•'}</span>`;
  else if(done)action='<button class="check on">✓</button>';
  else if(active&&paused)action='<button class="mini-action resume" onclick="sf34ResumeTask()">Resume</button><button class="move-action" onclick="sf33CompleteActive()">Done</button>';
  else if(active)action='<button class="mini-action pause" onclick="sf34PauseTask()">Pause</button><button class="move-action" onclick="sf33CompleteActive()">Done</button>';
  else if(x._deferred)action='<span class="passive-mark">→</span>';
  else action=`<button class="mini-action" onclick="sf33StartTask('${x.id}')">Start</button><button class="move-action" onclick="sf33MoveTask('${x.id}')">Move</button>`;
  return `<div class="timeline ${done?'done':''} ${active?'live-active':''} ${paused?'live-paused':''} ${x.locked?'locked':''}"><div class="time"><span data-projected-id="${esc(x.id)}">${x._deferred?'Next':pretty(display)}</span><div class="note">${x._deferred?'active day':`${x.duration||S.profile.sessionMinutes}m`}</div></div><div class="emoji">${x.emoji||'🎯'}</div><div><div class="task-meta">${esc(x.skill||'General')} · ${paused?'paused':esc(x.type||'task')}</div><div class="t-title">${esc(x.title)}</div><div class="note">${esc(note)}</div>${active?'<div class="live-mini" data-live-elapsed>'+sf33ElapsedLabel()+'</div>':''}</div><div class="task-actions">${action}</div></div>`;
}
function sf33ActiveCard(){
  const L=sf34LiveState();if(!L.activeId)return '';
  const task=todayPlan().find(x=>x.id===L.activeId);if(!task)return '';
  const paused=!!L.pausedAt,elapsed=sf33ElapsedMinutes(),planned=Number(task.duration)||S.profile.sessionMinutes,over=Math.max(0,elapsed-planned),pct=Math.min(100,Math.round(elapsed/planned*100));
  const delay=Math.round(sf33StampMinute(L.startedAt)-mins(task.time));
  return `<div class="live-card ${paused?'paused':''}"><div class="eyebrow">${paused?'PAUSED':'NOW RUNNING'}</div><div class="live-title">${esc(task.title)}</div><div class="live-clock" data-live-elapsed>${sf33ElapsedLabel()}</div><div class="live-meta"><span>${delay>0?`Started ${delay}m late`:delay<0?`Started ${Math.abs(delay)}m early`:'Started on time'}</span><span data-live-overrun>${paused?`Paused ${sf34PauseLabel()}`:over?`+${over}m over plan`:`${Math.max(0,planned-elapsed)}m planned left`}</span></div><div class="bar"><div class="fill" data-live-progress style="width:${pct}%"></div></div><div class="live-actions"><button class="btn secondary" onclick="${paused?'sf34ResumeTask()':'sf34PauseTask()'}">${paused?'Resume':'Pause'}</button><button class="btn green" onclick="sf33CompleteActive()">Complete task</button></div></div>`;
}
function progressView(){
  const plan=todayPlan(),work=plan.filter(sf33IsWork),done=work.filter(x=>sf33IsDone(x.id)).length,actuals=Object.values(sf34LiveState().actuals||{});
  const actual=actuals.reduce((n,a)=>n+(Number(a.actualMinutes)||0),0),planned=actuals.reduce((n,a)=>n+(Number(a.plannedMinutes)||0),0),paused=actuals.reduce((n,a)=>n+(Number(a.pauseMinutes)||0),0),delay=actuals.length?Math.round(actuals.reduce((n,a)=>n+(Number(a.delayMinutes)||0),0)/actuals.length):0;
  return `<div class="eyebrow">PROGRESS</div><div class="title">Real execution</div><div class="grid2"><div class="metric"><span class="note">Tasks done</span><b>${done}/${work.length}</b></div><div class="metric"><span class="note">Actual focus</span><b>${actual}m</b></div><div class="metric"><span class="note">Paused</span><b>${paused}m</b></div><div class="metric"><span class="note">Avg start shift</span><b>${delay>0?'+':''}${delay}m</b></div></div><div class="card" style="margin-top:11px"><b>Planned vs actual</b><div class="note">Completed work: ${planned}m planned · ${actual}m active focus. Pause time is tracked separately and still pushes later flexible tasks forward.</div></div>`;
}
render();

// Load Personal OS, then Off Day v4.1, then the one-tap Home control.
(function(){
  const addCss=(href,key)=>{if(document.querySelector(`link[data-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute(`data-${key}`,'1');document.head.appendChild(l)};
  const loadScript=(src,key)=>new Promise((resolve,reject)=>{const existing=document.querySelector(`script[data-${key}]`);if(existing){if(existing.dataset.loaded==='1')resolve();else existing.addEventListener('load',resolve,{once:true});return}const s=document.createElement('script');s.src=src;s.setAttribute(`data-${key}`,'1');s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=reject;document.body.appendChild(s)});
  addCss('./personal-os-v40.css','sf40');
  addCss('./offday-v41.css','sf41');
  loadScript('./personal-os-v40.js','sf40')
    .then(()=>loadScript('./offday-v41.js','sf41'))
    .then(()=>loadScript('./home-offday-v42.js','sf42'))
    .catch(()=>toast('Advanced planner modules could not load'));
})();