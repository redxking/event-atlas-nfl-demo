export const nashvilleRoadClosuresIndex='https://www.nashville.gov/departments/transportation/road-closures';
const pdf=/^https:\/\/www\.nashville\.gov\/sites\/default\/files\/2026-10\/ROWConstructionRoadClosures-Weekof_101026-101726\.pdf\?ct=\d+$/;
const permitIds=['2026080985','2026081000','2026081007','2026081013','2026081031','2026081033','2026081036'];
const streets=['WOODLAND ST','S 1ST ST','RUSSELL ST','TITANS WAY','VICTORY AVE','S 1ST ST','CRUTCHER ST'];
const segments=['WOODLAND ST bet 3rd Ave N to S 5th St','S 1ST ST bet Woodland St to Russell St','RUSSELL ST bet S 1st St to Titans Way','TITANS WAY / RUSSELL ST - VICTORY LN','VICTORY AVE / TITANS WAY - 2ND AVE','S 1ST ST/ VICTORY LN - DAVIDSON ST','CRUTCHER ST/ S 2ND ST - S 5TH ST'];

export function selectNashvilleTitansClosures(game,snapshot,now=Date.now()){
  const empty={state:'outside_exact_game_scope',asOf:null,sourceUrl:nashvilleRoadClosuresIndex,entries:[]};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.id!=='nfl:401872984'||game?.venue?.id!=='3810'||game?.timeTbd||!Number.isFinite(kickoff)||kickoff<now-24*3600000||kickoff>now+7*86400000)return empty;
  const checkedAt=Date.parse(snapshot?.checkedAt);
  if(snapshot?.schema!=='event-atlas.nashville-titans-closures.v1'||snapshot.status!=='ok'||snapshot.gameId!==game.id||snapshot.eventDate!=='2026-10-11'||snapshot.sourceIndexUrl!==nashvilleRoadClosuresIndex||!pdf.test(snapshot.sourceUrl||'')||!Number.isFinite(checkedAt)||checkedAt>now+60000||now-checkedAt>2*3600000||snapshot.reportWindow!=='2026-10-10/2026-10-17'||!/^[a-f0-9]{64}$/.test(snapshot.documentSha256||'')||!Array.isArray(snapshot.entries)||snapshot.entries.length!==7)return {...empty,state:'stale_or_unavailable'};
  if(!snapshot.entries.every((item,i)=>item.permitNumber===permitIds[i]&&item.street===streets[i]&&item.publishedSegment===segments[i]&&item.date==='2026-10-11'&&item.plannedStartLocal==='08:00'&&item.plannedEndLocal==='17:00'&&item.sourceUrl===snapshot.sourceUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||'')))return {...empty,state:'stale_or_unavailable'};
  return {...empty,state:'current_published_plan',asOf:snapshot.checkedAt,sourceUrl:snapshot.sourceUrl,sourceIndexUrl:snapshot.sourceIndexUrl,documentSha256:snapshot.documentSha256,plannedStartAt:'2026-10-11T13:00:00Z',plannedEndAt:'2026-10-11T22:00:00Z',entries:snapshot.entries,interpretation:snapshot.interpretation};
}
