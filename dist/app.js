/* Sea Breeze Uzbekistan — scroll-world journey engine + page interactions.
   Original-footage blob seeking, coalesced seeks, weighted chapter pacing with
   hero/finale linger, persistent poster fallback, iOS priming, reduced-motion
   handling and EN/RU/UZ re-rendering of every dynamic string. */
const $ = (s) => document.querySelector(s);
const I = window.SB_I18N, t = (k, v) => I.t(k, v);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pad = n => String(n).padStart(2, '0');
const EASE = 'cubic-bezier(.16,1,.3,1)';
const SVG = 'http://www.w3.org/2000/svg';
function icon(id){const s=document.createElementNS(SVG,'svg');s.setAttribute('class','icon');s.setAttribute('aria-hidden','true');const u=document.createElementNS(SVG,'use');u.setAttribute('href','#'+id);s.append(u);return s}
I.apply(I.detect());

/* ---------- Journey: eight original clips, one continuous scrub ---------- */
const journey=$('.journey'),pin=$('.journey-pin'),media=$('#journey-media'),poster=$('#journey-poster'),hero=$('#hero-copy'),scene=$('#scene-copy');
const COUNT=8;
// Scroll share per clip (scroll-world pacing): dwell on the opening flyover and the finale, keep transit scenes brisk.
const weights=[1.25,1,1,1.1,1.05,1,1,1.3];
const totalW=weights.reduce((a,b)=>a+b,0);
const starts=[];{let acc=0;for(const w of weights){starts.push(acc/totalW);acc+=w}}
// Time remap so the camera settles mid-scene while the copy peaks; seam frames untouched (f(0)=0, f(1)=1).
const linger=[.3,0,0,0,0,0,0,.3];
const lingerEase=(x,L)=>{const c=x-.5;return (1-L)*x+L*(4*c*c*c+.5)};
const story=i=>[t('story.'+i+'.e'),t('story.'+i+'.t'),t('story.'+i+'.b')];
const rail=$('.chapter-nav');
rail.replaceChildren(...Array.from({length:COUNT},(_,i)=>{const b=document.createElement('button');b.type='button';b.dataset.chapter=String(i);b.append(document.createElement('span'),document.createElement('i'));return b}));
const chapters=[...rail.children];
function labelRail(){chapters.forEach((b,i)=>{const s=story(i);b.firstChild.textContent=s[0];b.setAttribute('aria-label',t('journey.chapter',{n:i+1,title:s[0]}))})}
labelRail();$('#chapter-total').textContent=pad(COUNT);
journey.style.setProperty('--journey-height-desktop',Math.round(totalW*110+100)+'svh');
journey.style.setProperty('--journey-height-mobile',Math.round(totalW*90+100)+'svh');
let assets=[],states=[],active=-1,ticking=false,primed=false,focused=true,easedProgress=null,lastFrameTime=0;
if('scrollRestoration' in history)history.scrollRestoration='manual';
function prime(v){if(!primed||v.dataset.primed)return;v.dataset.primed='true';const tc=v.currentTime;v.play().then(()=>{v.pause();v.currentTime=tc}).catch(()=>{delete v.dataset.primed})}

