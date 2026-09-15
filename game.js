/* ============================================================
   Desafío en Movimiento — game.js
   Juego de 3 niveles para stand de congreso (Laboratorios Lasca)
   Capa de nube: window.SRV (Firestore). Local: IndexedDB + fallback localStorage.
   ============================================================ */
(function(){
"use strict";

/* ---------- Utilidades ---------- */
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>Math.random()*(b-a)+a;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const todayKey=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s==null?"":s).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const abbrevName=n=>{const p=String(n||"").trim().split(/\s+/);return p.length<2?p[0]||"—":p[0]+" "+p[1][0].toUpperCase()+".";};

/* ---------- Config por defecto ---------- */
const DEFAULT_CONFIG={
  version:"1.0", qbankVersion:"3",
  event:{name:"Congreso Médico", startDate:"", endDate:""},
  attractTitle:"Desafío en Movimiento",
  tagline:"Poné a prueba tus reflejos y tu conocimiento",
  prize:"Los primeros puestos acceden al premio",
  legal:"Dirigido a profesionales de la salud",
  consent:"Autorizo a Laboratorios Lasca a contactarme con fines informativos.",
  registro:true, sound:true, demo:false,
  pin:"2468",
  fields:{nombre:true, especialidad:true, ciudad:false, contacto:true, consentimiento:false},
  scoring:{
    l1_time:15, l1_target_ms:1200, l1_hit:100, l1_bonus_ms:500, l1_bonus:50, l1_miss:25, l1_targets:8,
    l2_count:3, l2_time:10, l2_correct:300, l2_speed:100,
    l3_time:20, l3_ok:100, l3_bad:50, l3_streak:100
  },
  questions:[
    // ---- GLUCONEX (tirzepatida) — estudio SURMOUNT-OA (osteoartritis de rodilla) ----
    {id:"q001",active:true,question:"El estudio SURMOUNT-OA evaluó a Gluconex (tirzepatida) en pacientes con:",
     options:["Osteoartritis de rodilla y obesidad","Solo diabetes tipo 1","Fractura de cadera","Hipertensión aislada"],correctIndex:0,
     explanation:"SURMOUNT-OA evaluó tirzepatida en osteoartritis de rodilla asociada a obesidad.",brand:"Gluconex"},
    {id:"q002",active:true,question:"En SURMOUNT-OA, Gluconex (tirzepatida) mostró, respecto al dolor de rodilla:",
     options:["Sin cambios","Reducción del dolor vs placebo","Aumento del dolor","Solo efecto estético"],correctIndex:1,
     explanation:"En SURMOUNT-OA la tirzepatida se asoció a reducción del dolor de rodilla frente a placebo.",brand:"Gluconex"},
    {id:"q003",active:true,question:"Gluconex (tirzepatida) actúa como agonista de los receptores de:",
     options:["Solo GLP-1","GIP y GLP-1 (doble incretina)","Solo GIP","SGLT2"],correctIndex:1,
     explanation:"La tirzepatida es un agonista dual de los receptores GIP y GLP-1.",brand:"Gluconex"},
    {id:"q004",active:true,question:"Además del control glucémico, Gluconex (tirzepatida) se asocia con:",
     options:["Aumento de peso","Reducción del peso corporal","Sin efecto sobre el peso","Retención de líquidos"],correctIndex:1,
     explanation:"La tirzepatida se asocia a reducción significativa del peso corporal, relevante en la osteoartritis por sobrecarga.",brand:"Gluconex"},
    // ---- OXUS (etoricoxib) ----
    {id:"q005",active:true,question:"Oxus (etoricoxib) pertenece al grupo de los:",
     options:["Opioides","Inhibidores selectivos de la COX-2","Corticoides","Relajantes musculares"],correctIndex:1,
     explanation:"El etoricoxib es un AINE inhibidor selectivo de la COX-2.",brand:"Oxus"},
    {id:"q006",active:true,question:"Una ventaja atribuida a la selectividad COX-2 de Oxus (etoricoxib) es:",
     options:["Mayor sangrado","Menor lesividad gástrica relativa vs AINEs no selectivos","Efecto sedante","Acción antibiótica"],correctIndex:1,
     explanation:"La selectividad COX-2 se asocia a menor lesividad gastrointestinal relativa.",brand:"Oxus"},
    {id:"q007",active:true,question:"Oxus (etoricoxib) se utiliza habitualmente para el manejo de:",
     options:["Infecciones","Dolor e inflamación (p. ej. artrosis, artritis)","Hipertensión","Diabetes"],correctIndex:1,
     explanation:"El etoricoxib se emplea en dolor e inflamación como artrosis y artritis.",brand:"Oxus"},
    {id:"q008",active:true,question:"Oxus (etoricoxib) está disponible en presentaciones de:",
     options:["60-90-120 mg","5-10 mg","500 mg","1-2 g"],correctIndex:0,
     explanation:"El etoricoxib se presenta en dosis de 60, 90 y 120 mg según indicación.",brand:"Oxus"}
  ],
  level3:{
    correct:["Control glucémico","Manejo del dolor","Movilidad","Adherencia","Bienestar","Calidad de vida","Constancia","Prevención"],
    distractors:["Sedentarismo","Automedicación","Dolor sin control","Abandono del tratamiento"]
  },
  levelBrands:{l1:"Oxus", l2:"", l3:"Gluconex"},
  brandReviews:{
    Gluconex:"Gluconex · tirzepatida",
    Oxus:"Oxus · etoricoxib"
  },
  brandLogos:{},        // { marca: dataURI } — se cargan abajo en init
  prodLogos:[],         // [dataURI] logos de producto pantalla final
  instLogo:"",          // logo institucional (dataURI)
  whatsapp:{enabled:true, countryCode:"595", label:"Recibir mi resultado por WhatsApp"}
};

/* ---------- Estado en memoria ---------- */
let CONFIG=structuredClone(DEFAULT_CONFIG);
let me=null;               // jugador actual
let game=null;             // estado de la partida
let idleTimer=null;
let srvLiveRows=null;      // filas en vivo del servidor
let unsubLive=null;
const TV = new URLSearchParams(location.search).get("tv")==="1";
const TV_SCOPE = new URLSearchParams(location.search).get("scope")==="all"?"all":"day";

/* ---------- Sonido (WebAudio, sin archivos) ---------- */
let actx=null;
function beep(freq=600,dur=0.08,type="sine",vol=0.08){
  if(!CONFIG.sound) return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    const o=actx.createOscillator(),g=actx.createGain();
    o.type=type;o.frequency.value=freq;g.gain.value=vol;
    o.connect(g);g.connect(actx.destination);o.start();
    g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+dur);
    o.stop(actx.currentTime+dur);
  }catch(e){}
}
const sGood=()=>beep(880,0.1,"triangle");
const sBad =()=>beep(200,0.15,"sawtooth",0.06);
const sTick=()=>beep(500,0.05,"square",0.04);

