// StudyForge 3.2 human-rhythm local scheduler.
// Loaded after app.js so this intentionally overrides localPlan().
function sf32IsFullDayLike(hours){
  if(!hours?.length)return false;
  const sorted=[...hours].sort((a,b)=>a-b);
  const span=sorted[sorted.length-1]-sorted[0]+1;
  return sorted.length>=12&&span>=12;
}
function sf32MinuteInsideActive(minute,hours){
  const h=Math.floor(minute/60);
  return hours.includes(h);
}
function sf32RoutineBlocks(){
  const hours=activeHours(),blocks=[];
  if(!hours.length)return blocks;
  const full=sf32IsFullDayLike(hours);
  const add=(id,time,duration,title,emoji,reason)=>{
    const start=mins(time),end=start+duration;
    for(let m=start;m<end;m+=10){if(!sf32MinuteInsideActive(m,hours))return}
    blocks.push({id:`routine-${keyFor()}-${id}`,time,duration,title,skill:'Daily routine',type:'routine',priority:'low',reason,locked:true,emoji});
  };
  // Long active windows that cross meals should still leave room to eat.
  const slots=localSlots();
  const hasLongWindow=slots.some(([a,b])=>b-a>=240);
  if(full){
    add('morning','07:30',30,'Morning reset','🌤️','Hygiene, water and a calm start before focused work');
    add('breakfast','08:00',30,'Breakfast','🥣','Fuel before the main work blocks');
    add('lunch','13:00',45,'Lunch + reset','🍽️','Meal and a proper mental reset');
    add('move','17:00',25,'Move + refresh','🚶','Short walk, stretch or screen break');
    add('dinner','20:00',45,'Dinner / personal reset','🍲','Protect a normal evening meal and reset');
    add('wind','22:00',30,'Wind-down','🌙','Reduce intensity and close the day');
  }else if(hasLongWindow){
    add('lunch','13:00',40,'Lunch + reset','🍽️','A long active window should include a proper meal break');
    add('dinner','20:00',40,'Dinner / reset','🍲','Protect a meal break when the active window crosses dinner');
  }
  return blocks.sort((a,b)=>mins(a.time)-mins(b.time));
}
function sf32SubtractBlocks(slots,blocks){
  let result=[...slots];
  for(const block of blocks){
    const x=mins(block.time),y=x+block.duration;
    result=result.flatMap(([a,b])=>{
      if(y<=a||x>=b)return [[a,b]];
      return [[a,Math.max(a,x)],[Math.min(b,y),b]].filter(([s,e])=>e-s>=20);
    });
  }
  return result.sort((a,b)=>a[0]-b[0]);
}
function localPlan(){
  const priority={high:0,medium:1,low:2};
  const pending=S.tasks.filter(x=>!x.done).sort((a,b)=>(priority[a.priority]??1)-(priority[b.priority]??1));
  const skills=profileSkills();
  const items=pending.length?pending:skills.flatMap((s,i)=>[
    {id:`learn-${i}`,title:`Learn ${s} core concept`,skill:s,duration:S.profile.sessionMinutes,priority:'medium',type:'learn',emoji:'📚'},
    {id:`practice-${i}`,title:`Practice ${s}`,skill:s,duration:S.profile.sessionMinutes,priority:'medium',type:'practice',emoji:'⌨️'},
    {id:`apply-${i}`,title:`Apply ${s} in a mini task`,skill:s,duration:S.profile.sessionMinutes,priority:'medium',type:'project',emoji:'🛠️'}
  ]);
  const routines=sf32RoutineBlocks();
  let slots=sf32SubtractBlocks(localSlots(),routines);
  const hours=activeHours();
  if(sf32IsFullDayLike(hours)){
    // If someone marks virtually the whole day active, treat overnight as normal sleep/protected time.
    slots=slots.flatMap(([a,b])=>[[Math.max(a,7*60),Math.min(b,23*60)]].filter(([s,e])=>e-s>=20));
  }
  const out=[...routines];
  let idx=0,focusCount=0,breakCount=0;
  const preferred=Math.max(25,Math.min(90,Number(S.profile.sessionMinutes)||50));
  const shortBreak=preferred>60?15:10;
  for(const [a,b] of slots){
    let cursor=a;
    while(idx<items.length){
      const t=items[idx];
      const remaining=b-cursor;
      if(remaining<25)break;
      const dur=Math.min(Number(t.duration)||preferred,preferred,remaining);
      if(dur<20)break;
      out.push({id:`local-${keyFor()}-${idx}`,time:hhmm(cursor),duration:dur,title:t.title,skill:t.skill||skills[0]||'General',type:t.type||'task',priority:t.priority||'medium',reason:pending.length?'Placed from your pending task bank':'Skill-development session for your goal',locked:false,emoji:t.emoji||'🎯'});
      cursor+=dur;idx++;focusCount++;
      if(idx>=items.length)break;
      const rest=focusCount%2===0?20:shortBreak;
      if(cursor+rest<=b){
        out.push({id:`break-${keyFor()}-${breakCount++}`,time:hhmm(cursor),duration:rest,title:rest>=20?'Long reset':'Short break',skill:'Recovery',type:'break',priority:'low',reason:rest>=20?'Step away, hydrate and reset before the next block':'Rest your eyes, move and reset',locked:true,emoji:rest>=20?'☕':'🫗'});
        cursor+=rest;
      }else break;
    }
    if(idx>=items.length)break;
  }
  return out.sort((a,b)=>mins(a.time)-mins(b.time));
}
