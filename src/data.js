export const FULL = [
  { id: 'mern1', time: '08:00', title: 'MERN Fundamentals', note: 'JavaScript, React, Node, Express & MongoDB', emoji: '💻' },
  { id: 'code', time: '10:15', title: 'Coding Practice', note: 'Small exercises without AI first', emoji: '⌨️' },
  { id: 'project1', time: '13:00', title: 'Build a Project Feature', note: 'Ship one real MERN feature', emoji: '🛠️' },
  { id: 'marketing1', time: '15:30', title: 'Digital Marketing Learning', note: 'Learn today’s marketing topic', emoji: '📈' },
  { id: 'marketing2', time: '17:00', title: 'Marketing Practical', note: 'Apply it to a real or sample business', emoji: '🎯' },
  { id: 'project2', time: '19:30', title: 'MERN Project & Debugging', note: 'Project work, debugging and GitHub', emoji: '🚀' },
  { id: 'review', time: '21:00', title: 'Revision & Notes', note: 'Review today and plan tomorrow', emoji: '📚' },
];

export const LIGHT = [
  { id: 'light1', time: '09:00', title: 'Light Revision', note: 'Only weak or important concepts', emoji: '🌤️' },
  { id: 'light2', time: '20:30', title: 'Notes & Tomorrow Plan', note: 'Keep today intentionally light', emoji: '📝' },
];

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
export const FALLBACK_PRAYERS = { Fajr:'05:05', Dhuhr:'12:25', Asr:'15:45', Maghrib:'18:35', Isha:'19:45' };

export const MATERIALS = [
  { id:'js', kind:'mern', title:'JavaScript Core', week:'Week 1', note:'Functions, arrays, objects, promises and async/await.' },
  { id:'react', kind:'mern', title:'React Fundamentals', week:'Week 1', note:'Components, props, state, hooks and forms.' },
  { id:'node', kind:'mern', title:'Node + Express', week:'Week 2', note:'REST APIs, middleware, validation and error handling.' },
  { id:'mongo', kind:'mern', title:'MongoDB', week:'Week 2', note:'CRUD, schemas, indexes and aggregation.' },
  { id:'auth', kind:'mern', title:'Authentication', week:'Week 3', note:'JWT, hashing, roles and protected routes.' },
  { id:'deploy', kind:'mern', title:'Deployment', week:'Week 4', note:'Production builds, environment variables and debugging.' },
  { id:'fund', kind:'marketing', title:'Marketing Fundamentals', week:'Week 1', note:'Audience, funnel, offer, CTA and metrics.' },
  { id:'social', kind:'marketing', title:'Social Media', week:'Week 1', note:'Content pillars, hooks, captions and engagement.' },
  { id:'seo', kind:'marketing', title:'SEO', week:'Week 2', note:'Search intent, keyword research and on-page SEO.' },
  { id:'meta', kind:'marketing', title:'Meta Ads', week:'Week 3', note:'Objectives, audiences, creatives and retargeting.' },
  { id:'gads', kind:'marketing', title:'Google Ads', week:'Week 3', note:'Search campaigns, keywords, ads and conversions.' },
  { id:'analytics', kind:'marketing', title:'Analytics + Copywriting', week:'Week 4', note:'CTR, CPC, CPA, ROAS, hooks and CTAs.' },
];

export const INITIAL_STATE = {
  dayModes:{}, checks:{}, prayerChecks:{}, prayerTimes:{}, materialDone:{}, targets:{}, focusMinutes:0, notificationsOn:false,
  tasks:[
    { id:'t1', title:'Build a React mini project', type:'Assignment', category:'MERN', done:false },
    { id:'t2', title:'JavaScript fundamentals check', type:'Assessment', category:'MERN', done:false },
    { id:'t3', title:'Create a 7-day content calendar', type:'Assignment', category:'Marketing', done:false },
    { id:'t4', title:'Weekly review', type:'Task', category:'Review', done:false },
  ],
};

export const keyFor = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const mins = time => { const [h,m]=time.split(':').map(Number); return h*60+m; };
export const pretty = time => { const [h,m]=time.split(':').map(Number); const d=new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); };