/* ============================================================
   CAPA DE DATOS LOCAL — IndexedDB con fallback localStorage
   ============================================================ */
const DB={
  _db:null, _ok:false,
  async init(){
    return new Promise(res=>{
      try{
        const rq=indexedDB.open("desafio_db",1);
        rq.onupgradeneeded=e=>{
          const d=e.target.result;
          if(!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
          if(!d.objectStoreNames.contains("results")) d.createObjectStore("results",{keyPath:"id"});
        };
        rq.onsuccess=e=>{this._db=e.target.result;this._ok=true;res();};
        rq.onerror=()=>{this._ok=false;res();};
      }catch(e){this._ok=false;res();}
    });
  },
  _tx(store,mode){return this._db.transaction(store,mode).objectStore(store);},
  async kvGet(k){
    if(!this._ok){try{return JSON.parse(localStorage.getItem("d_"+k));}catch(e){return null;}}
    return new Promise(r=>{const q=this._tx("kv","readonly").get(k);q.onsuccess=()=>r(q.result??null);q.onerror=()=>r(null);});
  },
  async kvSet(k,v){
    if(!this._ok){try{localStorage.setItem("d_"+k,JSON.stringify(v));}catch(e){}return;}
    return new Promise(r=>{const q=this._tx("kv","readwrite").put(v,k);q.onsuccess=()=>r();q.onerror=()=>r();});
  },
  async resAdd(o){
    if(!this._ok){const a=JSON.parse(localStorage.getItem("d_results")||"[]");a.push(o);localStorage.setItem("d_results",JSON.stringify(a));return;}
    return new Promise(r=>{const q=this._tx("results","readwrite").put(o);q.onsuccess=()=>r();q.onerror=()=>r();});
  },
  async resAll(){
    if(!this._ok){return JSON.parse(localStorage.getItem("d_results")||"[]");}
    return new Promise(r=>{const q=this._tx("results","readonly").getAll();q.onsuccess=()=>r(q.result||[]);q.onerror=()=>r([]);});
  },
  async resClear(){
    if(!this._ok){localStorage.removeItem("d_results");return;}
    return new Promise(r=>{const q=this._tx("results","readwrite").clear();q.onsuccess=()=>r();q.onerror=()=>r();});
  }
};

/* ---------- Capa servidor (SRV) helpers ---------- */
const srvAvailable=()=>window.SRV&&window.SRV.available();
async function srvAddResult(r){ if(srvAvailable()) return window.SRV.addResult(r); return false; }
async function srvGetResults(){ if(srvAvailable()) return window.SRV.getResults(); return null; }
function srvSubscribe(cb){ if(srvAvailable()) return window.SRV.subscribe(cb); return ()=>{}; }
async function srvClear(){ if(srvAvailable()) return window.SRV.clear(); return false; }

/* ============================================================
   PANTALLAS
   ============================================================ */
function show(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const s=document.getElementById(id); if(s)s.classList.add("active");
  if(["l1","l2","l3","result","rank","register","instr"].includes(id)) armIdle(); else clearIdle();
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800);}

/* ---------- Inactividad ---------- */
function armIdle(){clearIdle();idleTimer=setTimeout(()=>{ if(!TV){abortGame();show("attract");} },30000);}
function resetIdle(){ if(idleTimer){armIdle();} }
function clearIdle(){ if(idleTimer){clearTimeout(idleTimer);idleTimer=null;} }
["click","touchstart","keydown"].forEach(ev=>document.addEventListener(ev,resetIdle,{passive:true}));

/* ---------- Timebar / countdown ---------- */
function countdown(n,cb){
  const host=el("div","countdown");host.style.position="fixed";host.style.top="50%";host.style.left="50%";
  host.style.transform="translate(-50%,-50%)";host.style.zIndex="80";document.body.appendChild(host);
  let k=n;host.textContent=k;sTick();
  const t=setInterval(()=>{k--;if(k<=0){clearInterval(t);host.remove();cb();}else{host.textContent=k;host.style.animation="none";void host.offsetWidth;host.style.animation="cd 1s ease";sTick();}},800);
}
let rafId=null;
function runTimer(ms,onEnd,onTick){
  const bar=$("#timebar");bar.style.display="block";bar.style.width="100%";
  const start=performance.now();
  cancelAnimationFrame(rafId);
  (function loop(now){
    const p=clamp(1-(now-start)/ms,0,1);
    bar.style.width=(p*100)+"%";
    if(onTick)onTick(p);
    if(p<=0){bar.style.display="none";onEnd&&onEnd();}
    else rafId=requestAnimationFrame(loop);
  })(start);
}
function stopTimer(){cancelAnimationFrame(rafId);$("#timebar").style.display="none";}

/* ---------- Franja de marca ---------- */
function setBrandBar(brand){
  // Franja de marca lateral desactivada por pedido: no se muestra nada al costado.
  const host=$("#brandbarHost");host.innerHTML="";
}
function clearBrandBar(){$("#brandbarHost").innerHTML="";}

function flash(x,y,txt,cls){
  const f=el("div","flash "+cls,txt);f.style.left=x+"px";f.style.top=y+"px";
  document.body.appendChild(f);setTimeout(()=>f.remove(),800);
}

/* ============================================================
   PUNTAJE / CATEGORÍAS
   ============================================================ */
