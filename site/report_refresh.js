const reportPathPattern=/^reports\/nfl-\d+\.html$/;

export function newerReportRevision(index,reportPath,renderedAt){
  if(!reportPathPattern.test(reportPath)||index?.status!=='ok'||!Array.isArray(index.reports)||index.reports.length>300)return null;
  const current=Date.parse(renderedAt),published=Date.parse(index.builtAt);
  if(!Number.isFinite(current)||!Number.isFinite(published)||published>Date.now()+60000)return null;
  const matches=index.reports.filter(item=>item?.path===reportPath);
  if(matches.length!==1)return null;
  const next=Date.parse(matches[0].generatedAt);
  return Number.isFinite(next)&&next>current&&next<=published+60000?new Date(next).toISOString():null;
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-generated-at]');
  const status=document.querySelector('#revision-status');
  if(main&&status){
    const path=main.dataset.reportPath,renderedAt=main.dataset.generatedAt;
    const scrollKey=`event-atlas:report-scroll:${path}`;
    const attemptKey=`event-atlas:report-revision-attempt:${path}`;
    try{
      const saved=JSON.parse(sessionStorage.getItem(scrollKey)||'null');
      if(saved?.revision===renderedAt&&Number.isFinite(saved.y)){
        sessionStorage.removeItem(scrollKey);
        requestAnimationFrame(()=>scrollTo(0,saved.y));
      }
    }catch{}
    let pending=false;
    async function checkRevision(){
      if(pending||document.visibilityState!=='visible')return;
      pending=true;
      try{
        const response=await fetch(new URL('index.json',location.href),{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
        if(!response.ok)throw Error('Index unavailable');
        const raw=await response.text();
        if(raw.length>500000)throw Error('Index too large');
        const next=newerReportRevision(JSON.parse(raw),path,renderedAt);
        if(next){
          let recentAttempt=false;
          try{
            const attempt=JSON.parse(sessionStorage.getItem(attemptKey)||'null');
            recentAttempt=attempt?.revision===next&&Date.now()-attempt.at<300000;
          }catch{}
          if(recentAttempt){status.textContent='A newer publication is listed, but this page still has the older file. Checking again in five minutes.';return}
          status.textContent=`New published report generated ${next}; updating this page.`;
          try{
            sessionStorage.setItem(scrollKey,JSON.stringify({revision:next,y:scrollY}));
            sessionStorage.setItem(attemptKey,JSON.stringify({revision:next,at:Date.now()}));
          }catch{}
          const url=new URL(location.href);url.searchParams.set('revision',next);
          location.replace(url.href);
        }else status.textContent=`No newer published revision found at ${new Date().toLocaleTimeString()}. Source feeds may change between hourly publications.`;
      }catch{status.textContent='Could not check for a newer publication. This report may be outdated; confirm current records with the linked publishers.'}
      finally{pending=false}
    }
    setTimeout(checkRevision,2000);
    setInterval(checkRevision,300000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkRevision()});
  }
}
