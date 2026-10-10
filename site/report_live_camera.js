import {publicRoadVideoAgency} from './camera_video.js';

const HOUR=3600000;
const stillAgency=item=>{
  const url=item?.stillUrl||'';
  if(item?.agency==='Caltrans'&&item.inService===true&&/^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d[47]\/cctv\/image\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.jpg$/.test(url))return 'Caltrans';
  if(item?.agency==='WSDOT'&&/^https:\/\/images\.wsdot\.wa\.gov\/[a-z0-9_-]+\/[a-z0-9_-]+\.jpg$/i.test(url))return 'WSDOT';
  if(item?.agency==='TDOT SmartWay'&&/^tdot-smartway-\d{1,6}$/.test(item.id||'')&&/^https:\/\/tnsnapshots\.com\/thumbs\/R3_\d{3}\.flv\.png$/.test(url))return 'TDOT SmartWay';
  return null;
};
const validLink=url=>{try{return new URL(url).protocol==='https:'}catch{return false}};

export function selectReportRoadCamera(snapshot,venueId,now=Date.now()){
  const built=Date.parse(snapshot?.builtAt);
  if(!/^\d{1,8}$/.test(String(venueId||''))||!Number.isFinite(built)||built>now+60000||now-built>12*HOUR)return {state:'stale_or_unavailable'};
  const items=snapshot.byVenue?.[venueId];
  if(!Array.isArray(items)||items.length>50)return {state:'no_coverage'};
  const candidates=items.filter(item=>Number.isFinite(item?.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=15&&typeof item.name==='string'&&item.name.length<=200&&validLink(item.sourceUrl)&&validLink(item.viewerUrl)&&snapshot.sources?.some(source=>source.status==='ok'&&(source.url===item.sourceUrl||source.url===`${item.sourceUrl}/query`)));
  const playable=candidates.filter(item=>publicRoadVideoAgency(item)&&item.videoPlaylistStatus!=='playlist_unavailable_at_sync').sort((a,b)=>a.distanceKm-b.distanceKm);
  const still=candidates.filter(item=>stillAgency(item)).sort((a,b)=>a.distanceKm-b.distanceKm);
  const item=playable[0]||still[0];
  if(!item)return {state:'no_public_image',builtAt:new Date(built).toISOString()};
  return {state:'available',builtAt:new Date(built).toISOString(),item:{id:item.id,agency:item.agency,name:item.name,distanceKm:item.distanceKm,viewerUrl:item.viewerUrl,sourceUrl:item.sourceUrl,videoUrl:publicRoadVideoAgency(item)?item.videoUrl:null,stillUrl:stillAgency(item)?item.stillUrl:null}};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-venue-id]');
  const target=document.querySelector('#direct-road-camera');
  if(main&&target){
    let active=null,pending=false,hlsLoader=null,shownKey=null;
    const stop=()=>{if(!active)return;const {video,hls,button,state}=active;hls?.destroy();video.pause();video.removeAttribute('src');video.load();video.style.display='none';if(button.isConnected)button.textContent='Play public roadway stream';if(state.isConnected)state.textContent='Stream stopped.';active=null};
    const line=text=>{const p=document.createElement('p');p.textContent=text;target.append(p);return p};
    const link=(url,label)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;return a};
    async function refresh(){
      if(pending||document.visibilityState!=='visible')return;
      pending=true;
      try{
        const response=await fetch(new URL('cameras.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('Snapshot unavailable');
        const raw=await response.text();if(raw.length>2_000_000)throw Error('Snapshot too large');
        const result=selectReportRoadCamera(JSON.parse(raw),main.dataset.venueId);
        const nextKey=result.state==='available'?`${result.builtAt}|${result.item.id}|${result.item.videoUrl||''}|${result.item.stillUrl||''}`:null;
        if(nextKey&&nextKey===shownKey)return;
        shownKey=nextKey;
        stop();target.replaceChildren();
        if(result.state!=='available'){
          line(result.state==='no_public_image'?'No source-validated public roadway image or stream is available for this venue in the current snapshot.':result.state==='no_coverage'?'No connected roadway camera inventory covers this venue.':'Roadway camera snapshot is unavailable or stale.');
          return;
        }
        const item=result.item;
        line(`${item.agency} · ${item.name} · ${item.distanceKm} km from the unreviewed stadium point. Metadata snapshot ${result.builtAt}.`);
        line('This is a public roadway camera. Its current field of view, latency, and any stadium visibility are unverified. It is not stadium CCTV or a threat observation.');
        if(item.stillUrl){
          const img=document.createElement('img');img.alt=`${item.agency} public roadway image near ${item.name}`;img.referrerPolicy='no-referrer';img.loading='lazy';img.style.cssText='display:block;max-width:100%;max-height:420px;margin:12px 0';img.src=`${item.stillUrl}?t=${Date.now()}`;target.append(img);
          const note=line('Publisher image freshness is unverified; check any overlaid timestamp. The image refreshes while this report is visible.');
          const timer=setInterval(()=>{if(!img.isConnected){clearInterval(timer);return}if(document.visibilityState==='visible'){img.src=`${item.stillUrl}?t=${Date.now()}`;note.textContent=`Publisher image freshness is unverified. Rechecked ${new Date().toLocaleTimeString()}.`}},120000);
        }
        if(item.videoUrl){
          const button=document.createElement('button');button.type='button';button.textContent='Play public roadway stream';target.append(button);
          const video=document.createElement('video');video.controls=true;video.muted=true;video.playsInline=true;video.preload='none';video.style.cssText='display:none;max-width:100%;max-height:420px;margin:12px 0';target.append(video);
          const state=line('Stream playback has not been verified in this browser.');
          let fallbackPending=false;
          const startHls=async()=>{
            if(!hlsLoader)hlsLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/hls.min.js',import.meta.url).href;script.onload=()=>window.Hls?resolve(window.Hls):reject(Error('HLS unavailable'));script.onerror=()=>reject(Error('HLS unavailable'));document.head.append(script)}).catch(error=>{hlsLoader=null;throw error});
            const Hls=await hlsLoader;if(!button.isConnected||active?.video!==video)return;
            if(!Hls.isSupported())throw Error('HLS unsupported');
            video.removeAttribute('src');video.load();
            const hls=new Hls({enableWorker:true,maxBufferLength:20});active.hls=hls;
            hls.on(Hls.Events.MEDIA_ATTACHED,()=>hls.loadSource(item.videoUrl));
            hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{state.textContent='Press play on the video control.'}));
            hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&active?.video===video)state.textContent='Stream unavailable in this browser. Open the agency viewer.'});
            hls.attachMedia(video);
          };
          const fallback=()=>{
            if(active?.video!==video||active.hls||fallbackPending)return;
            fallbackPending=true;state.textContent='Trying the HLS player for this agency stream…';
            startHls().catch(()=>{if(active?.video===video)state.textContent='Stream unavailable in this browser. Open the agency viewer.'}).finally(()=>{fallbackPending=false});
          };
          button.addEventListener('click',async()=>{
            if(active?.video===video){stop();video.style.display='none';button.textContent='Play public roadway stream';state.textContent='Stream stopped.';return}
            stop();active={video,hls:null,button,state};video.style.display='block';button.textContent='Stop public roadway stream';state.textContent='Connecting to the agency stream…';
            video.onplaying=()=>{if(active?.video===video)state.textContent='Playing agency roadway stream; latency and field of view remain unverified.'};
            video.onerror=fallback;
            try{
              if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=item.videoUrl;await video.play()}
              else await startHls();
            }catch{fallback()}
          });
        }
        const sources=document.createElement('p');sources.append(link(item.viewerUrl,'Agency camera viewer'),document.createTextNode(' · '),link(item.sourceUrl,'Camera metadata source'));target.append(sources);
      }catch{shownKey=null;stop();target.replaceChildren();line('Roadway camera check failed. Use the agency source and do not infer that cameras are offline.')}finally{pending=false}
    }
    refresh();setInterval(refresh,300000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();else stop()});
  }
}