function maxScore(){
  const s=CONFIG.scoring;
  const l1max=(s.l1_hit+s.l1_bonus)*s.l1_targets;
  const l2max=(s.l2_correct+s.l2_speed)*s.l2_count;
  // Nivel 3: estimación de aciertos posibles en el tiempo + rachas
  const l3hits=Math.round(s.l3_time/1.2);
  const l3max=s.l3_ok*l3hits + s.l3_streak*Math.floor(l3hits/4);
  return Math.max(1,l1max+l2max+l3max);
}
function categoryFor(total){
  const pct=Math.round(total/maxScore()*100);
  if(pct>=90)return{cat:"Maestro del Movimiento",pct};
  if(pct>=70)return{cat:"Experto en Movimiento",pct};
  if(pct>=50)return{cat:"Impulsor del Movimiento",pct};
  return{cat:"El desafío continúa",pct};
}

/* ============================================================
   FLUJO DE PARTIDA
   ============================================================ */
function newGame(){
  game={l1:0,l2:0,l3:0,answers:[],hits:0,attempts:0,startTs:performance.now(),
        l2set:[], l2idx:0, brandsSeen:new Set()};
}
function abortGame(){stopTimer();clearBrandBar();game=null;}

function startFlow(){
  if(CONFIG.registro){ buildRegister(); show("register"); }
  else { me={nombre:"Invitado",especialidad:"",ciudad:"",contacto:"",consent:false}; goInstr(); }
}
function goInstr(){
  newGame(); show("instr");
  let k=10; const cd=$("#instrCd"); cd.textContent=k;
  const t=setInterval(()=>{k--; cd.textContent=k; if(k<=0){clearInterval(t); if($("#instr").classList.contains("active"))startL1();}},1000);
  $("#btnSkipInstr").onclick=()=>{clearInterval(t);startL1();};
}

/* ---------------- NIVEL 1 : silueta + zonas ---------------- */
const ZONES=[
  {id:"hombroI",cx:118,cy:150,r:20},{id:"hombroD",cx:202,cy:150,r:20},
  {id:"codoI",cx:96,cy:230,r:17},{id:"codoD",cx:224,cy:230,r:17},
  {id:"munecaI",cx:82,cy:310,r:15},{id:"munecaD",cx:238,cy:310,r:15},
  {id:"columna",cx:160,cy:210,r:20},
  {id:"caderaI",cx:135,cy:330,r:18},{id:"caderaD",cx:185,cy:330,r:18},
  {id:"rodillaI",cx:138,cy:440,r:18},{id:"rodillaD",cx:182,cy:440,r:18},
  {id:"tobilloI",cx:140,cy:540,r:15},{id:"tobilloD",cx:180,cy:540,r:15}
];
function siluetaSVG(){
  const body=`
    <ellipse cx="160" cy="70" rx="34" ry="40" fill="rgba(255,255,255,.06)"/>
    <path d="M120,120 Q160,100 200,120 L214,300 Q160,320 106,300 Z" fill="rgba(255,255,255,.06)"/>
    <path d="M118,150 L92,320 L104,322 L128,160 Z" fill="rgba(255,255,255,.05)"/>
    <path d="M202,150 L228,320 L216,322 L192,160 Z" fill="rgba(255,255,255,.05)"/>
    <path d="M132,318 L128,560 L150,560 L158,320 Z" fill="rgba(255,255,255,.06)"/>
    <path d="M188,318 L192,560 L170,560 L162,320 Z" fill="rgba(255,255,255,.06)"/>`;
  const zones=ZONES.map(z=>`<circle class="zone" data-id="${z.id}" cx="${z.cx}" cy="${z.cy}" r="${z.r}"/>`).join("");
  return `<svg viewBox="0 0 320 590" style="width:100%;height:auto;max-height:64vh">${body}${zones}</svg>`;
}
function startL1(){
  show("l1"); setBrandBar(CONFIG.levelBrands.l1);
  const s=CONFIG.scoring; game.l1=0; $("#l1score").textContent="0";
  const stage=$("#l1stage"); stage.innerHTML=siluetaSVG();
  const zoneEls=$$("#l1 .zone");
  let current=null, hotSince=0, targets=0, alive=true;

  function litUp(){
    if(!alive)return;
    zoneEls.forEach(z=>z.classList.remove("hot"));
    current=zoneEls[(Math.random()*zoneEls.length)|0];
    current.classList.add("hot"); hotSince=performance.now(); targets++;
    const to=setTimeout(()=>{ if(alive&&current&&current.classList.contains("hot")){ current.classList.remove("hot"); nextSoon(); } }, s.l1_target_ms);
    current._to=to;
  }
  function nextSoon(){ if(alive) setTimeout(litUp, rnd(200,500)); }
  zoneEls.forEach(z=>z.addEventListener("click",e=>{
    if(!alive)return;
    if(z.classList.contains("hot")){
      clearTimeout(z._to);
      const dt=performance.now()-hotSince;
      let pts=s.l1_hit; if(dt<s.l1_bonus_ms)pts+=s.l1_bonus;
      game.l1+=pts; game.hits++; game.attempts++;
      z.classList.remove("hot"); sGood();
      flash(e.clientX,e.clientY,"+"+pts,"plus");
      $("#l1score").textContent=game.l1;
      nextSoon();
    }else{
      game.l1=Math.max(0,game.l1-s.l1_miss); game.attempts++;
      sBad(); flash(e.clientX,e.clientY,"-"+s.l1_miss,"minus");
      $("#l1score").textContent=game.l1;
    }
  }));
  countdown(3,()=>{
    litUp();
    runTimer(s.l1_time*1000, ()=>{ alive=false; setTimeout(startL2,600); });
  });
}