/* ---------- Preloader: every chapter lands before the journey becomes scrubbable ---------- */
const loader=$('#preloader');
let loadedBytes=0,totalBytes=0,loadedClips=0,loaderTick=false,loaderDone=false;
const MB=b=>String(Math.round(b/1048576));
function loaderPaint(){loaderTick=false;if(loaderDone||!loader)return;const p=totalBytes?clamp(loadedBytes/totalBytes):0,pct=String(Math.floor(p*100));$('#loader-pct').textContent=pct;$('#loader-bar').style.transform='scaleX('+p.toFixed(4)+')';$('#loader-note').textContent=t('loader.note',{loaded:MB(Math.min(loadedBytes,totalBytes)),total:MB(totalBytes)});loader.setAttribute('aria-valuenow',pct)}
function loaderBytes(n){loadedBytes+=n;if(!loaderTick){loaderTick=true;requestAnimationFrame(loaderPaint)}}
function loaderLabels(){const list=$('#loader-chapters');if(!list)return;list.replaceChildren(...Array.from({length:COUNT},(_,i)=>{const s=document.createElement('span');s.textContent=story(i)[0];s.classList.toggle('on',!!states[i]&&!states[i].loading);return s}));loaderPaint()}
function loaderClip(i){loadedClips++;const c=$('#loader-count');if(c)c.textContent=pad(loadedClips);const s=$('#loader-chapters')?.children[i];if(s)s.classList.add('on')}
const skipTimer=setTimeout(()=>{if(loader&&!loaderDone)loader.classList.add('can-skip')},6000);
function loaderDismiss(){
 if(loaderDone)return;loaderDone=true;clearTimeout(skipTimer);
 document.documentElement.classList.remove('is-loading');
 if(loader){$('#loader-pct').textContent='100';$('#loader-bar').style.transform='scaleX(1)';loader.setAttribute('aria-valuenow','100');loader.classList.add('is-done');loader.addEventListener('transitionend',()=>loader.remove(),{once:true});setTimeout(()=>{if(loader.isConnected)loader.remove()},1600)}
 if(location.hash&&location.hash!=='#top'){const target=document.querySelector(location.hash);if(target)target.scrollIntoView({behavior:'instant',block:'start'})}
 easedProgress=null;schedule();
}
$('#loader-skip')?.addEventListener('click',loaderDismiss);
async function preload(){
 if(reduce||!assets.length||!loader){loaderDismiss();return}
 totalBytes=assets.reduce((a,e)=>a+(e.bytes||0),0);loaderLabels();
 for(let i=0;i<assets.length;i++)await loadClip(i);   // chapter order: the opening flyover is playable first
 loaderDismiss();
}
/* Streams one chunk, reporting bytes as they land so the preloader can count them. */
async function fetchPart(url,onBytes){
 const r=await fetch(url);if(!r.ok)throw Error('Video unavailable');
 if(!r.body||typeof r.body.getReader!=='function'){const b=await r.arrayBuffer();onBytes(b.byteLength);return [b]}
 const reader=r.body.getReader(),chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);onBytes(value.byteLength)}
 return chunks;
}
function loadClip(i){
 if(reduce||!assets[i])return Promise.resolve();
 if(states[i])return states[i].done;
 const state=states[i]={loading:true,ready:false,error:false,video:null,url:null,got:0};
 const bump=n=>{state.got+=n;loaderBytes(n)};
 state.done=(async()=>{
  try{
   const parts=await Promise.all(assets[i].parts.map(u=>fetchPart(u,bump)));
   if(!focused)return;
   const v=document.createElement('video');state.video=v;v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');
   state.url=URL.createObjectURL(new Blob(parts.flat(),{type:'video/mp4'}));v.src=state.url;media.append(v);
   v.addEventListener('seeked',()=>{if(i===active){v.style.opacity='1';schedule()}});
   v.addEventListener('error',()=>{state.ready=false;v.style.opacity='0'});
   await new Promise(res=>{v.addEventListener('loadeddata',()=>{state.ready=true;prime(v);res()},{once:true});v.addEventListener('error',()=>{state.error=true;res()},{once:true})});
  }catch(e){state.error=true}
  finally{state.loading=false;if((assets[i].bytes||0)>state.got)loaderBytes(assets[i].bytes-state.got);loaderClip(i);schedule()}
 })();
 return state.done;
}
function locate(p){let i=0;for(let k=0;k<COUNT;k++)if(p>=starts[k])i=k;return [i,clamp((p-starts[i])*totalW/weights[i])]}
function showScene(index,animate){
 const s=story(index),title=$('#scene-title');
 $('#scene-eyebrow').textContent=s[0];title.replaceChildren(Object.assign(document.createElement('span'),{textContent:s[1]}));$('#scene-description').textContent=s[2];
 if(animate&&!reduce){[[$('#scene-eyebrow'),{opacity:[0,1],transform:['translateY(14px)','none']}],[title.firstChild,{transform:['translateY(108%)','none']}],[$('#scene-description'),{opacity:[0,1],transform:['translateY(18px)','none']}]].forEach(([el,kf],i)=>el.animate(kf,{duration:820,delay:i*90,easing:EASE,fill:'both'}))}
}
function setCounter(index){const c=$('#chapter-current');if(c.textContent===pad(index+1))return;c.textContent=pad(index+1);if(!reduce)c.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:420,easing:EASE})}
function update(now=performance.now()){
 ticking=false;
 const rect=journey.getBoundingClientRect(),distance=journey.offsetHeight-pin.offsetHeight;
 const rawProgress=clamp(-rect.top/Math.max(1,distance));
 const dt=Math.min(50,lastFrameTime?now-lastFrameTime:16.67);lastFrameTime=now;
 if(easedProgress===null||reduce||!desktop||rect.bottom<=0||rect.top>innerHeight)easedProgress=rawProgress;
 else{
  // Exponential, time-based smoothing stays consistent on 60/120/144 Hz screens.
  const alpha=1-Math.exp(-dt/115);
  easedProgress+=(rawProgress-easedProgress)*alpha;
  if(Math.abs(rawProgress-easedProgress)<.000015)easedProgress=rawProgress;
 }
 const progress=clamp(easedProgress);
 const [index,local]=locate(progress);
 const inView=rect.bottom>0&&rect.top<innerHeight;
 $('#header').classList.toggle('solid',rect.bottom<=pin.offsetHeight*.25);
 if(index!==active){
  const first=active===-1;active=index;
  if(assets.length)poster.src=assets[index].poster;
  states.forEach((s,i)=>{if(s?.video&&i!==index)s.video.style.opacity='0'});
  chapters.forEach((b,i)=>{b.classList.toggle('active',i===index);if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  showScene(index,!first&&index>0);setCounter(index);
 }
 if(inView)chapters.forEach((b,i)=>b.style.setProperty('--fill',i<index?'1':i===index?local.toFixed(3):'0'));
 if(assets.length){
  if(inView){loadClip(index);if(local>.08)loadClip(index+1)}
  const s=states[index];
  if(s?.ready){const v=s.video;prime(v);const tl=linger[index]?lingerEase(local,linger[index]):local;const target=Math.min(v.duration-.055,Math.max(.001,tl*v.duration));if(!v.seeking&&Math.abs(v.currentTime-target)>1/120)v.currentTime=target;if(!v.seeking)v.style.opacity='1'}
 }
 hero.style.opacity=clamp(1-progress*18);hero.style.pointerEvents=progress<.05?'auto':'none';
 scene.style.opacity=index===0?0:Math.min(clamp(local*10),clamp((1-local)*10));
 $('#journey-progress').style.transform='scaleX('+progress+')';
 parallax();
 if(desktop&&!reduce&&Math.abs(rawProgress-easedProgress)>.000015)schedule();
}
function schedule(){if(!ticking){ticking=true;requestAnimationFrame(update)}}
addEventListener('scroll',schedule,{passive:true});let lastWidth=innerWidth;
addEventListener('resize',()=>{if(innerWidth!==lastWidth){lastWidth=innerWidth;schedule()}});
for(const ev of ['pointerdown','touchstart','keydown'])addEventListener(ev,()=>{if(!primed){primed=true;states.forEach(s=>s?.video&&prime(s.video))}},{once:true,passive:true});
chapters.forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.chapter),d=journey.offsetHeight-pin.offsetHeight;scrollTo({top:journey.offsetTop+d*(starts[i]+.12*weights[i]/totalW),behavior:reduce?'instant':'smooth'})}));
fetch('assets/videos.json?v=journey-8').then(r=>r.json()).then(data=>{assets=data;active=-1;preload()}).catch(()=>{loaderDismiss()});

