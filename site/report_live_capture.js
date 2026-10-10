export const livePanelIds=['direct-game','direct-nws','direct-nws-forecast','direct-usgs','direct-nifc','direct-tennessee-road','direct-faa','direct-road-camera','direct-public-safety'];

export function buildLiveObservationCapture({gameId,generatedAt,reportUrl,capturedAt,panels}){
  if(!/^nfl:\d{6,12}$/.test(gameId||'')||!Number.isFinite(Date.parse(generatedAt))||!Number.isFinite(Date.parse(capturedAt))||Date.parse(capturedAt)<Date.parse(generatedAt)||!/^https?:\/\//.test(reportUrl||'')||!Array.isArray(panels)||panels.length!==livePanelIds.length)throw Error('Invalid browser observation capture');
  const entries=panels.map((panel,index)=>{
    if(panel?.id!==livePanelIds[index]||typeof panel.present!=='boolean'||typeof panel.text!=='string'||panel.text.length>6000||!Array.isArray(panel.links)||panel.links.length>20)throw Error('Invalid browser observation panel');
    const links=panel.links.map(link=>{
      if(typeof link?.label!=='string'||link.label.length>160||typeof link.url!=='string'||link.url.length>1200)throw Error('Invalid source link');
      const url=new URL(link.url);
      if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid source link');
      return {label:link.label,url:url.href};
    });
    return {id:panel.id,present:panel.present,displayText:panel.text,sourceLinks:links};
  });
  return {schema:'event-atlas.browser-observation-capture.v1',classification:'unreviewed_public_source_context',gameId,publishedReportGeneratedAt:generatedAt,capturedAt,reportUrl,interpretation:'This captures visible browser checks for this exact published report revision. Checks can be in progress, unavailable, or newer than the hourly Markdown. Displayed source text has not been independently verified. This is not an operational threat assessment, incident confirmation, VIP attendance record, or dissemination approval.',panels:entries};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-generated-at][data-game-id]');
  const button=document.querySelector('#capture-direct-observations');
  const status=document.querySelector('#capture-status');
  if(main&&button&&status)button.addEventListener('click',()=>{
    try{
      const panels=livePanelIds.map(id=>{
        const node=document.getElementById(id);
        if(!node)return {id,present:false,text:'',links:[]};
        return {id,present:true,text:node.innerText.slice(0,6000),links:[...node.querySelectorAll('a[href]')].slice(0,20).map(anchor=>({label:anchor.innerText.slice(0,160),url:anchor.href}))};
      });
      const capture=buildLiveObservationCapture({gameId:main.dataset.gameId,generatedAt:main.dataset.generatedAt,reportUrl:location.href,capturedAt:new Date().toISOString(),panels});
      const blob=new Blob([JSON.stringify(capture,null,2)+'\n'],{type:'application/json'});
      const href=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=href;anchor.download=`${main.dataset.gameId.replace(':','-')}-browser-observations.json`;
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(href),60000);
      status.textContent=`Browser observation capture prepared ${capture.capturedAt}. It is unreviewed and separate from the published Markdown.`;
    }catch{status.textContent='Could not capture the current browser observations. Use the linked publisher records and published report.';}
  });
}