/* ---------------- NIVEL 2 : preguntas ---------------- */
function startL2(){
  show("l2");
  const s=CONFIG.scoring;
  const active=CONFIG.questions.filter(q=>q.active);
  game.l2set=shuffle(active).slice(0,s.l2_count);
  game.l2idx=0; game.l2=0; $("#l2score").textContent="0";
  countdown(3,()=>askQ());
}
function askQ(){
  const s=CONFIG.scoring;
  if(game.l2idx>=game.l2set.length){ stopTimer(); setTimeout(startL3,500); return; }
  const q=game.l2set[game.l2idx];
  $("#l2lvl").textContent=`Nivel 2 · Pregunta ${game.l2idx+1}/${game.l2set.length}`;
  $("#l2q").textContent=q.question;
  if(q.brand){ setBrandBar(q.brand); game.brandsSeen.add(q.brand);} else clearBrandBar();
  const opts=$("#l2opts"); opts.innerHTML="";
  const expl=$("#l2expl"); expl.classList.remove("show");
  let answered=false;
  const letters=["A","B","C","D"];
  q.options.forEach((op,i)=>{
    const b=el("button","opt",`<span class="k">${letters[i]}</span><span>${esc(op)}</span>`);
    b.onclick=e=>answer(i,b,e);
    opts.appendChild(b);
  });
  function answer(i,btn,e){
    if(answered)return; answered=true; stopTimer();
    const remaining=parseFloat(opts.dataset.p||"0");
    const btns=$$("#l2 .opt");
    btns.forEach((b,k)=>{b.disabled=true; if(k===q.correctIndex)b.classList.add("correct"); if(k===i&&i!==q.correctIndex)b.classList.add("wrong");});
    const correct=(i===q.correctIndex);
    game.attempts++;
    if(correct){
      game.hits++;
      const bonus=Math.round(remaining*s.l2_speed);
      const pts=s.l2_correct+bonus; game.l2+=pts;
      $("#l2score").textContent=game.l2; sGood();
    }else{ sBad(); }
    game.answers.push({q:q.id,correct});
    if(q.explanation){ expl.textContent=q.explanation; expl.classList.add("show"); }
    setTimeout(()=>{ game.l2idx++; askQ(); }, 2200);
  }
  runTimer(s.l2_time*1000,
    ()=>{ if(!answered){answered=true;
      const btns=$$("#l2 .opt");btns.forEach((b,k)=>{b.disabled=true;if(k===q.correctIndex)b.classList.add("correct");});
      game.attempts++; game.answers.push({q:q.id,correct:false}); sBad();
      if(q.explanation){expl.textContent=q.explanation;expl.classList.add("show");}
      setTimeout(()=>{game.l2idx++;askQ();},2000);
    }},
    p=>{opts.dataset.p=p;}
  );
}

/* ---------------- NIVEL 3 : tarjetas flotantes ---------------- */
function startL3(){
  show("l3"); setBrandBar(CONFIG.levelBrands.l3);
  const s=CONFIG.scoring; game.l3=0; $("#l3score").textContent="0";
  const field=$("#l3field"); field.innerHTML="";
  let streak=0, alive=true;
  const spawns=[];
  function spawn(){
    if(!alive)return;
    const good=Math.random()<0.62;
    const pool=good?CONFIG.level3.correct:CONFIG.level3.distractors;
    if(!pool.length){setTimeout(spawn,400);return;}
    const txt=pool[(Math.random()*pool.length)|0];
    const c=el("div","fcard",esc(txt));
    c.style.color=good?"var(--ink)":"var(--ink)";
    c.style.borderColor=good?"rgba(107,191,154,.4)":"rgba(217,139,147,.4)";
    c.style.background=good?"rgba(107,191,154,.10)":"rgba(217,139,147,.10)";
    const fw=field.clientWidth, fh=field.clientHeight;
    let x=rnd(10,fw-140), y=fh+40;
    const vx=rnd(-0.4,0.4), vy=-rnd(0.9,1.8);
    c.style.left=x+"px"; c.style.top=y+"px";
    field.appendChild(c);
    const obj={c,x,y,vx,vy,good,dead:false};
    c.onclick=ev=>{
      if(obj.dead)return; obj.dead=true; c.remove();
      if(good){
        game.l3+=s.l3_ok; game.hits++; streak++;
        if(streak>0&&streak%4===0){ game.l3+=s.l3_streak; showStreak(); }
        sGood(); flash(ev.clientX,ev.clientY,"+"+s.l3_ok,"plus");
      }else{
        game.l3=Math.max(0,game.l3-s.l3_bad); streak=0; sBad();
        flash(ev.clientX,ev.clientY,"-"+s.l3_bad,"minus");
      }
      game.attempts++;
      $("#l3score").textContent=game.l3;
    };
    spawns.push(obj);
    setTimeout(spawn,rnd(500,900));
  }
  function tick(){
    if(!alive)return;
    const fh=$("#l3field").clientHeight, fw=$("#l3field").clientWidth;
    spawns.forEach(o=>{
      if(o.dead)return;
      o.y+=o.vy; o.x+=o.vx;
      if(o.y<-60){o.dead=true;o.c.remove();return;}
      if(o.x<0||o.x>fw-120)o.vx*=-1;
      o.c.style.top=o.y+"px"; o.c.style.left=o.x+"px";
    });
    requestAnimationFrame(tick);
  }
  function showStreak(){const s=$("#l3streak");s.classList.add("show");setTimeout(()=>s.classList.remove("show"),1000);}
  countdown(3,()=>{
    spawn(); tick();
    runTimer(s.l3_time*1000,()=>{ alive=false; finishGame(); });
  });
}

/* ---------------- FIN DE PARTIDA ---------------- */
async function finishGame(){
  stopTimer(); clearBrandBar();
  const total=game.l1+game.l2+game.l3;
  const timeMs=Math.round(performance.now()-game.startTs);
  const {cat,pct}=categoryFor(total);
  const acc=game.attempts?Math.round(game.hits/game.attempts*100):0;
  const rec={
    id:uid(), ts:new Date().toISOString(),
    event:CONFIG.event.name, qbankVersion:CONFIG.qbankVersion,
    nombre:me.nombre, especialidad:me.especialidad||"", ciudad:me.ciudad||"",
    contacto:me.contacto||"", consent:!!me.consent,
    l1:game.l1,l2:game.l2,l3:game.l3,total, timeMs, category:cat,
    answers:game.answers
  };
  if(!CONFIG.demo){ await DB.resAdd(rec); srvAddResult(rec); }

  // Render result
  $("#resCat").textContent=cat;
  $("#resScore").textContent=total;
  $("#resAcc").textContent=acc+"%";
  $("#resTime").textContent=(timeMs/1000).toFixed(1)+"s";
  // posición
  const rows=await getRankRows("day");
  const pos=rows.findIndex(r=>r.id===rec.id||(r.total===total&&r.nombre===rec.nombre));
  $("#resPos").textContent = pos>=0?("#"+(pos+1)):"—";
  // WhatsApp
  buildWhatsApp(rec);
  show("result");
}

