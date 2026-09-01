// StudyForge 4.2 — one-tap Off Day control on the Home page.
// This file may load before the optional OS layers, so it waits until Off Day v4.1 is ready.
(function sf42Boot(){
  if(typeof todayView!=='function'||typeof sf41IsOffDay!=='function'||typeof sf40OS!=='function'||typeof sf41ApplyOffDay!=='function'){
    setTimeout(sf42Boot,80);return;
  }
  if(window.__sf42HomeOffDayReady)return;
  window.__sf42HomeOffDayReady=true;

  const style=document.createElement('style');
  style.textContent=`
    .sf42-home-actions{display:flex;align-items:center;gap:6px}
    .sf42-off-btn{border:1px solid #355b4c;background:#10241d;color:#8ce7c2;border-radius:12px;padding:8px 10px;font-size:10px;font-weight:900;white-space:nowrap}
    .sf42-off-btn.on{background:#1d6a50;border-color:#2f9874;color:#fff}
    .sf42-off-btn:disabled{opacity:.55}
    @media(max-width:420px){.sf42-home-actions{gap:3px}.sf42-off-btn{padding:7px 8px;font-size:9px}.sf42-home-actions .ghost{padding:7px 4px;font-size:9px}}
  `;
  document.head.appendChild(style);

  window.sf42ToggleOffDay=async function(btn){
    if(btn)btn.disabled=true;
    try{
      const o=sf40OS(),k=keyFor(),turnOn=!sf41IsOffDay();
      sf40Snapshot(turnOn?'home Off Day on':'home Off Day off');
      const old=sf41OverrideFor(k);
      o.dayOverrides[k]={...old,offDay:turnOn};
      save();
      if(turnOn){
        const r=sf41ApplyOffDay();
        toast(r.nextKey?`Off Day ON · ${r.moved} task(s) moved forward`:'Off Day ON · work moved to backlog');
      }else{
        sf41CancelOffDay();
        await generatePlan(false);
        toast('Off Day OFF · today rebuilt');
      }
      render();
    }catch(e){
      console.error(e);toast('Could not change Off Day');
    }finally{if(btn)btn.disabled=false}
  };

  const baseToday=todayView;
  todayView=function(){
    let html=baseToday();
    const on=sf41IsOffDay();
    const old='<button class="ghost" onclick="generatePlan(false)">✨ Re-plan</button>';
    const controls=`<div class="sf42-home-actions"><button class="sf42-off-btn ${on?'on':''}" onclick="sf42ToggleOffDay(this)">${on?'✓ Off Day':'🌿 Off Day'}</button><button class="ghost" onclick="generatePlan(false)">✨ Re-plan</button></div>`;
    if(html.includes(old))html=html.replace(old,controls);
    else html=`<div class="sf42-home-actions" style="justify-content:flex-end;margin-bottom:8px"><button class="sf42-off-btn ${on?'on':''}" onclick="sf42ToggleOffDay(this)">${on?'✓ Off Day':'🌿 Off Day'}</button></div>${html}`;
    return html;
  };
  render();
})();