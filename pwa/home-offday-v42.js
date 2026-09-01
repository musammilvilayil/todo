// StudyForge 4.2 compatibility shim.
// v4.3 owns the Home Off Day control and missed-task recovery logic.
(function(){
  if(document.querySelector('script[data-sf43]'))return;
  const s=document.createElement('script');
  s.src='./recovery-v43.js';
  s.dataset.sf43='1';
  s.onerror=()=>{if(typeof toast==='function')toast('Recovery planner could not load')};
  document.body.appendChild(s);
})();