/* ---------------- WhatsApp ---------------- */
function pickReviews(seen){
  const all=CONFIG.brandReviews||{};
  const pri=[...seen].map(b=>all[b]).filter(Boolean);
  const rest=Object.keys(all).filter(b=>!seen.has(b)).map(b=>all[b]);
  return [...pri,...rest].slice(0,2);
}
function buildWhatsApp(rec){
  const w=CONFIG.whatsapp; const host=$("#resWaWrap"); host.innerHTML="";
  if(!w.enabled) return;
  const tel=String(rec.contacto||"").replace(/\D/g,"");
  if(tel.length<6) return;
  const num=(w.countryCode||"")+tel.replace(/^0+/,"");
  const parts=String(rec.nombre||"").trim().split(/\s+/).filter(Boolean);
  const titles=/^(dr|dra|dr\.|dra\.|lic|lic\.|prof|prof\.)$/i;
  const nombre1=(parts.find(p=>!titles.test(p))||parts[0]||rec.nombre);
  // Mensaje Opción B — elegante y breve
  const lines=[
    `🎉 ¡Lo lograste, ${nombre1}!`,
    ``,
    `Completaste el *Desafío en Movimiento* con *${rec.total} pts*`,
    `y alcanzaste el nivel *${rec.category}*. ¡Impecable!`,
    ``,
    `Ciencia que acompaña cada movimiento:`,
    `Gluconex · tirzepatida   |   Oxus · etoricoxib`,
    ``,
    `Gracias por jugar 💙 Laboratorios Lasca`
  ];
  const msg=encodeURIComponent(lines.join("\n"));
  const a=el("a","wa-btn");a.href=`https://wa.me/${num}?text=${msg}`;a.target="_blank";
  a.innerHTML="✆ "+esc(w.label||"Enviar por WhatsApp");
  host.appendChild(a);
}

/* ============================================================
   RANKING
   ============================================================ */
let rankScope="day";
async function getRankRows(scope){
  let rows = (srvAvailable()&&srvLiveRows)?srvLiveRows.slice() : null;
  if(!rows){ rows = srvAvailable()? (await srvGetResults())||await DB.resAll() : await DB.resAll(); }
  if(scope==="day"){ const k=todayKey(); rows=rows.filter(r=>String(r.ts||"").slice(0,10)===k); }
  rows.sort((a,b)=> b.total-a.total || (a.timeMs||0)-(b.timeMs||0));
  return rows;
}
async function renderRank(){
  const rows=await getRankRows(rankScope);
  // Podio TV (top 3)
  const pod=$("#tvPodium"); pod.innerHTML="";
  const medals=["1","2","3"], order=[1,0,2];
  if(rows.length){
    order.forEach(oi=>{const r=rows[oi];if(!r)return;
      const d=el("div","tv-pod p"+(oi+1));
      d.innerHTML=`<div class="medal">${medals[oi]}</div><div class="pnm">${esc(abbrevName(r.nombre))}</div><div class="ppt">${r.total}<small>pts</small></div>`;
      pod.appendChild(d);
    });
  }
  // Lista
  const list=$("#rankList"); list.innerHTML="";
  if(!rows.length){ list.appendChild(el("div","muted","Aún no hay participantes.")); return; }
  const start=rows.length>=3?3:0;
  rows.slice(start,20).forEach((r,k)=>{
    const pos=start+k+1;
    const row=el("div","rrow"+(pos<=3?" top"+pos:""));
    row.innerHTML=`<span class="pos">${pos}</span><span class="rn">${esc(abbrevName(r.nombre))}</span><span class="rp">${r.total}<small>pts</small></span>`;
    list.appendChild(row);
  });
}

/* ============================================================
   REGISTRO
   ============================================================ */
function buildRegister(){
  const f=CONFIG.fields; const host=$("#regFields"); host.innerHTML="";
  const mk=(id,label,type="text",ph="")=>{
    host.appendChild(el("label",null,label));
    const i=el("input");i.id="reg_"+id;i.type=type;i.placeholder=ph;
    if(type==="tel")i.inputMode="tel";
    host.appendChild(i);
    i.addEventListener("input",validateReg);
    return i;
  };
  if(f.nombre) mk("nombre","Nombre y apellido","text","Dr./Dra. ...");
  if(f.especialidad){
    host.appendChild(el("label",null,"Especialidad"));
    const sel=el("select");sel.id="reg_especialidad";
    sel.innerHTML=`<option value="">Seleccionar...</option>`+
      ["Traumatología","Reumatología","Clínica Médica","Medicina Familiar","Fisiatría","Kinesiología","Geriatría","Otra"]
      .map(o=>`<option>${o}</option>`).join("");
    host.appendChild(sel); sel.addEventListener("change",validateReg);
  }
  if(f.ciudad) mk("ciudad","Ciudad","text","Ciudad");
  if(f.contacto) mk("contacto","Celular","tel","Ej.: 0981 123 456");
  // consentimiento
  if(f.consentimiento){ $("#consentWrap").style.display="block"; $("#consentText").textContent=CONFIG.consent; $("#regConsent").addEventListener("change",validateReg);}
  else $("#consentWrap").style.display="none";
  validateReg();
}
function validateReg(){
  const f=CONFIG.fields; let ok=true;
  if(f.nombre&&!$("#reg_nombre").value.trim())ok=false;
  if(f.especialidad&&!$("#reg_especialidad").value)ok=false;
  if(f.contacto){const c=($("#reg_contacto").value||"").replace(/\D/g,"");if(c.length<7)ok=false;}
  if(f.consentimiento&&!$("#regConsent").checked)ok=false;
  $("#btnReg").disabled=!ok;
}

/* ============================================================
   PANEL ADMIN
   ============================================================ */