/* ---------- Scroll-linked parallax on the two full-bleed photographs ---------- */
const px=[...document.querySelectorAll('[data-parallax]')];
function parallax(){if(reduce||!px.length)return;for(const el of px){const r=el.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)continue;const p=(r.top+r.height/2-innerHeight/2)/innerHeight;el.style.transform='translate3d(0,'+(p*-5).toFixed(2)+'%,0) scale(1.12)'}}

/* ---------- Navigation ---------- */
const menu=$('.menu-toggle'),mobile=$('#mobile-menu');
function syncMenuLabel(){menu.setAttribute('aria-label',t(mobile.hidden?'nav.menuOpen':'nav.menuClose'))}
function closeMenu(){mobile.hidden=true;menu.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open');syncMenuLabel()}
menu.addEventListener('click',()=>{const open=mobile.hidden;mobile.hidden=!open;menu.setAttribute('aria-expanded',String(open));document.body.classList.toggle('menu-open',open);syncMenuLabel()});
mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
syncMenuLabel();
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>I.apply(b.dataset.lang)));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
addEventListener('pagehide',e=>{if(!e.persisted){focused=false;states.forEach(s=>{if(s?.url)URL.revokeObjectURL(s.url)})}});
addEventListener('pageshow',()=>{focused=true;schedule()});
schedule();

