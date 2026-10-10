const allowedHosts=new Set(['www.packers.com','www.patriots.com','www.newyorkjets.com','www.seahawks.com','www.atlantafalcons.com','www.miamidolphins.com','www.neworleanssaints.com']);
const currentStates=new Set(['current_published_announcements','partial_published_announcements','current_published_plan','partial_published_plan']);
const validName=name=>typeof name==='string'&&name.length>1&&name.length<=80&&/^[\p{L}\p{M}][\p{L}\p{M}\p{N} .,'’\-]*$/u.test(name);
const validSource=url=>{try{const parsed=new URL(url);return parsed.protocol==='https:'&&allowedHosts.has(parsed.hostname)}catch{return false}};

export function selectAnnouncedPeople(game,contexts,now=Date.now()){
  if(!game?.id||!game?.venue?.id)return [];
  const sources=[
    ['Packers','nfl:401872990','3798',contexts?.packersReleaseContext],
    ['Patriots','nfl:401872986','3738',contexts?.patriotsPreviewContext],
    ['Jets','nfl:401872983','3839',contexts?.jetsGuideContext],
    ['Seahawks','nfl:401872992','3673',contexts?.seahawksGuideContext],
    ['Falcons','nfl:401872993','5348',contexts?.falconsGuideContext],
    ['Dolphins','nfl:401872982','3948',contexts?.dolphinsCrucialCatchContext],
    ['Saints','nfl:401872987','3493',contexts?.saintsGuideContext]
  ];
  const records=[],seen=new Set();
  for(const [publisher,eventId,venueId,context] of sources){
    if(game.id!==eventId||game.venue.id!==venueId)continue;
    const checked=Date.parse(context?.asOf);
    if(!currentStates.has(context?.state)||!Number.isFinite(checked)||checked>now+60000||now-checked>12*3600000||!Array.isArray(context.claims))continue;
    for(const claim of context.claims.slice(0,12)){
      if(!['announced_person','announced_people'].includes(claim?.category)||!Array.isArray(claim.names)||claim.names.length>2||!validSource(claim.sourceUrl)||typeof claim.summary!=='string'||claim.summary.length>300||!/^[a-f0-9]{64}$/.test(claim.sourceTextSha256||''))continue;
      const matchingSource=context.sources?.find(item=>item.sourceUrl===claim.sourceUrl&&item.state==='checked');
      if(Array.isArray(context.sources)&&!matchingSource)continue;
      for(const name of claim.names){
        if(!validName(name))continue;
        const key=`${game.id}:${publisher}:${claim.id}:${name}`;
        if(seen.has(key))continue;
        seen.add(key);
        const publishedAt=matchingSource?.publishedAt||context.publishedAt||null;
        records.push({eventId:game.id,venueId:game.venue.id,name,publisher,claimId:claim.id,announcedRole:claim.summary,sourceUrl:claim.sourceUrl,sourceTextSha256:claim.sourceTextSha256,sourceCheckedAt:context.asOf,sourcePublishedAt:Number.isFinite(Date.parse(publishedAt))?new Date(publishedAt).toISOString():null,sourcePublicationText:publisher==='Saints'?context.sourcePublicationText:null,attendanceStatus:'unverified',protectiveStatus:'not_assigned'});
      }
    }
  }
  return records.slice(0,24);
}
