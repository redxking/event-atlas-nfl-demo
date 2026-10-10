import {fetchSelectedGame} from './espn_game_summary.js';

const HOUR=3600000;

export function directGameEligible(context,now=Date.now()){
  const kickoff=Date.parse(context?.kickoff);
  return context?.monitoringMode==='near_term_monitoring'&&
    /^nfl:\d{6,12}$/.test(context?.gameId||'')&&
    /^\d{1,8}$/.test(String(context?.venueId||''))&&
    typeof context?.home==='string'&&context.home.length>0&&context.home.length<=100&&
    typeof context?.away==='string'&&context.away.length>0&&context.away.length<=100&&
    Number.isFinite(kickoff)&&kickoff-now<=7*24*HOUR&&now-kickoff<=24*HOUR;
}

export function directGameRecord(context){
  return {id:context.gameId,kickoff:context.kickoff,venue:{id:context.venueId},teams:[{role:'home',name:context.home},{role:'away',name:context.away}]};
}

if(typeof document!=='undefined'){
  const main=document.querySelector('main[data-report-path][data-monitoring-mode]');
  const panel=document.querySelector('#direct-game');
  if(main&&panel){
    const context={monitoringMode:main.dataset.monitoringMode,gameId:main.dataset.gameId,venueId:main.dataset.venueId,home:main.dataset.home,away:main.dataset.away,kickoff:main.dataset.kickoff};
    const add=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;panel.append(node);return node};
    const link=(url,label)=>{const p=add('p','');const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;p.append(a)};
    if(!directGameEligible(context))panel.closest('section')?.remove();
    else{
      let pending=false,lastCheck=0,active=false;
      async function check(){
        const now=Date.now(),minimum=active?55000:270000;
        if(pending||document.visibilityState!=='visible'||now-lastCheck<minimum)return;
        if(!directGameEligible(context,now)){panel.replaceChildren();add('p','Outside the direct game-check window; use the dated published report.');return}
        pending=true;lastCheck=now;panel.replaceChildren();add('p','Checking ESPN’s exact-game summary…');
        const result=await fetchSelectedGame(directGameRecord(context));
        panel.replaceChildren();active=result.gameState?.phase==='in progress';
        if(result.state==='checked'){
          add('p',`Exact-game publisher check ${result.checkedAt}. ESPN status: ${result.sourceStatus}.`);
          if(result.gameState)add('p',`${result.gameState.away.name} ${result.gameState.away.score}, ${result.gameState.home.name} ${result.gameState.home.score}${result.gameState.period?` · period ${result.gameState.period}`:''}${result.gameState.clock?` · publisher clock ${result.gameState.clock}`:''}.`);
          if(result.reportedAttendance!=null)add('p',`ESPN reported attendance after completion: ${result.reportedAttendance}. This does not verify any named person's presence.`);
          if(result.scheduleDiffers)add('p',`The direct publisher kickoff ${result.reportedKickoff||'not supplied'} differs from this report’s listed kickoff ${context.kickoff}. Confirm with the NFL or host club before event-window screening.`);
          if(result.article){add('p',`Game-linked ${result.article.type.toLowerCase()} headline: ${result.article.headline} (published ${result.article.publishedAt}; modified ${result.article.modifiedAt}).`);link(result.article.url,'ESPN game article ↗')}
          add('p','This browser check may be newer than the hourly report and is not saved in its Markdown. Publisher status, score and headline do not establish venue impact, VIP attendance or a threat.');
        }else add('p',`Direct game check ${result.state==='identity_mismatch'?'failed identity validation':'unavailable'}. The dated report below may be older; confirm the exact game with the publisher.`);
        link(result.sourceUrl,'ESPN exact-game summary ↗');pending=false;
      }
      setTimeout(check,1500);
      setInterval(check,60000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
    }
  }
}