/* ---------- Stat counters (once, in view) ---------- */
const countObs=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;countObs.unobserve(e.target);const el=e.target,end=Number(el.dataset.count);if(reduce){el.textContent=end;return}const t0=performance.now(),dur=1400;const step=n=>{const p=clamp((n-t0)/dur);el.textContent=p>=1?end:Math.round(end*(1-Math.pow(2,-10*p)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)}),{threshold:.5});
document.querySelectorAll('[data-count]').forEach(c=>countObs.observe(c));

/* ---------- Residence collections ---------- */
const COLLECTIONS={villas:{title:'White Villas',image:'villas'},residences:{title:'White Residences',image:'residences'},private:{title:'Private Villas',image:'terrace'}};
const tabs=[...document.querySelectorAll('[data-residence]')];
let currentTab=tabs[0];
function selectCollection(tab,animate=true){
 const key=tab.dataset.residence,d=COLLECTIONS[key];currentTab=tab;
 tabs.forEach(x=>{x.setAttribute('aria-selected',String(x===tab));x.tabIndex=x===tab?0:-1});
 $('#residence-panel').setAttribute('aria-labelledby',tab.id);$('#residence-label').textContent=t('col.'+key+'.label');$('#residence-title').textContent=d.title;$('#residence-description').textContent=t('col.'+key+'.desc');
 const img=$('#residence-image');img.src='assets/'+d.image+'.webp';img.alt=t('col.'+key+'.alt');
 $('#residence-features').replaceChildren(...[1,2,3].map(n=>{const li=document.createElement('li');li.textContent=t('col.'+key+'.f'+n);return li}));
 const link=$('#residence-enquire');link.href='#enquiry-form';link.replaceChildren(Object.assign(document.createElement('span'),{textContent:t('nav.enquire')}),icon('i-arrow'));
 if(animate&&!reduce){img.animate([{opacity:.4,transform:'scale(1.03)'},{opacity:1,transform:'none'}],{duration:620,easing:EASE});[...$('.residence-detail').children].forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:520,delay:i*45,easing:EASE}))}
}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>{if(tab!==currentTab)selectCollection(tab)});tab.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=tabs[(i+1)%tabs.length];if(e.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs.at(-1);if(next){e.preventDefault();next.focus();selectCollection(next)}})});
$('#residence-enquire').addEventListener('click',()=>{$('#lead-collection').value=$('#residence-title').textContent;$('#lead-name').focus({preventScroll:true})});

/* ---------- Masterplan dialog ---------- */
const plan=$('#plan-dialog');$('#open-plan').addEventListener('click',()=>plan.showModal());$('#close-plan').addEventListener('click',()=>plan.close());plan.addEventListener('click',e=>{if(e.target===plan){const r=plan.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)plan.close()}});

