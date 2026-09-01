// StudyForge 4.3 — automatic missed-task recovery + one-tap Home Off Day.
// Loaded after Personal OS v4 and Off Day v4.1.
// If the user returns after missing scheduled work, rebuild from the current time,
// fit as much as safely possible into today's remaining active windows, and carry
// overflow across later active days.
(function sf43Boot(){
  const ready=typeof todayView==='function'&&typeof sf41IsOffDay==='function'&&typeof sf40OS==='function'&&typeof sf41EnsureRoutines==='function'&&typeof sf34LiveState==='function';
  if(!ready){setTimeout(sf43Boot,80);return}
  if(window.__sf43Ready)return;
  window.__sf43Ready=true;

  function store(){
    S.recovery=S.recovery||{};
    S.recovery[keyFor()]=S.recovery[keyFor()]||{};
    return S.recovery[keyFor()];
  }
  function priorityRank(x){return ({high:0,medium:1,low:2}[x?.priority]??1)}
  function deadlineRank(x){
    if(!x?.deadline)return Number.MAX_SAFE_INTEGER;
    const n=new Date(x.deadline).getTime();return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER;
  }
  function sortWork(items){
    return [...items].sort((a,b)=>priorityRank(a)-priorityRank(b)||deadlineRank(a)-deadlineRank(b)||mins(a.time)-mins(b.time));
  }
  function practicalStart(now=sf33NowMinute()){
    // Give the user a small settle-in window, then start on a clean half-hour boundary.
    // Example: open at 13:30 -> first recovered task at 14:00.
    return Math.min(1440,Math.ceil((now+10)/30)*30);
  }
  function prayerBlocks(){
    if(!S.profile.prayerMode)return [];
    return Object.values(prayers()).map(t=>[Math.max(0,mins(t)-10),Math.min(1440,mins(t)+20)]);
  }
  function fixedForRecovery(item){
    if(!item)return false;
    if(item.type==='routine'||item.type==='event'||item.hardFixed)return true;
    return !!(item.locked&&sf33IsWork(item));
  }
  function validBlock(item){
    const a=mins(item.time),d=Math.max(1,Number(item.duration)||S.profile.sessionMinutes),b=a+d;
    return a>=0&&b>a?[a,b]:null;
  }
  function findSlot(slots,cursor,duration){
    for(const [a,b] of slots){
      const s=Math.max(a,cursor);
      if(s+duration<=b)return {start:s,end:s+duration,slotEnd:b};
    }
    return null;
  }
  function removeOldRecoveryCopies(sourceKey,ids=[]){
    const idset=new Set(ids);
    for(const [k,plan] of Object.entries(S.plans||{})){
      if(k===sourceKey)continue;
      S.plans[k]=(plan||[]).filter(x=>x._recoveryFrom!==sourceKey&&!idset.has(x.id));
    }
  }
  function keepTodayItem(x){
    if(sf33IsDone(x.id))return true;
    if(x.type==='routine'||x.type==='event')return true;
    if(x.hardFixed)return true;
    if(x.locked&&sf33IsWork(x))return true;
    return false;
  }
  function addBreak(rows,k,start,duration,longBreak=false){
    rows.push({
      id:`recover-break-${k}-${start}-${Math.random().toString(36).slice(2,5)}`,
      time:hhmm(start),duration,title:longBreak?'Long reset':'Short break',skill:'Recovery',type:'break',priority:'low',
      reason:longBreak?'Reset before the next focus block':'Short recovery between focus blocks',emoji:longBreak?'☕':'🫗',locked:false,_recoveryGenerated:true
    });
  }
  function currentSlots(base,start){
    let slots=sf33Windows(); // already respects today's active hours + prayer protection
    const blocks=base.filter(fixedForRecovery).map(validBlock).filter(Boolean).filter(([,b])=>b>start);
    slots=sf33Subtract(slots,blocks);
    return slots.map(([a,b])=>[Math.max(a,start),b]).filter(([a,b])=>b-a>=10);
  }
  function futureWindows(day){
    let slots=sf41TargetWindows(day);
    slots=sf33Subtract(slots,prayerBlocks()); // approximate protection; rechecked when that day becomes current
    return slots;
  }
  function distributeFuture(sourceKey,overflow){
    let queue=sortWork(overflow).map(x=>({...x}));
    const placed=[];
    const sourceDate=sf40DateObj(sourceKey);
    for(let offset=1;offset<=21&&queue.length;offset++){
      const d=new Date(sourceDate);d.setDate(d.getDate()+offset);
      const k=keyFor(d),day=d.getDay();
      if(!S.profile.availableDays.includes(day))continue;
      if(sf41IsOffDay(k))continue;
      S.plans[k]=S.plans[k]||[];
      sf41EnsureRoutines(k);
      let plan=S.plans[k];
      const occupied=plan.map(validBlock).filter(Boolean);
      let slots=sf33Subtract(futureWindows(day),occupied);
      if(!slots.length)continue;
      let cursor=slots[0][0],sessionCount=0;
      const remain=[];
      for(const item of queue){
        const dur=Math.max(10,Number(item.duration)||S.profile.sessionMinutes);
        const spot=findSlot(slots,cursor,dur);
        if(!spot){remain.push(item);continue}
        const copy={...item,time:hhmm(spot.start),duration:dur,locked:false,_recoveryFrom:sourceKey,_recoveryFuture:true,reason:`Recovered from missed work on ${sourceKey}`};
        plan.push(copy);placed.push({date:k,id:copy.id});
        sf41UpsertBank(copy);
        sessionCount++;
        const gap=sessionCount%2===0?20:10;
        cursor=spot.end+gap;
      }
      S.plans[k]=plan.sort((a,b)=>mins(a.time)-mins(b.time));
      queue=remain;
    }
    for(const item of queue)sf41UpsertBank(item);
    return {placed,unscheduled:queue};
  }

  window.sf43RecoverNow=function(opts={}){
    const silent=!!opts.silent,force=!!opts.force,k=keyFor();
    if(sf41IsOffDay(k))return {changed:false,reason:'off-day'};
    const L=sf34LiveState();
    if(L.activeId)return {changed:false,reason:'running'};
    sf41EnsureRoutines(k);
    const now=sf33NowMinute();
    const plan=todayPlan();
    const flexible=plan.filter(x=>sf33IsWork(x)&&!sf33IsDone(x.id)&&!x.locked);
    const missed=flexible.filter(x=>mins(x.time)<now-5);
    if(!force&&!missed.length)return {changed:false,reason:'nothing-missed'};
    if(!flexible.length)return {changed:false,reason:'no-work'};

    const start=practicalStart(now);
    sf40Snapshot('automatic missed-task recovery');
    removeOldRecoveryCopies(k,flexible.map(x=>x.id));

    // Drop old flexible work/break rows; keep completed history, routines, fixed events and locked work.
    const base=plan.filter(keepTodayItem).filter(x=>!x._recoveryGenerated);
    const slots=currentSlots(base,start);
    const placed=[],breaks=[],overflow=[];
    let cursor=start,sessionCount=0;
    for(const item of sortWork(flexible)){
      const dur=Math.max(10,Number(item.duration)||S.profile.sessionMinutes);
      const spot=findSlot(slots,cursor,dur);
      if(!spot){overflow.push(item);continue}
      const copy={...item,time:hhmm(spot.start),duration:dur,_recoveredAt:Date.now(),_recoveryFrom:k,reason:item.reason||'Recovered from a missed earlier slot'};
      placed.push(copy);sf41UpsertBank(copy);
      sessionCount++;
      const gap=sessionCount%2===0?20:10;
      if(spot.end+gap<=spot.slotEnd)addBreak(breaks,k,spot.end,gap,gap===20);
      cursor=spot.end+gap;
    }

    S.plans[k]=[...base,...placed,...breaks].sort((a,b)=>mins(a.time)-mins(b.time));
    sf41EnsureRoutines(k);
    const future=distributeFuture(k,overflow);
    const r=store();
    r.lastAt=Date.now();r.detectedAtMinute=now;r.restartMinute=start;r.missedCount=missed.length;r.todayCount=placed.length;r.movedCount=future.placed.length;r.unscheduledCount=future.unscheduled.length;
    r.futureDates=[...new Set(future.placed.map(x=>x.date))];
    save();render();
    if(!silent){
      const moved=future.placed.length+future.unscheduled.length;
      toast(`Day recovered · ${placed.length} task(s) today${moved?` · ${moved} moved forward`:''}`);
    }
    return {changed:true,today:placed.length,moved:future.placed.length,backlog:future.unscheduled.length,start:hhmm(start)};
  };

  // One-tap Off Day directly on Home. This also fixes older builds where v4.2 existed
  // in the cache but was not actually loaded by the runtime chain.
  window.sf43ToggleOffDay=async function(btn){
    if(btn)btn.disabled=true;
    try{
      const o=sf40OS(),k=keyFor(),turnOn=!sf41IsOffDay(k),old=sf41OverrideFor(k);
      sf40Snapshot(turnOn?'home Off Day on':'home Off Day off');
      o.dayOverrides[k]={...old,offDay:turnOn};save();
      if(turnOn){
        const r=sf41ApplyOffDay();
        toast(r.nextKey?`Off Day ON · ${r.moved} task(s) moved forward`:'Off Day ON · work moved to backlog');
      }else{
        sf41CancelOffDay();
        await generatePlan(false);
        sf43RecoverNow({silent:true});
        toast('Off Day OFF · today rebuilt');
      }
      render();
    }catch(e){console.error(e);toast('Could not change Off Day')}
    finally{if(btn)btn.disabled=false}
  };

  const baseToday=todayView;
  todayView=function(){
    let html=baseToday();
    const on=sf41IsOffDay();
    const old='<button class="ghost" onclick="generatePlan(false)">✨ Re-plan</button>';
    const controls=`<div class="sf43-home-actions"><button class="sf43-off-btn ${on?'on':''}" onclick="sf43ToggleOffDay(this)">${on?'✓ Off Day':'🌿 Off Day'}</button><button class="ghost" onclick="generatePlan(false)">✨ Re-plan</button></div>`;
    if(html.includes(old))html=html.replace(old,controls);
    else html=`<div class="sf43-home-actions" style="justify-content:flex-end;margin-bottom:8px"><button class="sf43-off-btn ${on?'on':''}" onclick="sf43ToggleOffDay(this)">${on?'✓ Off Day':'🌿 Off Day'}</button></div>${html}`;
    return html;
  };

  const style=document.createElement('style');
  style.textContent=`
    .sf43-home-actions{display:flex;align-items:center;gap:6px}
    .sf43-off-btn{border:1px solid #355b4c;background:#10241d;color:#8ce7c2;border-radius:12px;padding:8px 10px;font-size:10px;font-weight:900;white-space:nowrap}
    .sf43-off-btn.on{background:#1d6a50;border-color:#2f9874;color:#fff}
    .sf43-off-btn:disabled{opacity:.55}
    @media(max-width:420px){.sf43-home-actions{gap:3px}.sf43-off-btn{padding:7px 8px;font-size:9px}.sf43-home-actions .ghost{padding:7px 4px;font-size:9px}}
  `;
  document.head.appendChild(style);

  let autoTimer=null;
  function autoRecover(){
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{
      if(document.hidden)return;
      const result=sf43RecoverNow({silent:true});
      if(result?.changed){
        const moved=(result.moved||0)+(result.backlog||0);
        toast(`Schedule updated from now · ${result.today} today${moved?` · ${moved} later`:''}`);
      }
    },220);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoRecover()});
  window.addEventListener('pageshow',autoRecover);
  window.addEventListener('focus',autoRecover);
  autoRecover();
  render();
})();