const ADMIN_TABS=[
  ["general","General"],["preguntas","Preguntas (N2)"],["conceptos","Conceptos (N3)"],
  ["puntaje","Puntaje y tiempos"],["registro","Registro"],["marca","Marca y logos"],
  ["wa","Marcas y WhatsApp"],["tv","Ranking (TV)"],["io","Importar/Exportar"],["res","Resultados"]
];
let adminTab="general";
function openAdmin(){ show("admin"); adminTab="general"; renderAdmin(); }
function renderAdmin(){
  const tabs=$("#adminTabs"); tabs.innerHTML="";
  ADMIN_TABS.forEach(([id,label])=>{
    const t=el("div","admin-tab"+(id===adminTab?" active":""),label);
    t.onclick=()=>{adminTab=id;renderAdmin();};
    tabs.appendChild(t);
  });
  const b=$("#adminBody"); b.innerHTML="";
  b.appendChild(({general:secGeneral,preguntas:secPreguntas,conceptos:secConceptos,
    puntaje:secPuntaje,registro:secRegistro,marca:secMarca,wa:secWA,tv:secTV,io:secIO,res:secRes})[adminTab]());
}
function field(label,val,onCh,type="text"){
  const w=el("div");w.appendChild(el("label",null,label));
  const i=el(type==="area"?"textarea":"input");if(type!=="area"&&type!=="text")i.type=type;
  i.value=val??"";i.oninput=()=>onCh(i.value);w.appendChild(i);return w;
}
function toggle(label,val,onCh){
  const w=el("label","row-flex");w.style.cssText="text-transform:none;letter-spacing:0;font-weight:600;color:var(--ink);margin:8px 0";
  const i=el("input");i.type="checkbox";i.checked=!!val;i.style.width="auto";i.onchange=()=>onCh(i.checked);
  w.appendChild(i);w.appendChild(el("span",null,label));return w;
}
async function saveConfig(){ await DB.kvSet("config",CONFIG); }

