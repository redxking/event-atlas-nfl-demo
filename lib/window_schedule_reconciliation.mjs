export function scheduleState(event){
 const raw=event?.status?.type||event?.competitions?.[0]?.status?.type||{};
 const name=String(raw.name||'UNKNOWN').slice(0,100),detail=String(raw.detail||raw.description||'Publisher status unavailable').slice(0,300);
 const category=/CANCEL/i.test(name)?'cancelled':/POSTPON/i.test(name)?'postponed':/SUSPEND/i.test(name)?'suspended':raw.completed===true?'completed':raw.state==='in'?'in_progress':/SCHEDULE|PRE/i.test(name)||raw.state==='pre'?'scheduled':'unknown';
 return {category,publisherName:name,publisherDetail:detail,completed:raw.completed===true};
}
export function reconcileWindowSchedule(allGames,scope){
 const start=Date.parse(scope.startsAt),end=Date.parse(scope.endsBefore);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Invalid schedule window');
 const ids=allGames.map(g=>g.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate season game IDs');
 const frozen=new Set(scope.frozenGameIds),inWindow=g=>Date.parse(g.kickoff)>=start&&Date.parse(g.kickoff)<end;
 const current=allGames.filter(inWindow),currentIds=new Set(current.map(g=>g.id));
 const entered=current.filter(g=>!frozen.has(g.id)).map(g=>g.id),left=[...frozen].filter(id=>!currentIds.has(id));
 const scoped=allGames.filter(g=>inWindow(g)||frozen.has(g.id));
 const kickoffChanged=scoped.filter(g=>scope.frozenKickoffs?.[g.id]&&Date.parse(scope.frozenKickoffs[g.id])!==Date.parse(g.kickoff)).map(g=>({id:g.id,frozenKickoff:scope.frozenKickoffs[g.id],currentKickoff:g.kickoff}));
 const crosswalkMismatch=scoped.filter(g=>g.usScheduleKickoff&&Date.parse(g.usScheduleKickoff)!==Date.parse(g.kickoff)).map(g=>g.id);
 const exceptions=scoped.filter(g=>['cancelled','postponed','suspended','unknown'].includes(g.scheduleStatus?.category)).map(g=>({id:g.id,kickoff:g.kickoff,status:g.scheduleStatus,insideCurrentWindow:inWindow(g)}));
 const missing=[...frozen].filter(id=>!ids.includes(id));
 const games=scoped.map(g=>({...g,windowMembership:inWindow(g)?'current_window':'frozen_game_moved_outside_window'})).sort((a,b)=>a.kickoff.localeCompare(b.kickoff)||a.id.localeCompare(b.id));
 return {games,reconciliation:{state:entered.length||left.length||kickoffChanged.length||crosswalkMismatch.length||exceptions.length||missing.length?'review_required':'matches_frozen_scope',entered,left,kickoffChanged,crosswalkMismatch,exceptions,missing,currentWindowCount:current.length,frozenScopeCount:frozen.size,retainedMovedGames:games.filter(g=>!inWindow(g)).map(g=>g.id)}};
}
