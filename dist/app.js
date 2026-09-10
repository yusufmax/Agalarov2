/* Scroll-world adaptation: original-video blob seeking, coalesced seeks,
   persistent poster fallback, iOS priming and reduced-motion handling. */
const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const journey = $('.journey'), pin = $('.journey-pin'), media = $('#journey-media');
const poster = $('#journey-poster'), hero = $('#hero-copy'), scene = $('#scene-copy');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const stories = [
 ['01 / A NEW HORIZON','A world of your own.','A new perspective on life, on the shores of Charvak.'],
 ['02 / THE NEIGHBOURHOOD','Room to breathe.','Contemporary architecture. Open skies. A little more space for what matters.'],
 ['03 / AT HOME','Beautifully yours.','Quiet interiors and a natural connection to the outdoors.'],
 ['04 / THE ARRIVAL','An everyday escape.','A considered neighbourhood, shaped around a different pace of life.'],
 ['05 / THE WATERFRONT','Follow the blue.','From your front door to the extraordinary landscape of Charvak.'],
 ['06 / YOUR RETREAT','Find your place.','A private corner of a new world. A home that feels like a destination.']
];
let assets=[],states=[],active=-1,ticking=false,primed=false,desired=0,focused=true;
let easedProgress=null,lastFrameTime=0;
const desktop=matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function prime(v){if(!primed||v.dataset.primed)return;v.dataset.primed='true';const t=v.currentTime;v.play().then(()=>{v.pause();v.currentTime=t}).catch(()=>{delete v.dataset.primed});}
async function loadClip(i){
 if(reduce||!assets[i]||states[i]?.loading)return;
 const state=states[i]={loading:true,ready:false,video:null,url:null};
 try{
  const parts=await Promise.all(assets[i].parts.map(async u=>{const r=await fetch(u);if(!r.ok)throw Error('Video unavailable');return r.arrayBuffer()}));
  if(!focused)return;
  const v=document.createElement('video');state.video=v;v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');
  state.url=URL.createObjectURL(new Blob(parts,{type:'video/mp4'}));v.src=state.url;media.append(v);
  v.addEventListener('loadeddata',()=>{state.ready=true;prime(v);schedule()});
  v.addEventListener('seeked',()=>{if(i===active){v.style.opacity='1';schedule()}});
  v.addEventListener('error',()=>{state.ready=false;v.style.opacity='0'});
 }catch(e){state.loading=false;state.error=true;}
}
function update(now=performance.now()){
 ticking=false;
 const rect=journey.getBoundingClientRect(),distance=journey.offsetHeight-pin.offsetHeight;
 const rawProgress=clamp(-rect.top/Math.max(1,distance));desired=rawProgress;
 const dt=Math.min(50,lastFrameTime?now-lastFrameTime:16.67);lastFrameTime=now;
 if(easedProgress===null||reduce||!desktop||rect.bottom<=0||rect.top>innerHeight)easedProgress=rawProgress;
 else {
  // Exponential, time-based smoothing stays consistent on 60/120/144 Hz screens.
  const alpha=1-Math.exp(-dt/115);
  easedProgress+=(rawProgress-easedProgress)*alpha;
  if(Math.abs(rawProgress-easedProgress)<.000015)easedProgress=rawProgress;
 }
 const progress=clamp(easedProgress);
 const total=progress*6,index=Math.min(5,Math.floor(total)),local=clamp(total-index);
 $('#header').classList.toggle('solid',rect.bottom<=pin.offsetHeight*.25);
 if(assets.length){
  if(index!==active){
   active=index;poster.src=assets[index].poster;
   states.forEach((s,i)=>{if(s?.video&&i!==index)s.video.style.opacity='0'});
   chapters.forEach((b,i)=>{b.classList.toggle('active',i===index);if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
   $('#scene-eyebrow').textContent=stories[index][0];$('#scene-title').textContent=stories[index][1];$('#scene-description').textContent=stories[index][2];
  }
  if(rect.bottom>0&&rect.top<innerHeight){loadClip(index);if(local>.08)loadClip(index+1)}
  const s=states[index];
  if(s?.ready){const v=s.video;prime(v);const target=Math.min(v.duration-.055,Math.max(.001,local*v.duration));if(!v.seeking&&Math.abs(v.currentTime-target)>1/120)v.currentTime=target;if(!v.seeking)v.style.opacity='1';}
 }
 hero.style.opacity=clamp(1-progress*18);hero.style.pointerEvents=progress<.05?'auto':'none';
 scene.style.opacity=index===0?0:Math.min(clamp(local*10),clamp((1-local)*10));
 $('#journey-progress').style.width=progress*100+'%';
 if(desktop&&!reduce&&Math.abs(rawProgress-easedProgress)>.000015)schedule();
}
function schedule(){if(!ticking){ticking=true;requestAnimationFrame(update)}}
addEventListener('scroll',schedule,{passive:true});let lastWidth=innerWidth;
addEventListener('resize',()=>{if(innerWidth!==lastWidth){lastWidth=innerWidth;schedule()}});
for(const ev of ['pointerdown','touchstart','keydown'])addEventListener(ev,()=>{if(!primed){primed=true;states.forEach(s=>s?.video&&prime(s.video))}},{once:true,passive:true});
chapters.forEach(b=>b.addEventListener('click',()=>{const d=journey.offsetHeight-pin.offsetHeight;scrollTo({top:journey.offsetTop+d*(Number(b.dataset.chapter)+.12)/6,behavior:reduce?'instant':'smooth'})}));
fetch('assets/videos.json?v=smooth-2').then(r=>r.json()).then(data=>{assets=data;schedule()}).catch(()=>{schedule()});
const menu=$('.menu-toggle'), mobile=$('#mobile-menu');
function closeMenu(){mobile.hidden=true;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu');document.body.classList.remove('menu-open')}
menu.addEventListener('click',()=>{const open=mobile.hidden;mobile.hidden=!open;menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');document.body.classList.toggle('menu-open',open)});
mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
addEventListener('pagehide',e=>{if(!e.persisted){focused=false;states.forEach(s=>{if(s?.url)URL.revokeObjectURL(s.url)})}});
addEventListener('pageshow',()=>{focused=true;schedule()});
schedule();
const collections={
 villas:{label:'YOUR PRIVATE SANCTUARY',title:'White Villas',image:'villas',alt:'White Villas architectural visualisation with private gardens and terraces',description:'A collection of contemporary, single-storey homes with a private enclosed courtyard, terrace and lawn. Designed for easy indoor-outdoor living, with turnkey finishes and engineering systems included.',features:['Single-storey architecture','Private courtyard & terrace','Turnkey homes']},
 residences:{label:'A CONTEMPORARY PERSPECTIVE',title:'White Residences',image:'residences',alt:'Architectural visualisation of the terraced Sea Breeze residential neighbourhood',description:'Apartments within the growing Sea Breeze destination. White Residences was included in the first sales announcement, offering an apartment alternative to the villa collections. Speak with the team for current layouts and availability.',features:['Apartment living','Part of the resort masterplan','Layouts available from the sales team']},
 private:{label:'SPACE TO MAKE YOUR OWN',title:'Private Villas',image:'terrace',alt:'Conceptual terrace illustrating the private villa lifestyle',description:'Private villas announced in sizes from 290 to 1,200 m², giving you more room for the way you live. Discover the available homes and discuss layouts, specifications and delivery dates directly with the official team.',features:['Announced range: 290–1,200 m²','Private residential format','Current availability on enquiry']}
};
const tabs=[...document.querySelectorAll('[data-residence]')];
function selectCollection(tab){const d=collections[tab.dataset.residence];tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1});$('#residence-panel').setAttribute('aria-labelledby',tab.id);$('#residence-label').textContent=d.label;$('#residence-title').textContent=d.title;$('#residence-description').textContent=d.description;$('#residence-image').src='assets/'+d.image+'.webp';$('#residence-image').alt=d.alt;$('#residence-features').replaceChildren(...d.features.map(f=>{const li=document.createElement('li');li.textContent=f;return li}));const link=$('#residence-enquire');link.href='mailto:sales@seabreeze.az?subject='+encodeURIComponent(d.title+' Uzbekistan enquiry');link.replaceChildren(document.createTextNode('Enquire about '+d.title+' '));const arrow=document.createElement('span');arrow.textContent='↗';link.append(arrow)}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectCollection(tab));tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=tabs[(i+1)%tabs.length];if(e.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs.at(-1);if(next){e.preventDefault();next.focus();selectCollection(next)}})});
const plan=$('#plan-dialog');$('#open-plan').addEventListener('click',()=>plan.showModal());$('#close-plan').addEventListener('click',()=>plan.close());plan.addEventListener('click',e=>{if(e.target===plan){const r=plan.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)plan.close()}});
