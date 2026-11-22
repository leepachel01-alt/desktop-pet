/* Daba is drawn from transparent, floor-aligned frames of his own photos and videos. */
function createPug(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const hit = document.getElementById('pug-hit');
  const status = document.getElementById('pug-status');
  const {sheets, clips, views, barkSound, barkLeadIn} = JSON.parse(document.getElementById('daba-frames').textContent);
  const menu=document.getElementById('pug-actions');
  const audio=document.getElementById('pug-bark');
  if (barkSound) audio.src=barkSound;
  const controls=[...menu.querySelectorAll('[data-pug-action]')];
  const closeButton=menu.querySelector('.pug-dismiss');
  const transitionImage=document.createElement('canvas');
  transitionImage.width=canvas.width;
  transitionImage.height=canvas.height;
  const transitionContext=transitionImage.getContext('2d');
  let transitionStart=-Infinity, transitionDuration=.12;
  let loaded = 0;
  const atlases = sheets.map(src => {
    const image = new Image();
    image.onload = () => { loaded++; };
    image.src = src;
    return image;
  });

  const W = 176, H = 236, headroom = 80, floor = 111, depth = .74, tau = Math.PI * 2;
  const headings = ['front','front-right','right','back-right','back','back-left','left','front-left'];
  const clamp = (n, low=0, high=1) => Math.max(low, Math.min(high, n));
  const mix = (a,b,t) => a + (b-a)*t;
  const smooth = (a,b,rate,dt) => mix(a,b,1-Math.exp(-rate*dt));
  const ease = (a,b,value) => {
    const t=clamp((value-a)/(b-a));
    return t*t*(3-2*t);
  };
  const wrap = value => value-Math.floor(value);
  const turnTo = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));

  const strideView=name=>/^(walk|run|stand)[0-4]$/.test(name);
  const hoverDwell=.24, hoverGrace=.34;
  const feedback={
    jump:'大巴跳了一下。 / Daba makes a hop.',
    paw:'大巴伸出爪子和你握手。 / Daba offers his paw.',
    drink:'大巴在喝水。 / Daba drinks water.',
    bone:'大巴在啃骨头。 / Daba chews his bone.',
    food:'大巴在吃狗粮。 / Daba eats his kibble.',
    bark:'大巴叫了一声。 / Daba barks.'
  };
  let pointer=null, hotAt=Infinity, lastStroke=-Infinity, pointerMovedAt=-Infinity;
  let graceUntil=0, command='', commandAge=Infinity;
  let queuedAction='', menuAnchor=null;
  let endedAt=0;
  let hitCenter=null, lockedHit=null;
  let shown = false, wasPaused = false, lastPaint = -Infinity;
  let last = 0, clock = 0, previousW = 0, previousH = 0;
  let x = 0, y = 0, yaw = -.64, sector = 7, speed = 0, runMix = 0, phase = 0;
  let gait='', lastStrideFrame=null, previousVisual=null, restSide=1;
  let pursue=false, pursueAt=Infinity, slowingAt=Infinity, pace='walk', paceAt=Infinity, paceSince=-Infinity;
  let sectorCandidate=7, sectorAt=0, pivotClip='', pivotFrame=null, strideUntil=0;
  let still = 0, chase = 0, breakUntil = 0, effort = 0, recovery = 0, down = 0, pant = 0;
  let loweredAt=Infinity, restAt=Infinity, panting=false, pantUntil=0, pantLoops=0;
  let activeReaction = '', greeting = 0, greetingAge = 0, reactionStartedDown = false;
  let greetPose='greet',greetFlip=1;
  const seconds=name=>clips[name].frames.length/clips[name].fps;
  const take=(name,motion=name)=>({name,motion,seconds:seconds(name)});
  const holdFrame=(name,seconds,index=0,motion='lie')=>({name,motion,seconds,index});
  const holdLast=(name,seconds,motion)=>holdFrame(name,seconds,clips[name].frames.length-1,motion);
  const awakeRest=new Set(['sitNatural','sitTilt','sitLick','sitNod','stretch','stretchHold']);
  const restingViews=new Set(['lie','blink','lookUp','sniff','greetLie','restTurn','restTurnStart','restTurnEnd',
    'foldChin','realLift','tiredPant','proneYawn','restLick','yawnRestBefore','yawnRestAfter',...awakeRest]);
  const quietMoves=['blink','lookUp','sniff'];
  let visit=0, routine=[], cueIndex=0, cueAge=0, napAge=0, minorAge=0, nextMinor=0, minorIndex=0, minor='';
  function restPicture(cue,age) {
    const flip=clips[cue.name].left===false?-restSide:restSide;
    return cue.index==null?atTime(cue.name,age,false,flip):frame(cue.name,cue.index,flip);
  }
  function chooseRest(recovering,deep=false) {
    // The turn begins on the same photographed frame as its preparation and
    // retains its filmed end position. Each occurrence belongs to one rest bout.
    const sleep=[
      take('foldChin','settle'),holdFrame('restTurnStart',12),
      take('restTurn'),holdFrame('restTurnEnd',3.6)
    ];
    const face=[
      holdFrame('yawnRestBefore',3.8),take('proneYawn','yawn'),holdFrame('yawnRestAfter',7.5)
    ];
    const variety=deep?0:visit++%3;
    if(deep) {
      routine=[take('realLift','wake'),...face,...sleep];
    } else if(recovering) {
      routine=variety===1?[holdLast('tiredPant',3.4),...face,...sleep]:[holdLast('tiredPant',2.4),...sleep];
    } else if(variety===0) {
      routine=[holdFrame('sitNatural',2.6,0,'sit'),take('sitTilt'),holdLast('sitTilt',2.3,'sit'),
        take('sitLick'),holdLast('sitLick',2.7,'sit'),take('stretch'),
        holdFrame('stretchHold',3.1,0,'stretchRest'),...sleep];
    } else if(variety===1) {
      routine=[...face,take('restLick'),holdLast('restLick',4.2),...sleep];
    } else {
      routine=[holdFrame('sitNod',2.8,0,'sit'),take('sitNod'),holdLast('sitNod',2.8,'sit'),
        take('sitTilt'),take('sitLick'),holdLast('sitLick',3.2,'sit'),take('stretch'),
        holdFrame('stretchHold',2.7,0,'stretchRest'),...sleep];
    }
    cueIndex=0;cueAge=napAge=minorAge=0;nextMinor=3.7;minor='';minorIndex=0;
  }
  function nextRestFrame(dt) {
    let cue=routine[cueIndex];
    if(cue) {
      cueAge+=dt;
      if(cueAge>=cue.seconds) {
        // Nearby cursor motion postpones a change of resting position.
        if(cue.name==='restTurnStart'&&clock-pointerMovedAt<10) cueAge=cue.seconds;
        else {cueAge=0;cue=routine[++cueIndex];}
      }
      if(cue) return {picture:restPicture(cue,cueAge),state:cue.motion,age:cueAge,duration:cue.seconds};
    }
    napAge+=dt;
    if(napAge>34&&!minor) {
      chooseRest(false,true);
      return nextRestFrame(0);
    }
    if(!minor&&napAge>=nextMinor) {
      minor=quietMoves[minorIndex++%quietMoves.length];minorAge=0;
    }
    if(minor) {
      const name=minor;
      minorAge+=dt;
      if(minorAge<seconds(name)) return {picture:restPicture({name},minorAge),state:'lie',age:minorAge,duration:seconds(name)};
      minor='';nextMinor=napAge+4.4+1.6*Math.sin(napAge*.6)**2;
    }
    return {picture:restPicture({name:'restTurnEnd',index:0},0),state:'lie',age:0,duration:1};
  }

  canvas.dataset.renderer = 'canvas';
  let followCursor = true;
  let roamingEnabled = true, strollGoal = null, strollAt = Infinity;
  let screenPointer = null;
  let dragOffset = null, dragPosition = null;
  window.addEventListener('daba-drag-start', event => {
    dragOffset=[x-event.detail[0],y-event.detail[1]];
    dragPosition=event.detail;
    cancelActions();
    pointer=null;
    greeting=greetingAge=0;
    speed=runMix=0;
    pursue=false;
    pursueAt=slowingAt=Infinity;
    restAt=loweredAt=Infinity;
    panting=false;
    transitionStart=-Infinity;
    postponeStroll();
  });
  window.addEventListener('daba-drag-move', event => {
    if(dragOffset) dragPosition=event.detail;
  });
  window.addEventListener('daba-drag-end', event => {
    if(!dragOffset) return;
    const at=event.detail||dragPosition;
    x=at[0]+dragOffset[0];
    y=at[1]+dragOffset[1];
    dragOffset=dragPosition=null;
    lastPaint=-Infinity;
    lastStrideFrame=atDirection('stand');
    still=0;
    pointer=null;
    postponeStroll();
  });
  function postponeStroll(minimum=14, variation=7) {
    strollGoal=null;
    strollAt=clock+minimum+Math.random()*variation;
  }

  function randomWaypoint(left,right,top,bottom) {
    for(let attempt=0;attempt<14;attempt++) {
      const angle=Math.random()*tau;
      const length=110+Math.random()*160;
      const px=clamp(x+Math.cos(angle)*length,left,right);
      const py=clamp(y+Math.sin(angle)*length,top,bottom);
      if(Math.hypot(px-x,py-y)<75) continue;
      if(screenPointer&&Math.hypot(px-screenPointer[0],py-38-screenPointer[1])<110) continue;
      return [px,py];
    }
    return null;
  }

  window.addEventListener('daba-roam', event => {
    if(roamingEnabled===event.detail) return;
    roamingEnabled=event.detail;
    postponeStroll();
  });
  window.addEventListener('daba-follow', event => {
    followCursor = event.detail;
    pointer = null;
  });
  window.addEventListener('daba-home', () => {
    cancelActions();
    shown = false;
  });
  window.addEventListener('daba-cursor', event => {
    if (dragOffset) return;
    const position = event.detail;
    screenPointer=position;
    postponeStroll();
    const now = performance.now()/1000;
    const ellipse = hit.getBoundingClientRect();
    const petHovered = position && !hit.hidden &&
      ((position[0]-ellipse.left-ellipse.width/2)/(ellipse.width/2))**2 +
      ((position[1]-ellipse.top-ellipse.height/2)/(ellipse.height/2))**2 <= 1;

    if(petHovered && menu.hidden && !command) {
      if(!Number.isFinite(hotAt)||now-lastStroke>4) hotAt=now;
      lastStroke=now;
    } else if(Number.isFinite(hotAt)) {
      if(now-hotAt>=hoverDwell&&now-lastStroke<4) graceUntil=now+hoverGrace;
      hotAt=Infinity;
    }
    if(!position) {
      pointer=null;
      closeMenu();
    } else if(!menu.hidden) {
      // Outside the ring, the underlying application is free to receive clicks.
      const bounds=menu.getBoundingClientRect();
      if(position[0]<bounds.left-56||position[0]>bounds.right+56||
          position[1]<bounds.top-56||position[1]>bounds.bottom+56) closeMenu();
    } else if(followCursor&&(!pointer||Math.hypot(position[0]-pointer[0],position[1]-pointer[1])>=6)) {
      pointer=position;
      pointerMovedAt=clock;
    }
  });

  function closeMenu(restoreFocus=false) {
    if(menu.hidden) return;
    menu.hidden=true;
    menuAnchor=null;canvas.removeAttribute('data-orbit-open');
    hit.setAttribute('aria-expanded','false');
    if(restoreFocus) hit.focus({preventScroll:true});
  }

  function placeMenu() {
    if (!menuAnchor) return;
    const [footX,footY]=menuAnchor;
    const scale=canvas.clientWidth/W;
    const viewportW=innerWidth,viewportH=innerHeight;
    const compact=viewportW<=600||viewportH<=430;
    const node=controls[0].offsetWidth,edge=node/2+6;
    const vertical=Math.sqrt(3)/2;
    const minX=Math.min(76,Math.max(0,viewportW/2-edge));
    const minY=Math.min(74,Math.max(0,(viewportH/2-edge)/vertical));
    const subject=wasPaused?frame('portrait'):atDirection('stand');
    const [ox,oy]=subject.clip.orbitCenter||[0,66];
    const cx=clamp(footX+ox*subject.flip*scale,edge+minX,Math.max(edge+minX,viewportW-edge-minX));
    let cy=clamp(footY+(oy-floor)*scale,edge+minY*vertical,Math.max(edge+minY*vertical,viewportH-edge-minY*vertical));
    const rx=Math.max(1,Math.min(compact?91:108,cx-edge,viewportW-edge-cx));
    const ry=Math.max(1,Math.min(compact?89:103,(cy-edge)/vertical,(viewportH-edge-cy)/vertical));
    const width=2*(rx+node/2),height=2*(ry*vertical+node/2);
    menu.style.width=width+'px';menu.style.height=height+'px';
    menu.style.setProperty('--pug-orbit-w',rx*2+'px');
    menu.style.setProperty('--pug-orbit-h',ry*2+'px');
    const point=a=>[rx*Math.cos(a),ry*Math.sin(a)];
    const wheel=controls.map((_,i)=>point((i-2)*Math.PI/3));
    const toggle=document.querySelector('.pet-toggle')?.getBoundingClientRect();
    let closeY=-Math.min(ry,cy-closeButton.offsetHeight/2-6);
    function safe([dx,dy]){
      const x=cx+dx,y=cy+dy,r=node/2+3;
      if(x<r||x>viewportW-r||y<r||y>viewportH-r)return false;
      if(Math.hypot(dx,dy-closeY)<r+closeButton.offsetWidth/2)return false;
      if(!toggle||!toggle.width)return true;
      return Math.hypot(x-clamp(x,toggle.left,toggle.right),y-clamp(y,toggle.top,toggle.bottom))>=r;
    }
    let chosen=wheel;
    if(!wheel.every(safe)){
      // Near a screen corner, use the free portions of the same ring.
      closeY*=.57;
      const centeredY=cy;
      for(const inset of [0,10,20,30,40]){
        cy=clamp(centeredY-inset,edge+minY*vertical,viewportH-edge-minY*vertical);
        const slots=Array.from({length:64},(_,i)=>point((i/64-1/3)*tau)).filter(safe);
        const count=slots.length;
        const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
        const spacing=(node+1)**2;
        let best=Infinity;
        // Walk clockwise through the available arc, preserving both the order and touch spacing.
        for(let start=0;start<count;start++){
          const order=Array.from({length:count},(_,i)=>slots[(start+i)%count]);
          let paths=[{cost:distance2(order[0],wheel[0]),nodes:[order[0]]}];
          for(let i=1;i<wheel.length;i++){
            const next=[];
            for(let k=i;k<=count-(wheel.length-i);k++){
              if(i===wheel.length-1&&distance2(order[k],order[0])<spacing)continue;
              const placement=distance2(order[k],wheel[i]);
              for(let j=i-1;j<k;j++){
                const last=paths[j];
                if(!last||distance2(order[j],order[k])<spacing)continue;
                const cost=last.cost+placement;
                if(cost>=best||cost>=(next[k]?.cost??Infinity))continue;
                next[k]={cost,nodes:[...last.nodes,order[k]]};
              }
            }
            paths=next;
          }
          for(const result of paths){
            if(result&&result.cost<best){best=result.cost;chosen=result.nodes;}
          }
        }
        if(best<Infinity) break;
        cy=centeredY;
      }
    }
    function position(button,dx,dy) {
      button.style.setProperty('--orbit-x',dx.toFixed(2)+'px');
      button.style.setProperty('--orbit-y',dy.toFixed(2)+'px');
    }
    menu.style.transform='translate3d('+(cx-width/2)+'px,'+(cy-height/2)+'px,0)';
    controls.forEach((button,i)=>position(button,...chosen[i]));
    position(closeButton,0,closeY);
  }

  function captureTransition(duration=.12) {
    if(!shown||wasPaused||!transitionContext) return;
    transitionContext.clearRect(0,0,canvas.width,canvas.height);
    transitionContext.drawImage(canvas,0,0);
    transitionStart=performance.now()/1000;transitionDuration=duration;
  }
  function startAction(name) {
    captureTransition();
    command=name;commandAge=0;
    speed=0;pursue=false;greeting=greetingAge=0;hotAt=Infinity;graceUntil=0;
    pointer=null;lastPaint=-Infinity;
    restAt=loweredAt=Infinity;panting=false;
    status.textContent=feedback[name];
  }
  function finishAction() {
    captureTransition();
    command='';endedAt=clock;
    still=.17;strideUntil=0;gait='';pivotClip='';pivotFrame=null;
    lastStrideFrame=atDirection('stand');
    lastPaint=-Infinity;
  }
  function playBark(delay) {
    if(!barkSound) return;
    audio.currentTime=Math.max(0,barkLeadIn-delay);
    audio.play().catch(()=>{
      if(command==='bark'||queuedAction==='bark')
        status.textContent='大巴叫了一声，浏览器未播放声音。 / Bark audio could not play.';
    });
  }
  function cancelActions() {
    closeMenu();queuedAction='';command='';pointer=null;hotAt=Infinity;graceUntil=0;
    lastPaint=-Infinity;
    if(!audio.paused) audio.pause();
  }
  hit.addEventListener('click',event=>{
    if(canvas.hidden||loaded!==atlases.length) return;
    if(!menu.hidden){closeMenu(event.detail===0);return;}
    speed=0;pursue=false;
    menuAnchor=[x,y];menu.hidden=false;canvas.setAttribute('data-orbit-open','');
    hit.setAttribute('aria-expanded','true');
    hotAt=Infinity;graceUntil=0;
    if(!command&&!wasPaused) startAction('jump');
    placeMenu();
    if(event.detail===0) controls[0].focus({preventScroll:true});
  });
  closeButton.addEventListener('click',event=>closeMenu(event.detail===0));
  menu.addEventListener('focusout',event=>{
    if(event.relatedTarget&&event.relatedTarget!==hit&&!menu.contains(event.relatedTarget)) closeMenu();
  });
  document.addEventListener('pointerdown',event=>{
    if(!menu.hidden&&!menu.contains(event.target)&&event.target!==hit) closeMenu();
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!menu.hidden){
      event.preventDefault();event.stopPropagation();closeMenu(true);
    }
  });
  window.addEventListener('hashchange',cancelActions);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) cancelActions();});
  menu.addEventListener('keydown',event=>{
    const directions={ArrowRight:1,ArrowLeft:-1,ArrowDown:1,ArrowUp:-1};
    if(!(event.key in directions)&&!['Home','End'].includes(event.key))return;
    event.preventDefault();
    const index=controls.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?controls.length-1
      :(index+directions[event.key]+controls.length)%controls.length;
    controls[next].focus({preventScroll:true});
  });
  menu.addEventListener('click',event=>{
    const name=event.target.closest('[data-pug-action]')?.dataset.pugAction;
    if(!name||!Object.hasOwn(feedback,name))return;
    closeMenu(event.detail===0);
    if(!audio.paused) audio.pause();
    const delay=command==='jump'&&!wasPaused?Math.max(0,commandDuration()-commandAge):0;
    if(delay>.035) queuedAction=name;
    else {queuedAction='';startAction(name);}
    if(name==='bark') playBark(delay);
  });

  function frame(name,index=0,flip=1) {
    const clip=clips[name];
    return {name,clip,index:clamp(index,0,clip.frames.length-1),flip};
  }

  function atTime(name,elapsed,loop=false,flip=1) {
    const clip=clips[name];
    const index=Math.max(0,Math.floor(elapsed*clip.fps));
    return frame(name,loop?index%clip.frames.length:index,flip);
  }

  function atDirection(group,p=0) {
    const [name,mirrored]=views[group][sector];
    return frame(name,Math.floor(wrap(p)*clips[name].frames.length),mirrored?-1:1);
  }

  function atTurn(name,heading) {
    const clip=clips[name];
    if (!clip) return null;
    let chosen=0,distance=Infinity;
    for (let i=0;i<clip.angles.length;i++) {
      const delta=Math.abs(turnTo(heading,clip.angles[i]));
      if (delta<distance) {distance=delta;chosen=i;}
    }
    return distance<.30?frame(name,chosen):null;
  }

  function blit(rect,box) {
    const [sheet,x,y,w,h]=rect;
    ctx.drawImage(atlases[sheet],x,y,w,h,...box);
  }

  function paint(picture,activity) {
    const {clip,index,flip}=picture;
    const {jump,lift,breath,smile,tail,heart,paused}=activity;
    const zoom=canvas.width/W;
    ctx.setTransform(zoom,0,0,zoom,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.translate(0,headroom);
    ctx.save();
    ctx.translate(W*.5,floor+1);
    ctx.scale((clip.shadow||38)*(1-jump*.43),7.5-jump*3.7);
    const shade=ctx.createRadialGradient(0,0,0,0,0,1);
    shade.addColorStop(0,'rgba(3,8,16,.46)');
    shade.addColorStop(.62,'rgba(3,8,16,.23)');
    shade.addColorStop(1,'rgba(3,8,16,0)');
    ctx.globalAlpha=1-jump*.79;
    ctx.fillStyle=shade;
    ctx.fillRect(-1,-1,2,2);
    ctx.restore();

    ctx.save();
    ctx.translate(W*.5,floor-lift);
    ctx.scale(flip,1+breath);
    ctx.translate(-W*.5,-floor);
    if(!clip.tail?.behind) blit(clip.frames[index],clip.box);
    if (clip.tail) {
      const [tx,ty]=clip.tail.pivot;
      const tailFrame=clip.tail.frames?.[index]||clip.tail.frame;
      ctx.save();
      ctx.translate(tx,ty);
      ctx.rotate(tail*.36);
      ctx.translate(-tx,-ty);
      blit(tailFrame,clip.tail.box);
      ctx.restore();
      if(clip.tail.behind) blit(clip.frames[index],clip.box);
    }
    ctx.restore();

    if (heart>0) {
      const [fx,fy]=clip.face||[-12,40];
      ctx.save();
      ctx.textAlign='center';
      ctx.font='600 14px system-ui';
      ctx.fillStyle='#f9bdcb';
      for (let i=0;i<3;i++) {
        const rise=paused?.42:clamp(heart*.94-i*.16);
        ctx.globalAlpha=Math.sin(rise*Math.PI)*(.88-i*.14)*(smile>0?.8:1);
        ctx.fillText('♡',clamp(W*.5+fx*flip+(i-1)*11,12,W-12),Math.max(12,fy-lift-4-rise*14+(i%2)*4));
      }
      ctx.restore();
    }
  }

  const tired=clips.tiredPant;
  const pantFirst=tired.loopStart??0, pantLast=tired.loopEnd??(tired.frames.length-1);
  const pantCycle=pantLast-pantFirst+1;
  function startRecovery() {
    pantLoops=Math.max(2,Math.ceil((3.3+1.4*recovery)*tired.fps/pantCycle));
    const frames=tired.frames.length+(pantLoops-1)*pantCycle;
    pantUntil=clock+frames/tired.fps;
    panting=true;
  }
  function pantPicture(age,flip) {
    const n=Math.max(0,Math.floor(age*tired.fps));
    const afterLoops=pantFirst+pantLoops*pantCycle;
    const index=n<pantFirst?n:n<afterLoops
      ?pantFirst+(n-pantFirst)%pantCycle:pantLast+1+n-afterLoops;
    return frame('tiredPant',index,flip);
  }

  function commandDuration() {
    if(command==='jump') return clips.hop.frames.length/clips.hop.fps;
    const clip=clips[command];
    if(!clip) return 0;
    if(command==='bark') return Math.max(clip.frames.length/clip.fps,Math.max(0,(audio.duration||0)-barkLeadIn))+.12;
    return clip.playFor ?? (clip.frames.length/clip.fps+.2);
  }

  function pulse(at,duration) {
    const age=(clock-at)/duration;
    return age>0&&age<1?Math.sin(age*Math.PI):0;
  }

  function selectStride(group,progress) {
    const wanted=atDirection(group,progress);
    if (gait && gait!==group && lastStrideFrame?.name && clips[lastStrideFrame.name].links?.[wanted.name]) {
      const link=clips[lastStrideFrame.name].links[wanted.name][lastStrideFrame.index];
      phase=Math.floor(phase)+link/wanted.clip.frames.length;
      return frame(wanted.name,link,wanted.flip);
    }
    return wanted;
  }

  return function updatePug(now,_fairyX,_fairyY,paused,_quiet) {
    const t=now/1000,dt=shown&&last?clamp(t-last,0,.048):0;
    last=t;
    if (canvas.hidden || loaded!==atlases.length) {
      if (shown) status.textContent='';
      shown=false;hit.hidden=true;hotAt=Infinity;graceUntil=0;lockedHit=null;
      command=queuedAction='';commandAge=Infinity;closeMenu();
      if(!audio.paused) audio.pause();
      return;
    }
    const width=innerWidth,height=innerHeight,small=width<=600;
    const scale=canvas.clientWidth/W||1;
    const margin=Math.min(width/2,58*scale);
    const maxY=Math.max(0,height-4),minY=Math.min(maxY,floor*scale+3);
    const homeX=width-(small?112:143),homeY=height-56;
    const resized=width!==previousW||height!==previousH;
    const pauseChanged=paused!==wasPaused;
    previousW=width;previousH=height;wasPaused=paused;
    if (!shown) {
      shown=true;x=homeX;y=homeY;yaw=-.64;sector=7;speed=runMix=phase=0;restSide=1;
      still=chase=breakUntil=effort=recovery=down=pant=greeting=greetingAge=0;
      loweredAt=restAt=Infinity;panting=false;pantUntil=0;
      lastStrideFrame=previousVisual=null;gait=activeReaction='';lastPaint=-Infinity;
      routine=[];visit=0;
      postponeStroll();
      pointerMovedAt=lastStroke=-Infinity;
      hitCenter=lockedHit=null;
    }
    if (pauseChanged||resized||lastPaint===-Infinity&&previousVisual===null) {
      pursue=false;pursueAt=slowingAt=paceAt=Infinity;pace='walk';paceSince=-Infinity;
      sectorCandidate=sector;sectorAt=0;pivotClip='';pivotFrame=null;strideUntil=0;
      if(pauseChanged||resized) postponeStroll();
      if (pauseChanged) {
        restAt=loweredAt=Infinity;panting=false;
        lockedHit=null;
      }
    }

    commandAge+=dt;
    if((command||!menu.hidden)&&document.querySelector('dialog[open]')) cancelActions();
    if(command&&commandAge>=commandDuration()){
      finishAction();
      if(queuedAction){const next=queuedAction;queuedAction='';startAction(next);}
    }
    const manual=Boolean(command);
    const leaping=command==='jump';

    const choosing=!menu.hidden;
    const petWanted=!dragOffset&&!paused&&!choosing&&!manual&&(t-hotAt>=hoverDwell&&t-lastStroke<4||t<graceUntil);
    if (petWanted&&!lockedHit) lockedHit=hitCenter;
    if (!petWanted&&!leaping) lockedHit=null;
    const previousReaction=activeReaction;
    activeReaction=manual?command:petWanted?'greet':'';
    if (activeReaction!==previousReaction) {
      lastPaint=-Infinity;
      if (activeReaction==='greet') {
            reactionStartedDown=!awakeRest.has(previousVisual?.name)&&(down>.48||restingViews.has(previousVisual?.name));
        if(reactionStartedDown) {
          greetPose='greetLie';greetFlip=previousVisual?.name==='restTurn'?-restSide:previousVisual?.flip??-restSide;
        } else {
          const pose=lastStrideFrame?atDirection('stand'):frame('portrait');
          greetPose=pose.name==='portrait'?'greet':'greetStand'+pose.name.slice(5);
          greetFlip=pose.flip;
        }
        greetingAge=0;
        if(previousVisual&&!restingViews.has(previousVisual.name)&&!previousVisual.name.startsWith('stand')&&previousVisual.name!=='portrait') captureTransition(.18);
      } else if(previousReaction==='greet'&&!reactionStartedDown&&!manual) {
        still=0;restAt=Infinity;
      }
      if (activeReaction==='greet') status.textContent='大巴张开嘴，朝你摇尾巴。 / Daba greets you with a wag.';
      if (!activeReaction) status.textContent='';
    }
    hit.hidden=false;

    let roaming=false;
    let visual=frame('portrait');
    let locomotion='idle',breath=0,smile=0,tail=0,jump=0,heart=0,chin=0,blink=0,ear=0,sniff=0,yawn=0;
    if (dragOffset) {
      x=dragPosition[0]+dragOffset[0];
      y=dragPosition[1]+dragOffset[1];
      visual=atDirection('stand');
      locomotion='drag';
    } else if (paused) {
      speed=runMix=down=pant=greeting=greetingAge=0;
      if (!resized&&!pauseChanged&&lastPaint!==-Infinity&&!manual) return;
      heart=leaping?.65:0;
      if(manual){
        visual=leaping?frame('hop',clips.hop.stillIndex||0,restSide):frame(command,clips[command].stillIndex||0,restSide);
        locomotion=command;
      }
    } else {
      clock+=dt;
      const modalOpen=Boolean(document.querySelector('dialog[open]'));
      const focus=document.activeElement;
      const typing=focus?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(focus?.tagName||'');
      const canMove=!modalOpen&&!typing&&clock-endedAt>.28;
      const hold=manual||choosing||petWanted||greeting>.075||hit.matches(':focus-visible');
      if (hold && (strollGoal || clock+9>strollAt)) postponeStroll();
      if (strollGoal && Math.hypot(strollGoal[0]-x,strollGoal[1]-y)<10) {
        pointer=null;
        postponeStroll(24,17);
      }

      const cue=routine[cueIndex];
      const atRest=!panting&&!minor&&(!cue||cue.index!=null&&cue.name!=='restTurnStart');
      if (roamingEnabled&&!strollGoal&&canMove&&!hold&&!pursue&&speed<4&&clock>=strollAt&&atRest) {
        strollGoal=randomWaypoint(margin,width-margin,minY,maxY);
        if (strollGoal) pointer=null;
        else postponeStroll(4,4);
      }
      roaming=Boolean(strollGoal)&&canMove&&!hold;
      const destination=roaming?strollGoal:pointer&&[pointer[0],pointer[1]+37*scale];
      const goalX=clamp(destination?.[0]??x,margin,width-margin);
      const goalY=clamp(destination?.[1]??y,minY,maxY);
      const dx=goalX-x,dy=goalY-y;
      const distance=Math.hypot(dx,dy);
      const leash=roaming?7:small?37:43;
      const gap=Math.max(0,distance-leash);
      if (chase>5.6&&effort>1.09&&breakUntil<=clock) breakUntil=clock+5.6;
      const canPursue=Boolean(destination)&&canMove&&!hold&&clock>=breakUntil;
      if (!canPursue) {
        pursue=false;pursueAt=slowingAt=Infinity;
      } else if (pursue) {
        slowingAt=gap<=4?Math.min(slowingAt,clock):Infinity;
        if (gap<=1.15||clock-slowingAt>=.14) {
          pursue=false;pursueAt=Infinity;
        }
      } else {
        pursueAt=gap>=14?Math.min(pursueAt,clock):Infinity;
        if (gap>=36||clock-pursueAt>=.14) {
          pursue=true;slowingAt=Infinity;
        }
      }
      const wantsMove=pursue;
      const yawError=wantsMove?turnTo(yaw,Math.atan2(dx,dy/depth)):0;
      if (wantsMove) yaw+=clamp(yawError,-8.1*dt,8.1*dt);
      const viewError=Math.abs(turnTo(sector*tau/8,yaw));
      const directedSector=(Math.round(yaw/(tau/8))+80000)%8;
      if (directedSector!==sector && viewError>.55) {
        if (directedSector!==sectorCandidate) { sectorCandidate=directedSector;sectorAt=clock; }
        if (viewError>.86||clock-sectorAt>=.115) sector=directedSector;
      } else {
        sectorCandidate=sector;
      }
      // Cross one distance to start running and a closer distance to return to a walk.
      const wantedPace=roaming?'walk':pace==='run'
        ? (!wantsMove||gap<=(small?61:91)?'walk':'run')
        : (wantsMove&&gap>=(small?108:147)?'run':'walk');
      paceAt=wantedPace===pace?Infinity:Math.min(paceAt,clock);
      const urgentRun=wantedPace==='run'&&gap>243;
      if (wantedPace!==pace && (urgentRun || clock-paceAt>=.24&&clock-paceSince>=.43)) {
        pace=wantedPace;paceSince=clock;paceAt=Infinity;
      }
      const wantRun=!roaming&&wantsMove&&pace==='run'?1:0;
      runMix=smooth(runMix,wantRun,wantRun>runMix?4.7:6.7,dt);
      const path=(Math.hypot(dx,dy/depth)/(distance||1))*gap;
      const ceiling=roaming?(small?53:65):mix(small?76:94,small?203:246,runMix);
      const targetSpeed=wantsMove?Math.min(ceiling,path*3.45,Math.sqrt(path*570))*
        clamp(Math.cos(yawError),0,1)**1.2*(1-.93*ease(.23,.94,down)):0;
      speed=hold?0:smooth(speed,targetSpeed,targetSpeed>speed?5.1:8.2,dt);
      if(speed<.65&&!wantsMove) speed=0;
      const prevX=x,prevY=y;
      if (speed>0) {
        const movement=Math.min(speed*dt,path+1.6);
        x=clamp(x+Math.sin(yaw)*movement,margin,width-margin);
        y=clamp(y+Math.cos(yaw)*movement*depth,minY,maxY);
      }
      const walked=Math.hypot(x-prevX,(y-prevY)/depth);
      const steer=Math.abs(yawError);
      if (!wantsMove||steer<.28||speed>115) {
        pivotClip='';pivotFrame=null;
      } else if (!pivotClip&&steer>1.12&&speed<36) {
        const name=Math.cos(yaw)<-.25?'rearTurn':'frontTurn';
        const first=atTurn(name,yaw);
        if (first) { pivotClip=name;pivotFrame=first; }
      }
      const turning=wantsMove&&steer>.68;
      const stepping=speed>9&&walked>.03||turning;
      if (stepping) strideUntil=clock+.16;
      const striding=!hold&&(stepping||clock<strideUntil&&walked>.025&&speed>4.7);
      if (striding) {
        still=0;chase+=dt;
        const running=gait==='run'?speed>87&&runMix>.35:speed>106&&runMix>.62;
        const nextGait=running?'run':'walk';
        phase=wrap(phase+walked/(mix(52,81,runMix)*scale));
        visual=selectStride(nextGait,phase);
        gait=nextGait;lastStrideFrame=visual;
        locomotion=running?'run':wantsMove?'walk':'brake';
        if (pivotClip) {
          pivotFrame=atTurn(pivotClip,yaw)||pivotFrame;
          visual=pivotFrame||visual;
        }
        if (sector>0&&sector<4) restSide=-1;
        if (sector>4) restSide=1;
        effort=clamp(effort+dt*ease(17,54,speed)*mix(.175,.53,runMix)*ease(.03,.53,walked),0,1.24);
        recovery=Math.max(recovery,.89*ease(.035,.80,effort));
      } else {
        still=manual?0:still+dt;
        if (still>.35||manual) chase=0;
        effort=Math.max(0,effort-dt*.205);
        if (still>2.25) recovery=Math.max(0,recovery-dt*.155);
        if (lastStrideFrame && still<.115) {
          visual=lastStrideFrame;
          locomotion='brake';
        } else if (lastStrideFrame) {
          visual=atDirection('stand');
        }
        if (still>.23||manual) gait='';
      }

      if (wantsMove||manual) {
        restAt=loweredAt=Infinity;panting=false;
      }
      const settleDelay=lastStrideFrame?(recovery>.085?.67:1.74):3.05;
      if (!Number.isFinite(restAt)&&!wantsMove&&!hold&&speed<8&&still>settleDelay) {
        restAt=clock;
        pantUntil=clock;
        if (recovery>.085) startRecovery();
        chooseRest(panting);
      }
      if (panting&&clock>=pantUntil) panting=false;
      const exerted=panting&&!wantsMove;
      const settleAge=clock-restAt;
      const shouldRest=Number.isFinite(restAt)&&!wantsMove&&!manual;
      down=smooth(down,shouldRest||reactionStartedDown&&greeting>.19?1:0,shouldRest?4.7:7.1,dt);
      if (down>.997) down=1;
      if (down<.003) down=0;
      pant=smooth(pant,exerted?Math.max(.24,recovery):0,5.6,dt);
      if (shouldRest) {
        if(exerted) {
          visual=pantPicture(settleAge,tired.left===false?-restSide:restSide);
          locomotion='pant';chin=0;
        } else {
          const cue=nextRestFrame(hold?0:dt);
          visual=cue.picture;locomotion=cue.state;
          const name=visual.name, age=cue.age;
          chin=['restTurnStart','restTurnEnd','restTurn','lie','blink','lookUp','sniff'].includes(name)?1:0;
          if(name==='foldChin') chin=ease(.1,cue.duration,age);
          if(name==='proneYawn') yawn=ease(.04,.5,age)*(1-ease(cue.duration*.6,cue.duration*.92,age));
          if(name==='blink') blink=Math.sin(Math.PI*age/cue.duration);
          if(name==='lookUp') ear=Math.sin(Math.PI*age/cue.duration)*Math.sin(age*16);
          if(name==='sniff') sniff=Math.sin(Math.PI*age/cue.duration)*Math.sin(age*21);
        }
      }
      if (!striding&&!shouldRest) breath=Math.sin(clock*2.43)*.002;

      greeting=smooth(greeting,petWanted?1:0,petWanted?8.8:13.5,dt);
      if (greeting>.075&&!manual&&!choosing) {
        greetingAge+=dt;
        const expression=clips[greetPose];
        smile=ease(.02,.45,greetingAge)*greeting;
        visual=frame(greetPose,Math.round(smile*(expression.frames.length-1)),greetFlip);
        tail=Math.sin(greetingAge*13.5)*(.75+.12*Math.sin(greetingAge*2.1))*greeting;
        heart=greetingAge<1.15?greetingAge:0;
        locomotion='greet';breath=0;
        if (reactionStartedDown) down=1;
      } else if (!petWanted) {
        greetingAge=0;
      }
      if (choosing&&!manual) {
        visual=lastStrideFrame?atDirection('stand'):frame('portrait');
        locomotion='idle';
      }
      if (leaping) {
        const hop=clips.hop,flip=hop.left===false?-restSide:restSide;
        visual=atTime('hop',commandAge,false,flip);
        jump=hop.air?.[visual.index]||0;
        breath=0;locomotion='jump';down=0;chin=0;
      }else if(manual){
        const clip=clips[command];
        const progress=command==='bark'&&!audio.paused?audio.currentTime-barkLeadIn:commandAge;
        const offset=clip.audioLead??0;
        visual=atTime(command,Math.max(0,progress+offset),false,clip.left===false?-restSide:restSide);
        locomotion=command;
        if(command==='paw') heart=commandAge*.71;
      }
    }

    x=clamp(x,margin,width-margin);y=clamp(y,minY,maxY);
    const lift=0;
    canvas.dataset.pose=activeReaction?'pet':locomotion==='idle'?'rest':locomotion;
    canvas.dataset.locomotion=locomotion;
    canvas.toggleAttribute('data-strolling',roaming);
    hit.toggleAttribute('data-dragging',Boolean(dragOffset));
    canvas.dataset.view=visual.name;
    canvas.dataset.direction=headings[sector];
    canvas.dataset.yaw=yaw.toFixed(3);
    canvas.dataset.speed=speed.toFixed(2);
    canvas.dataset.stridePhase=wrap(phase).toFixed(3);
    canvas.dataset.lie=down.toFixed(3);
    canvas.dataset.chin=chin.toFixed(3);
    canvas.dataset.pant=pant.toFixed(3);
    canvas.dataset.blink=blink.toFixed(3);
    canvas.dataset.ear=ear.toFixed(3);
    canvas.dataset.sniff=sniff.toFixed(3);
    canvas.dataset.yawn=yawn.toFixed(3);
    canvas.dataset.tail=tail.toFixed(3);
    canvas.dataset.smile=smile.toFixed(3);
    canvas.dataset.jump=jump.toFixed(3);
    canvas.dataset.action=activeReaction;
    canvas.dataset.frame=String(visual.index);
    canvas.toggleAttribute('data-petting',Boolean(activeReaction));
    canvas.style.transform=`translate3d(${(x-W*scale*.5).toFixed(2)}px,${(y-(floor+headroom)*scale).toFixed(2)}px,0)`;
    const [hx,hy]=visual.clip.hitByFrame?.[visual.index]||visual.clip.hit||[0,70];
    hitCenter=lockedHit||[clamp(x+hx*visual.flip*scale,42,width-42),y+(hy-floor-lift)*scale];
    const [hitX,hitY]=hitCenter;
    hit.style.transform=`translate3d(${hitX.toFixed(2)}px,${hitY.toFixed(2)}px,0) translate(-50%,-50%)`;
    if(!menu.hidden&&resized){menuAnchor=[x,y];placeMenu();}
    if (!resized&&!pauseChanged&&previousVisual?.name===visual.name&&t-lastPaint<.016) return;
    // A photographed rest pose occupies exactly one layer, including its tongue.
    // Motion blending remains available for the original directional gait changes.
    if(restingViews.has(visual.name)||restingViews.has(previousVisual?.name)) transitionStart=-Infinity;
    else if(!manual&&!choosing&&previousVisual&&previousVisual.name!==visual.name&&
      strideView(previousVisual.name)&&strideView(visual.name)) captureTransition(.09);
    previousVisual=visual;lastPaint=t;
    paint(visual,{jump,lift,breath,smile,tail,heart,paused});
    const blend=ease(0,transitionDuration,t-transitionStart);
    if(blend<1&&!paused){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      ctx.globalCompositeOperation='destination-in';
      ctx.fillStyle='rgba(0,0,0,'+blend+')';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-blend;
      ctx.drawImage(transitionImage,0,0);ctx.restore();
    }
  };
}