/* ---------- Illustrative space planner: preferences only, never advertised inventory ---------- */
let preferredBedrooms=1;
function drawPlan(count){
 const L=k=>t('plan.lbl.'+k);
 const topWidth=540/count;let shapes='<rect class="plan-outdoor" x="60" y="328" width="540" height="82"/><rect class="plan-room" x="60" y="40" width="540" height="288"/>';
 for(let i=0;i<count;i++){
  const x=60+i*topWidth,cx=x+topWidth/2;
  shapes+=`<path class="plan-wall" d="M${x} 40 V183 M${x} 40 H${x+topWidth}"/><rect class="plan-furniture" x="${cx-33}" y="60" width="66" height="73" rx="1"/><path d="M${cx-31} 81 H${cx+31}" stroke="currentColor" stroke-width="1"/><rect class="plan-furniture" x="${cx-27}" y="64" width="23" height="13"/><rect class="plan-furniture" x="${cx+4}" y="64" width="23" height="13"/><text class="plan-label" x="${cx}" y="164">${L('bedroom')}${count>1?' '+(i+1):''}</text><path class="plan-wall" d="M${x} 190 H${x+topWidth-40}"/><path class="plan-door" d="M${x+topWidth-40} 190 V151 Q${x+topWidth} 151 ${x+topWidth} 190"/>`;
 }
 shapes+=`<path class="plan-wall" d="M600 40 V328 H408 M365 328 H60 V40 M445 190 V285 M445 190 H600 M445 285 H600"/><rect class="plan-furniture" x="86" y="231" width="132" height="40"/><rect class="plan-furniture" x="104" y="276" width="87" height="22"/><rect class="plan-furniture" x="289" y="236" width="88" height="47"/><rect class="plan-furniture" x="307" y="224" width="19" height="10"/><rect class="plan-furniture" x="344" y="224" width="19" height="10"/><rect class="plan-furniture" x="307" y="285" width="19" height="10"/><rect class="plan-furniture" x="344" y="285" width="19" height="10"/><rect class="plan-furniture" x="458" y="202" width="130" height="18"/><rect class="plan-furniture" x="565" y="202" width="23" height="62"/><text class="plan-label" x="158" y="316">${L('living')}</text><text class="plan-label" x="333" y="316">${L('dining')}</text><text class="plan-label" x="510" y="250">${L('kitchen')}</text><text class="plan-small" x="523" y="309">${L('bath')}</text><path class="plan-door" d="M365 328 V286 Q408 286 408 328"/><text class="plan-label" x="330" y="374">${L('terrace')}</text><path d="M60 425 H600" stroke="currentColor" stroke-width=".6"/><path d="M60 420 V430 M600 420 V430" stroke="currentColor" stroke-width="1"/>`;
 $('#floor-plan-content').innerHTML=shapes;$('#floor-plan-title').textContent=t('plan.svgTitle',{n:count,beds:I.count('beds',count)});
}
function setPlan(count,animate=true){preferredBedrooms=count;$('#plan-name').textContent=t('plan.'+count+'.name');$('#plan-copy').textContent=t('plan.'+count+'.copy');$('#plan-bed-count').textContent=I.count('privateBeds',count);$('#drawing-bedrooms').textContent=I.count('beds',count);document.querySelectorAll('[data-plan]').forEach(b=>{const on=Number(b.dataset.plan)===count;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});drawPlan(count);if(animate&&!reduce)$('#floor-plan').animate([{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:250,easing:'ease-out'})}
document.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>setPlan(Number(b.dataset.plan))));setPlan(1,false);
$('#request-plan').addEventListener('click',()=>{$('#lead-request').selectedIndex=0;$('#lead-message').value=t('plan.requestMsg',{beds:I.count('beds',preferredBedrooms)});$('#enquiry-form').scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'});$('#lead-name').focus({preventScroll:true})});

/* ---------- Enquiry: no automatic transmission — the visitor reviews and sends the email ---------- */
let enquiryText='';
const form=$('#enquiry-form');
function fieldError(id,message){const input=$('#lead-'+id);input.setAttribute('aria-invalid',String(!!message));$('#'+id+'-error').textContent=message;return !message}
form.addEventListener('submit',e=>{
 e.preventDefault();const name=$('#lead-name').value.trim(),email=$('#lead-email').value.trim(),phone=$('#lead-phone').value.trim(),digits=phone.replace(/\D/g,'').length;
 const valid=[fieldError('name',name.length<2?t('form.errName'):''),fieldError('email',!email||!$('#lead-email').validity.valid?t('form.errEmail'):''),fieldError('phone',phone&&(digits<7||digits>15)?t('form.errPhone'):'')].every(Boolean);
 if(!valid){form.querySelector('[aria-invalid=true]').focus();$('#enquiry-result').hidden=true;return}
 const request=$('#lead-request').value;
 enquiryText=t('form.body',{collection:$('#lead-collection').value,request,message:$('#lead-message').value.trim()||t('form.defaultMsg'),name,email,phone:phone?t('form.phoneLine',{phone}):''});
 $('#enquiry-summary').textContent=enquiryText;$('#send-enquiry').href='mailto:sales@seabreeze.az?subject='+encodeURIComponent(t('form.subject',{request}))+'&body='+encodeURIComponent(enquiryText);$('#enquiry-result').hidden=false;$('#enquiry-result').scrollIntoView({behavior:reduce?'instant':'smooth',block:'nearest'});
});
$('#copy-enquiry').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(enquiryText);$('#copy-feedback').textContent=t('form.copied')}catch{$('#copy-feedback').textContent=t('form.copyFail')}});
form.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{const id=input.id.replace('lead-','');if($('#'+id+'-error'))fieldError(id,'')}));