function secGeneral(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Evento y textos"));
  const g=el("div","grid2");
  g.appendChild(field("Nombre del evento",CONFIG.event.name,v=>{CONFIG.event.name=v;saveConfig();}));
  g.appendChild(field("Título de atracción",CONFIG.attractTitle,v=>{CONFIG.attractTitle=v;saveConfig();applyTexts();}));
  g.appendChild(field("Tagline",CONFIG.tagline,v=>{CONFIG.tagline=v;saveConfig();applyTexts();}));
  g.appendChild(field("Premio",CONFIG.prize,v=>{CONFIG.prize=v;saveConfig();}));
  g.appendChild(field("Texto legal",CONFIG.legal,v=>{CONFIG.legal=v;saveConfig();applyTexts();}));
  g.appendChild(field("PIN admin",CONFIG.pin,v=>{CONFIG.pin=v;saveConfig();}));
  s.appendChild(g);
  s.appendChild(el("h3",null,"Opciones"));
  s.appendChild(toggle("Pedir registro antes de jugar",CONFIG.registro,v=>{CONFIG.registro=v;saveConfig();}));
  s.appendChild(toggle("Sonido",CONFIG.sound,v=>{CONFIG.sound=v;saveConfig();}));
  s.appendChild(toggle("Modo demo (no guarda en ranking)",CONFIG.demo,v=>{CONFIG.demo=v;saveConfig();}));
  return s;
}
function secPreguntas(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Preguntas de Nivel 2"));
  CONFIG.questions.forEach((q,idx)=>{
    const it=el("div","qitem");
    const head=el("div","row-flex");head.style.justifyContent="space-between";
    head.appendChild(el("span","tag",q.id+(q.brand?(" · "+q.brand):"")));
    const del=el("button","btn ghost sm","Eliminar");del.onclick=()=>{CONFIG.questions.splice(idx,1);saveConfig();renderAdmin();};
    head.appendChild(del);it.appendChild(head);
    it.appendChild(toggle("Activa",q.active,v=>{q.active=v;saveConfig();}));
    it.appendChild(field("Enunciado",q.question,v=>{q.question=v;saveConfig();},"area"));
    q.options.forEach((op,i)=>{
      it.appendChild(field("Opción "+(i+1)+(i===q.correctIndex?" (correcta)":""),op,v=>{q.options[i]=v;saveConfig();}));
    });
    it.appendChild(field("Índice correcto (0-3)",q.correctIndex,v=>{q.correctIndex=clamp(parseInt(v)||0,0,q.options.length-1);saveConfig();},"number"));
    it.appendChild(field("Explicación (máx 160)",q.explanation,v=>{q.explanation=v.slice(0,160);saveConfig();},"area"));
    it.appendChild(field("Marca",q.brand,v=>{q.brand=v;saveConfig();}));
    s.appendChild(it);
  });
  const add=el("button","btn sm","+ Agregar pregunta");
  add.onclick=()=>{CONFIG.questions.push({id:"q"+uid().slice(0,5),active:true,question:"Nueva pregunta",options:["Opción A","Opción B"],correctIndex:0,explanation:"",brand:""});saveConfig();renderAdmin();};
  s.appendChild(add);
  return s;
}
function secConceptos(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Nivel 3 — Conceptos"));
  s.appendChild(field("Correctos (separados por coma)",CONFIG.level3.correct.join(", "),v=>{CONFIG.level3.correct=v.split(",").map(x=>x.trim()).filter(Boolean);saveConfig();},"area"));
  s.appendChild(field("Distractores (separados por coma)",CONFIG.level3.distractors.join(", "),v=>{CONFIG.level3.distractors=v.split(",").map(x=>x.trim()).filter(Boolean);saveConfig();},"area"));
  return s;
}
function secPuntaje(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Puntaje y tiempos"));
  const g=el("div","grid2");
  Object.keys(CONFIG.scoring).forEach(k=>{
    g.appendChild(field(k,CONFIG.scoring[k],v=>{CONFIG.scoring[k]=parseFloat(v)||0;saveConfig();},"number"));
  });
  s.appendChild(g);
  const rst=el("button","btn ghost sm","Restaurar valores por defecto");rst.style.marginTop="14px";
  rst.onclick=()=>{CONFIG.scoring=structuredClone(DEFAULT_CONFIG.scoring);saveConfig();renderAdmin();toast("Puntajes restaurados");};
  s.appendChild(rst);return s;
}
function secRegistro(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Campos del registro"));
  Object.keys(CONFIG.fields).forEach(k=>{
    s.appendChild(toggle(k,CONFIG.fields[k],v=>{CONFIG.fields[k]=v;saveConfig();}));
  });
  s.appendChild(field("Texto de consentimiento",CONFIG.consent,v=>{CONFIG.consent=v;saveConfig();},"area"));
  return s;
}
function imgField(label,cur,onData){
  const w=el("div");w.appendChild(el("label",null,label));
  if(cur){const im=el("img");im.src=cur;im.style.cssText="max-height:50px;background:#fff;padding:4px;border-radius:6px;display:block;margin-bottom:6px";w.appendChild(im);}
  const i=el("input");i.type="file";i.accept="image/*";
  i.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>onData(r.result);r.readAsDataURL(file);};
  w.appendChild(i);return w;
}
function secMarca(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Logo institucional"));
  s.appendChild(imgField("Logo institucional",CONFIG.instLogo,d=>{CONFIG.instLogo=d;saveConfig();toast("Logo guardado");}));
  s.appendChild(el("h3",null,"Logos de producto (pantalla final / atracción)"));
  (CONFIG.prodLogos||[]).forEach((lg,i)=>{
    const row=el("div","row-flex");
    const im=el("img");im.src=lg;im.style.cssText="max-height:40px;background:#fff;padding:4px;border-radius:6px";
    row.appendChild(im);
    const del=el("button","btn ghost sm","Quitar");del.onclick=()=>{CONFIG.prodLogos.splice(i,1);saveConfig();renderAdmin();};
    row.appendChild(del);s.appendChild(row);
  });
  s.appendChild(imgField("Agregar logo de producto","",d=>{CONFIG.prodLogos=CONFIG.prodLogos||[];CONFIG.prodLogos.push(d);saveConfig();renderAdmin();}));
  return s;
}
function secWA(){
  const s=el("div","admin-sec active");
  s.appendChild(el("h3",null,"Marca por nivel"));
  const g=el("div","grid2");
  ["l1","l2","l3"].forEach(k=>g.appendChild(field("Marca "+k.toUpperCase(),CONFIG.levelBrands[k],v=>{CONFIG.levelBrands[k]=v;saveConfig();})));
  s.appendChild(g);
  s.appendChild(el("h3",null,"Reseñas por marca"));
  Object.keys(CONFIG.brandReviews).forEach(b=>{
    s.appendChild(field(b,CONFIG.brandReviews[b],v=>{CONFIG.brandReviews[b]=v;saveConfig();},"area"));
  });
  const addr=el("button","btn ghost sm","+ Agregar marca");addr.onclick=()=>{const n=prompt("Nombre de la marca");if(n){CONFIG.brandReviews[n]="";saveConfig();renderAdmin();}};
  s.appendChild(addr);
  s.appendChild(el("h3",null,"Logos por marca"));
  Object.keys(CONFIG.brandReviews).forEach(b=>{
    s.appendChild(imgField("Logo "+b,CONFIG.brandLogos[b],d=>{CONFIG.brandLogos[b]=d;saveConfig();toast("Logo "+b+" guardado");}));
  });
  s.appendChild(el("h3",null,"WhatsApp"));
  s.appendChild(toggle("Habilitar botón WhatsApp",CONFIG.whatsapp.enabled,v=>{CONFIG.whatsapp.enabled=v;saveConfig();}));
  s.appendChild(field("Código de país",CONFIG.whatsapp.countryCode,v=>{CONFIG.whatsapp.countryCode=v;saveConfig();}));
  s.appendChild(field("Texto del botón",CONFIG.whatsapp.label,v=>{CONFIG.whatsapp.label=v;saveConfig();}));
  return s;
}
function secTV(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Ranking en vivo (TV)"));
  const on=srvAvailable();
  s.appendChild(el("p",null,`<span class="status-dot ${on?'on':'off'}"></span>${on?'Conectado a la nube (Firebase)':'Sin conexión a la nube — ranking solo local'}`));
  const base=location.href.split("?")[0];
  s.appendChild(field("URL para la TV",base+"?tv=1",()=>{}));
  s.appendChild(field("URL para tablet",base,()=>{}));
  s.appendChild(el("p","muted","Abrí la URL de la TV en la PC del stand y ponela en pantalla completa (F11)."));
  return s;
}
function secIO(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Importar / Exportar"));
  const expB=el("button","btn sm","Exportar backup (JSON)");expB.onclick=()=>{
    const blob=new Blob([JSON.stringify(CONFIG,null,2)],{type:"application/json"});
    const a=el("a");a.href=URL.createObjectURL(blob);a.download="desafio-config.json";a.click();
  };
  s.appendChild(expB);
  s.appendChild(el("label",null,"Restaurar backup / importar preguntas (JSON)"));
  const imp=el("input");imp.type="file";imp.accept="application/json";
  imp.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const data=JSON.parse(r.result);
      if(Array.isArray(data)){CONFIG.questions=data;toast("Preguntas importadas");}
      else{CONFIG=Object.assign(structuredClone(DEFAULT_CONFIG),data);toast("Backup restaurado");}
      saveConfig();renderAdmin();applyTexts();
    }catch(err){toast("JSON inválido");}};r.readAsText(f);};
  s.appendChild(imp);
  const csvB=el("button","btn ghost sm","Exportar resultados (CSV)");csvB.style.marginTop="14px";
  csvB.onclick=exportCSV;s.appendChild(csvB);
  return s;
}
async function exportCSV(){
  const rows=await DB.resAll();
  const cols=["ts","nombre","especialidad","ciudad","contacto","l1","l2","l3","total","category","timeMs"];
  const csv=[cols.join(",")].concat(rows.map(r=>cols.map(c=>`"${String(r[c]??"").replace(/"/g,'""')}"`).join(","))).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});const a=el("a");a.href=URL.createObjectURL(blob);a.download="resultados.csv";a.click();
}
function secRes(){
  const s=el("div","admin-sec active");s.appendChild(el("h3",null,"Resultados"));
  const wrap=el("div");wrap.innerHTML='<p class="muted">Cargando…</p>';s.appendChild(wrap);
  DB.resAll().then(rows=>{
    rows.sort((a,b)=>b.total-a.total);
    wrap.innerHTML="";
    if(!rows.length){wrap.innerHTML='<p class="muted">Sin resultados.</p>';}
    rows.slice(0,50).forEach((r,i)=>{
      wrap.appendChild(el("div","rrow",`<span class="pos">${i+1}</span><span class="rn">${esc(r.nombre)} <span class="muted" style="font-size:.8rem">${esc(r.especialidad||"")}</span></span><span class="rp">${r.total}</span>`));
    });
  });
  const exp=el("button","btn ghost sm","Exportar CSV");exp.onclick=exportCSV;exp.style.margin="14px 8px 0 0";
  const clr=el("button","btn ghost sm","Borrar todo");clr.style.marginTop="14px";
  clr.onclick=async()=>{ if(!confirm("¿Borrar TODOS los resultados (local y nube)?"))return; if(!confirm("Esta acción no se puede deshacer. ¿Confirmás?"))return;
    await DB.resClear(); await srvClear(); toast("Resultados borrados"); renderAdmin(); };
  s.appendChild(exp);s.appendChild(clr);
  return s;
}

