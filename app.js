(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hear = $('hear'), clear = $('clear'), hint = $('hint');
  const identity = $('identity'), lines = [...document.querySelectorAll('.name-line')];
  const MAX_STROKES = 9, MAX_ORBITS = 2;
  let w = innerWidth, h = innerHeight, bounds;
  let strokes = [], orbits = [], history = [], recent = [], active = null;
  let pointer = null, smooth = null, lastInput = null, lastOrbit = -5000, lastSettle = -5000;
  let energy = 0, lastFrame = 0, lastReadout = 0, raf = 0, clearAt = null;
  let audio = null, playback = null, playTimer = null, activeTouch = null;
  let shift = {x:0,y:0}, key = {x:w*.7,y:h*.4};
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const ease = t => t*t*(3-2*t);
  function resize() {
    w=innerWidth; h=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=w*dpr; canvas.height=h*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    bounds=identity.getBoundingClientRect();
    // A fresh coordinate system prevents stretched traces after rotation.
    strokes=[];orbits=[];history=[];recent=[];active=null;smooth=null;pointer=null;lastInput=null;
  }
  resize();addEventListener('resize',resize);
  function protectedPoint(x,y,pad=0) {
    return y<100+pad||y>h-(w<700?125:96)-pad||
      (x>bounds.left-24-pad&&x<bounds.right+16+pad&&y>bounds.top-24-pad&&y<bounds.bottom+24+pad);
  }
  function controls() {
    clear.disabled=!(strokes.length||orbits.length||history.length)||clearAt!==null;
    hear.disabled=history.length<5||!!playback||clearAt!==null;
  }
  function retire(s,t) { if(s.retire===undefined) s.retire=t; }
  function trim(t) {
    const live=strokes.filter(s=>s.retire===undefined);
    live.slice(0,Math.max(0,live.length-MAX_STROKES)).forEach(s=>retire(s,t));
    const rings=orbits.filter(s=>s.retire===undefined);
    rings.slice(0,Math.max(0,rings.length-MAX_ORBITS)).forEach(s=>retire(s,t));
  }
  function endStroke(){active=null;}
  function receive(x,y,t) {
    if(clearAt!==null||playback||$('about').open)return;
    pointer={x,y,t};
    if(!lastInput||t-lastInput.t>180) {
      endStroke();smooth={x,y};recent=[];lastInput={x,y,t};return;
    }
    const dx=x-lastInput.x,dy=y-lastInput.y,distance=Math.hypot(dx,dy),dt=Math.max(4,t-lastInput.t);
    if(distance<.7)return;
    const speed=clamp(distance/dt,0,3),angle=Math.atan2(dy,dx);
    energy=energy*.82+speed*.18;
    const p={x:x/w,y:y/h,t,speed,angle,dist:distance,kind:'line'};
    history.push(p);history=history.filter(p=>t-p.t<40000).slice(-1800);
    recent.push({x,y,t,angle,dist:distance});recent=recent.filter(p=>t-p.t<1400).slice(-90);
    lastInput={x,y,t};
    if(recent.length>12&&t-lastOrbit>2200) {
      const pts=recent, xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      const rw=right-left,rh=bottom-top;
      let turn=0,path=0;
      for(let i=1;i<pts.length;i++) {let a=pts[i].angle-pts[i-1].angle;while(a>Math.PI)a-=2*Math.PI;while(a< -Math.PI)a+=2*Math.PI;turn+=a;path+=pts[i].dist;}
      const closure=Math.hypot(x-pts[0].x,y-pts[0].y),cx=(left+right)/2,cy=(top+bottom)/2;
      if(Math.abs(turn)>4.9&&rw>28&&rh>28&&rw<180&&rh<180&&rw/rh>.6&&rw/rh<1.65&&closure<Math.max(rw,rh)*.5&&path<Math.max(rw,rh)*5&&!protectedPoint(cx,cy,Math.max(rw,rh)/2)) {
        strokes.filter(s=>t-s.born<1800).forEach(s=>retire(s,t));
        const radius=clamp((rw+rh)/4,16,66);
        orbits.push({x:cx/w,y:cy/h,radius,born:t,angle:Math.atan2(y-cy,x-cx)});
        lastOrbit=t;endStroke();recent=[];p.kind='orbit';trim(t);
      }
    }
    if(recent.length>10&&t-lastSettle>1800) {
      let turns=0;
      for(let i=1;i<recent.length;i++)if(Math.cos(recent[i].angle-recent[i-1].angle)<-.65)turns++;
      if(turns>=3) {
        strokes.filter(s=>s.points.some(p=>Math.hypot(p.x*w-x,p.y*h-y)<110)).forEach(s=>retire(s,t));
        lastSettle=t;endStroke();recent=[];p.kind='settle';
      }
    }
    controls();
  }
  function pointerMove(e) {
    if(e.target.closest('button,a,dialog,footer')) {pointer=null;lastInput=null;endStroke();return;}
    if(e.pointerType==='touch'&&activeTouch!==e.pointerId)return;
    receive(e.clientX,e.clientY,performance.now());
  }
  addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerdown',e=>{activeTouch=e.pointerId;canvas.setPointerCapture(e.pointerId);lastInput=null;receive(e.clientX,e.clientY,performance.now());});
  const release=()=>{activeTouch=null;pointer=null;lastInput=null;endStroke();};
  canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')release();});
  canvas.addEventListener('pointercancel',release);
  document.addEventListener('pointerleave',release);
  canvas.addEventListener('keydown',e=>{const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(!d)return;e.preventDefault();key.x=clamp(key.x+d[0],20,w-20);key.y=clamp(key.y+d[1],110,h-140);receive(key.x,key.y,performance.now());});
  function trace(t,dt) {
    if(!pointer||playback||clearAt!==null)return;
    smooth??={x:pointer.x,y:pointer.y};
    const blend=1-Math.exp(-dt/38);
    smooth.x+=(pointer.x-smooth.x)*blend;smooth.y+=(pointer.y-smooth.y)*blend;
    const moving=t-pointer.t<140;
    if(!moving||protectedPoint(smooth.x,smooth.y)||t-lastOrbit<450||t-lastSettle<500){endStroke();return;}
    if(!active) {active={points:[],born:t,last:t,length:0};strokes.push(active);trim(t);}
    const prev=active.points.at(-1),p={x:smooth.x/w,y:smooth.y/h};
    if(prev) {
      const dist=Math.hypot((p.x-prev.x)*w,(p.y-prev.y)*h);
      if(dist<2.5)return;
      // Never bridge across protected text, even during a very fast swipe.
      for(let i=1;i<=8;i++)if(protectedPoint((prev.x+(p.x-prev.x)*i/8)*w,(prev.y+(p.y-prev.y)*i/8)*h)){endStroke();return;}
      active.length+=dist;
    }
    active.points.push(p);active.last=t;
    if(active.points.length>160||active.length>520)endStroke();
  }
  function opacity(s,t) {
    const age=t-s.born;
    const appear=reduced.matches?1:ease(clamp(age/350,0,1));
    const life=1-ease(clamp((age-9000)/13000,0,1));
    const retireFade=s.retire===undefined?1:1-ease(clamp((t-s.retire)/950,0,1));
    const clearFade=clearAt===null?1:1-ease(clamp((t-clearAt)/650,0,1));
    return appear*life*retireFade*clearFade;
  }
  function path(points) {
    if(points.length<2)return;
    ctx.beginPath();ctx.moveTo(points[0].x*w,points[0].y*h);
    for(let i=1;i<points.length-1;i++) {
      const p=points[i],next=points[i+1];
      ctx.quadraticCurveTo(p.x*w,p.y*h,(p.x+next.x)*w/2,(p.y+next.y)*h/2);
    }
    const end=points.at(-1);ctx.lineTo(end.x*w,end.y*h);
  }
  function proximity(x,y,t) {
    if(!pointer||t-pointer.t>1800||reduced.matches)return 0;
    return Math.pow(clamp(1-Math.hypot(pointer.x-x,pointer.y-y)/100,0,1),2);
  }
  function drawStroke(s,t) {
    if(s.points.length<3)return;
    const alpha=opacity(s,t),end=s.points.at(-1),near=proximity(end.x*w,end.y*h,t);
    let pulse=0;
    if(playback) {const phase=(t-playback.start)/3000,target=(s.born-playback.first)/playback.span;pulse=Math.exp(-Math.pow((phase-target)*16,2));}
    ctx.strokeStyle=`rgba(81,86,73,${alpha*(.23+near*.23+pulse*.4)})`;
    ctx.lineWidth=.85;ctx.lineCap='round';ctx.lineJoin='round';path(s.points);ctx.stroke();
    // One quiet endpoint replaces hundreds of unrelated stamped particles.
    if(s!==active&&s.length>55) {
      ctx.fillStyle=`rgba(87,98,70,${alpha*(.42+near*.3)})`;
      ctx.beginPath();ctx.arc(end.x*w,end.y*h,1.35+near*.7,0,Math.PI*2);ctx.fill();
      if(near>.05){ctx.strokeStyle=`rgba(109,126,84,${alpha*near*.2})`;ctx.beginPath();ctx.arc(end.x*w,end.y*h,7,0,Math.PI*2);ctx.stroke();}
    }
  }
  function drawOrbit(o,t) {
    const age=(t-o.born)/1000,alpha=opacity(o,t),x=o.x*w,y=o.y*h;
    const open=reduced.matches?1:ease(clamp(age/1.1,0,1));
    const breathe=reduced.matches?0:Math.sin(Math.min(age,5)/5*Math.PI)*2;
    const r=o.radius+breathe;
    ctx.strokeStyle=`rgba(92,108,73,${alpha*.3})`;ctx.lineWidth=.8;
    ctx.beginPath();ctx.arc(x,y,r,o.angle,o.angle+Math.PI*2*open);ctx.stroke();
    const rotation=reduced.matches?0:ease(clamp(age/4,0,1))*Math.PI*2;
    const a=o.angle+rotation;
    ctx.fillStyle=`rgba(102,126,76,${alpha*.8})`;ctx.beginPath();ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(102,126,76,${alpha*.32})`;ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();
  }
  function magneticType(t,dt) {
    let x=0,y=0;
    if(pointer&&!reduced.matches&&t-pointer.t<1800) {
      const dx=pointer.x-(bounds.left+bounds.width/2),dy=pointer.y-(bounds.top+bounds.height/2),d=Math.hypot(dx,dy);
      const force=clamp(1-d/240,0,1);
      x=clamp(dx*.025,-2.5,2.5)*force;y=clamp(dy*.025,-2.5,2.5)*force;
    }
    const blend=1-Math.exp(-dt/145);shift.x+=(x-shift.x)*blend;shift.y+=(y-shift.y)*blend;
    lines.forEach(line=>{line.style.transform=`translate3d(${shift.x.toFixed(3)}px,${shift.y.toFixed(3)}px,0)`;});
  }
  function frame(t) {
    const dt=clamp(t-(lastFrame||t-16.67),1,48);lastFrame=t;
    trace(t,dt);ctx.clearRect(0,0,w,h);
    strokes=strokes.filter(s=>t-s.born<22000&&(s.retire===undefined||t-s.retire<950));
    orbits=orbits.filter(s=>t-s.born<22000&&(s.retire===undefined||t-s.retire<950));
    for(const s of strokes)drawStroke(s,t);for(const o of orbits)drawOrbit(o,t);
    if(clearAt!==null&&t-clearAt>650){strokes=[];orbits=[];clearAt=null;controls();}
    if(!pointer||t-pointer.t>100)energy*=Math.exp(-dt/280);
    magneticType(t,dt);
    if(t-lastReadout>180) {
      $('move').value=Math.min(1,energy/3).toFixed(2);$('energy').value=energy>.8?'FLOW':energy>.06?'SOFT':'STILL';
      $('trace').value=String(strokes.filter(s=>s.points.length>2&&s.retire===undefined).length+orbits.filter(o=>o.retire===undefined).length).padStart(2,'0');
      controls();lastReadout=t;
    }
    if(playback)hear.style.setProperty('--progress',`${clamp((t-playback.start)/3000,0,1)*100}%`);
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  function stopPlayback() {
    if(playTimer)clearTimeout(playTimer);playTimer=null;
    if(playback?.master&&audio) {
      const old=playback;
      old.master.gain.cancelScheduledValues(audio.currentTime);old.master.gain.setTargetAtTime(0,audio.currentTime,.025);
      setTimeout(()=>{old.master.disconnect();old.compressor.disconnect();},100);
    }
    playback=null;hear.classList.remove('playing');hear.style.setProperty('--progress','0%');$('hear-label').textContent='Hear trace';controls();
  }
  function clearTrace(instant=false) {
    stopPlayback();history=[];recent=[];lastInput=null;pointer=null;smooth=null;active=null;energy=0;
    lastOrbit=-5000;lastSettle=-5000;
    if(instant||reduced.matches){strokes=[];orbits=[];clearAt=null;ctx.clearRect(0,0,w,h);}else clearAt=performance.now();
    hint.textContent=matchMedia('(pointer: coarse)').matches?'Drag a little. Stay a while.':'Move a little. Stay a while.';
    $('announcement').textContent='Trace cleared.';controls();return {cleared:true};
  }
  clear.addEventListener('click',()=>clearTrace());
  async function playTrace() {
    if(history.length<5||playback)return;
    hear.disabled=true;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('unsupported');
      audio??=new Audio();await audio.resume();
      if(history.length<5||clearAt!==null){controls();return;}
      const data=history.slice(),first=data[0].t,span=Math.max(1,data.at(-1).t-first),start=audio.currentTime+.06;
      const master=audio.createGain(),compressor=audio.createDynamicsCompressor();master.gain.value=.23;master.connect(compressor);compressor.connect(audio.destination);
      const notes=[];let previous=-1;
      // Leave air between notes. Fast movement adds rhythm without a sound pileup.
      for(const p of data) {const time=(p.t-first)/span*2.45;const gap=p.speed>.9?.17:.27;if(time-previous>=gap){notes.push({...p,time});previous=time;}}
      const scale=[0,2,4,7,9,12];
      notes.slice(0,15).forEach(p=>{
        const time=start+p.time,gain=audio.createGain(),pan=audio.createStereoPanner(),osc=audio.createOscillator();
        const step=clamp(Math.floor(p.speed*2),0,5),hz=261.63*Math.pow(2,scale[step]/12);
        pan.pan.value=Math.cos(p.angle)*.6;osc.type='sine';osc.frequency.value=hz*(p.kind==='orbit'?2:1);
        gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.28,time+.014);gain.gain.exponentialRampToValueAtTime(.0001,time+.48);
        osc.connect(gain);gain.connect(pan);pan.connect(master);osc.start(time);osc.stop(time+.5);
        osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};
      });
      playback={master,compressor,start:performance.now()+60,first,span};endStroke();pointer=null;lastInput=null;
      hear.classList.add('playing');$('hear-label').textContent='Listening';hint.textContent='A little echo of you.';controls();
      playTimer=setTimeout(()=>{stopPlayback();hint.textContent='That was you, for three seconds.';$('announcement').textContent=hint.textContent;},3060);
    }catch {stopPlayback();hint.textContent='Sound couldn’t start. Try Hear trace again.';$('announcement').textContent=hint.textContent;}
  }
  hear.addEventListener('click',playTrace);
  $('about-open').addEventListener('click',()=>{$('about').showModal();release();});
  $('about-close').addEventListener('click',()=>$('about').close());
  $('about').addEventListener('click',e=>{if(e.target!==$('about'))return;const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);stopPlayback();release();}else{lastFrame=0;raf=requestAnimationFrame(frame);}});
  if(matchMedia('(pointer: coarse)').matches)hint.textContent='Drag a little. Stay a while.';
  if(document.modelContext?.registerTool) {
    const lifecycle=new AbortController();
    const validate=input=>{if(input!=null&&(typeof input!=='object'||Array.isArray(input)||Object.keys(input).length))throw Error('Expected an empty object');};
    for(const tool of [
      {name:'read_trace',description:'Read current trace counts and playback state.',annotations:{readOnlyHint:true},execute(input){validate(input);return {strokes:strokes.length,orbits:orbits.length,movements:history.length,playing:!!playback};}},
      {name:'clear_trace',description:'Clear all traces and movement history from the visible canvas.',annotations:{readOnlyHint:false},execute(input){validate(input);return clearTrace(true);}}
    ])try{Promise.resolve(document.modelContext.registerTool({...tool,inputSchema:{type:'object',properties:{},additionalProperties:false}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