/* ---------- Smooth disclosure panels (FAQ + nature principles) ---------- */
document.querySelectorAll('.faq-list details,.nature-principles details').forEach(d=>{const s=d.querySelector('summary'),c=d.querySelector('p');if(!s||!c)return;s.addEventListener('click',e=>{if(reduce||d.dataset.busy)return;e.preventDefault();d.dataset.busy='1';const pb=getComputedStyle(c).paddingBottom;
 if(d.open){c.style.overflow='hidden';const a=c.animate([{height:c.offsetHeight+'px',opacity:1,paddingBottom:pb},{height:'0px',opacity:0,paddingBottom:'0px'}],{duration:260,easing:'ease-out'});a.onfinish=()=>{d.open=false;c.style.overflow='';delete d.dataset.busy}}
 else{d.open=true;const h=c.offsetHeight;c.style.overflow='hidden';const a=c.animate([{height:'0px',opacity:0,paddingBottom:'0px'},{height:h+'px',opacity:1,paddingBottom:pb}],{duration:360,easing:EASE});a.onfinish=()=>{c.style.overflow='';delete d.dataset.busy}}})});

/* ---------- Entry motion runs once; the timeline draws its rule when reached ---------- */
if(!reduce){document.documentElement.classList.add('motion-ready');document.querySelectorAll('.intro h2,.stats>div,.section-heading,.residence-panel,.life-list article,.life-images figure,.planner-heading,.planner-workspace,.buyer-guide>div,.masterplan-visual,.plan-facts>div,.nature-copy,.heritage-grid,.timeline>div,.news-card,.faq-heading,.enquiry-form').forEach((el,i)=>{el.classList.add('reveal');el.style.setProperty('--reveal-delay',(i%3)*55+'ms');observer.observe(el)});const tl=$('.timeline');if(tl)observer.observe(tl)}
const navSections=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){document.querySelectorAll('.desktop-nav a').forEach(a=>a.classList.toggle('current',a.getAttribute('href')==='#'+e.target.id))}}},{rootMargin:'-18% 0px -65% 0px',threshold:0});['overview','residences','destination','journal'].forEach(id=>navSections.observe(document.getElementById(id)));

/* ---------- Language change: re-render every string the engine owns ---------- */
document.addEventListener('sb:lang',()=>{labelRail();loaderLabels();if(active>=0)showScene(active,false);selectCollection(currentTab,false);setPlan(preferredBedrooms,false);syncMenuLabel()});