/* ============================================================
   TEXTOS DINÁMICOS
   ============================================================ */
function applyTexts(){
  $("#atTitle").innerHTML = esc(CONFIG.attractTitle).replace(/(\s\S+)$/,' <span class="gold">$1</span>');
  $("#atTag").textContent=CONFIG.tagline;
  $("#atLegal").textContent=CONFIG.legal;
  renderBrandsRow($("#attractBrands"));
  renderBrandsRow($("#rankBrands"));
}
function renderBrandsRow(host){
  if(!host)return; host.innerHTML="";
  (CONFIG.prodLogos||[]).forEach(lg=>{const s=el("span","prod");const im=el("img");im.src=lg;s.appendChild(im);host.appendChild(s);});
  if(CONFIG.instLogo){const s=el("span","wl");const im=el("img");im.src=CONFIG.instLogo;s.appendChild(im);host.appendChild(s);}
}

/* ============================================================
   EVENTOS UI
   ============================================================ */
function wire(){
  $("#btnStart").onclick=()=>startFlow();
  $("#btnRankFromAttract").onclick=()=>{rankScope="day";syncRankTabs();renderRank();show("rank");};
  $("#btnReg").onclick=()=>{
    const f=CONFIG.fields;
    me={ nombre:f.nombre?$("#reg_nombre").value.trim():"Invitado",
         especialidad:f.especialidad?$("#reg_especialidad").value:"",
         ciudad:f.ciudad?$("#reg_ciudad").value.trim():"",
         contacto:f.contacto?$("#reg_contacto").value.trim():"",
         consent:f.consentimiento?$("#regConsent").checked:false };
    goInstr();
  };
  $("#btnRegBack").onclick=()=>show("attract");
  $("#btnResRank").onclick=()=>{rankScope="day";syncRankTabs();renderRank();show("rank");};
  $("#btnResAgain").onclick=()=>startFlow();
  $("#btnRankBack").onclick=()=>show("attract");
  $$("#rank .rank-tab").forEach(t=>t.onclick=()=>{rankScope=t.dataset.scope;syncRankTabs();renderRank();});

  // Admin access: mantener presionado el logo 1.5s
  let holdT=null;
  const startHold=()=>{holdT=setTimeout(()=>{show("pinModal");$("#pinInput").value="";setTimeout(()=>$("#pinInput").focus(),100);},1500);};
  const cancelHold=()=>{if(holdT)clearTimeout(holdT);};
  const lt=$("#logoTap");
  lt.addEventListener("mousedown",startHold);lt.addEventListener("touchstart",startHold,{passive:true});
  ["mouseup","mouseleave","touchend"].forEach(ev=>lt.addEventListener(ev,cancelHold));
  $("#btnPinOk").onclick=()=>{ if($("#pinInput").value===String(CONFIG.pin)){openAdmin();} else {toast("PIN incorrecto");} };
  $("#btnPinCancel").onclick=()=>show("attract");
  $("#pinInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("#btnPinOk").click();});
  $("#btnAdminExit").onclick=()=>show("attract");
}
function syncRankTabs(){$$("#rank .rank-tab").forEach(t=>t.classList.toggle("active",t.dataset.scope===rankScope));}

/* ============================================================
   INIT
   ============================================================ */
async function init(){
  await DB.init();
  const saved=await DB.kvGet("config");
  if(saved){
    // merge profundo simple: defaults + saved
    CONFIG=deepMerge(structuredClone(DEFAULT_CONFIG),saved);
    // auto-actualización de banco por versión
    if(String(saved.qbankVersion)!==String(DEFAULT_CONFIG.qbankVersion)){
      CONFIG.questions=structuredClone(DEFAULT_CONFIG.questions);
      CONFIG.qbankVersion=DEFAULT_CONFIG.qbankVersion;
      await DB.kvSet("config",CONFIG);
    }
  }else{ await DB.kvSet("config",CONFIG); }

  // Logos por defecto (embebidos en logos.js). Se aplican siempre desde el archivo,
  // salvo que el usuario los haya reemplazado manualmente (flag userLogos).
  if(window.DEFAULT_LOGOS && !CONFIG.userLogos){
    const L=window.DEFAULT_LOGOS;
    CONFIG.brandLogos=CONFIG.brandLogos||{};
    CONFIG.brandLogos.Gluconex=L.gluconex;
    CONFIG.brandLogos.Oxus=L.oxus;
    CONFIG.instLogo=L.lasca;
    CONFIG.prodLogos=[L.gluconex,L.oxus];
  }

  applyTexts(); wire();

  // Suscripción en vivo al ranking si hay nube
  const startLive=()=>{ if(srvAvailable()){ unsubLive&&unsubLive(); unsubLive=srvSubscribe(rows=>{ srvLiveRows=rows; if($("#rank").classList.contains("active"))renderRank(); }); } };
  if(srvAvailable())startLive(); else window.addEventListener("srv-ready",startLive,{once:true});

  if(TV){ document.body.classList.add("tv"); rankScope=TV_SCOPE; syncRankTabs(); await renderRank(); show("rank");
          setInterval(()=>{ if(!srvAvailable()) renderRank(); },5000); }
  else show("attract");
}
function deepMerge(base,ext){
  for(const k in ext){
    if(ext[k]&&typeof ext[k]==="object"&&!Array.isArray(ext[k])&&base[k]&&typeof base[k]==="object")
      deepMerge(base[k],ext[k]);
    else base[k]=ext[k];
  }
  return base;
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
else init();

})();
