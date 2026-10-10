export function cameraPresentation(brief){
 const source=brief.sources.find(s=>s.id==='feed-camera');
 const frame=brief.observations.find(r=>r.sourceId==='feed-camera'&&r.payload?.kind==='camera_frame');
 return {eventId:brief.event.id,venue:brief.event.venue.name,state:source?.state||'waiting',frame:frame?.payload||null,evidenceId:frame?.evidenceId||null,receivedAt:frame?.observedAt||null,playable:source?.state==='simulated_connected'&&Boolean(frame)&&frame.observedAt===source.lastReceivedAt};
}
export function createSyntheticCamera(target){
 const heading=document.createElement('h2');heading.textContent='Selected stadium · synthetic camera demonstration';
 const explanation=document.createElement('p');explanation.textContent='Procedurally generated training video. This is not imagery of the stadium, a live CCTV connection, or a detection system. Game selection changes the exercise context; source records control camera availability.';
 const venue=document.createElement('p'),status=document.createElement('p'),video=document.createElement('video'),button=document.createElement('button'),link=document.createElement('a');
 status.setAttribute('role','status');video.muted=true;video.playsInline=true;video.controls=true;video.setAttribute('aria-label','Synthetic training camera stream');video.style.cssText='display:none;width:100%;max-width:800px;background:#091321';
 button.textContent='Play synthetic camera';link.textContent='Camera evidence';
 target.append(heading,explanation,venue,status,video,button,document.createTextNode(' · '),link);
 const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;const ctx=canvas.getContext('2d');
 let model=null,timer=null,stream=null,tick=0;
 function stop(){clearInterval(timer);timer=null;video.pause();stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;video.style.display='none';button.textContent='Play synthetic camera'}
 function draw(){
  if(!ctx)return;ctx.fillStyle='#091321';ctx.fillRect(0,0,800,450);
  ctx.fillStyle='#ffcf70';ctx.font='bold 22px sans-serif';ctx.fillText('SYNTHETIC TRAINING • NOT REAL VENUE IMAGERY',18,32);
  ctx.fillStyle='#bccddd';ctx.font='16px sans-serif';ctx.fillText(model.venue.slice(0,65),18,60);ctx.fillText(`${model.eventId} • camera EXERCISE-CAM-01 • frame ${model.frame.frame}`,18,86);
  ctx.fillStyle='#293c4e';ctx.fillRect(0,160,800,180);ctx.strokeStyle='#e1c37f';ctx.setLineDash([24,18]);ctx.beginPath();ctx.moveTo(0,250);ctx.lineTo(800,250);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<model.frame.vehicles;i++){const x=(tick*6+i*190)%880-80,y=i%2?275:185;ctx.fillStyle=i%2?'#6cb9d9':'#9acfaa';ctx.fillRect(x,y,68,32);ctx.fillStyle='#152638';ctx.fillRect(x+42,y+5,15,22)}
  ctx.fillStyle='#bccddd';ctx.font='18px sans-serif';ctx.fillText(`Generated video tick ${tick++} • no real sensor input`,18,392);ctx.fillText(`Source observation: ${model.receivedAt}`,18,422);
 }
 button.onclick=async()=>{
  if(timer){stop();return}if(!model?.playable)return;
  if(!ctx||typeof canvas.captureStream!=='function'){status.textContent='Synthetic video unavailable: this browser does not support canvas streaming.';return}
  draw();stream=canvas.captureStream(10);video.srcObject=stream;video.style.display='block';timer=setInterval(draw,100);button.textContent='Stop synthetic camera';
  try{await video.play();status.textContent='Synthetic training video playing. No real camera is connected.'}catch{stop();status.textContent='Synthetic playback was not started by this browser. Try Play again.'}
 };
 return {update(brief){const next=cameraPresentation(brief);if(model?.eventId!==next.eventId||!next.playable)stop();model=next;venue.textContent=`Exercise context: ${next.venue} · ${next.eventId}`;button.disabled=!next.playable;link.hidden=!next.evidenceId;if(next.evidenceId)link.href=`#${next.evidenceId}`;status.textContent=`SYNTHETIC · ${next.state} · ${next.receivedAt?'frame observation '+next.receivedAt:'awaiting camera feed record'}${next.playable?'':'. Playback unavailable; no current frame is represented.'}`},destroy:stop};
}
