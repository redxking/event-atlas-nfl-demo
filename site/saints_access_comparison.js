import {saintsGamedayUrl} from './saints_gameday.js';

const roadLayer='https://maps.dotd.la.gov/gdw/rest/services/Road_Closures/511_Road_Closures/FeatureServer/0';
const HOUR=3600000;
const validRoadSource=item=>{
  if(item?.sourceUrl===roadLayer)return true;
  try{
    const url=new URL(item.sourceUrl),id=/^ladotd-511-(\d+)$/.exec(item.id||'')?.[1];
    return !!id&&url.origin==='https://maps.dotd.la.gov'&&url.pathname==='/gdw/rest/services/Road_Closures/511_Road_Closures/FeatureServer/0/query'&&url.searchParams.get('where')===`EventID=${id}`&&url.searchParams.get('returnGeometry')==='false'&&url.searchParams.get('f')==='pjson';
  }catch{return false}
};

export function compareSaintsAccessPlan(game,guide,road){
  const empty={state:'unavailable',plannedWindow:null,matches:[],clubSourceUrl:saintsGamedayUrl,roadSourceUrl:roadLayer,interpretation:'The checked club plan and a current road-window screen are both required for comparison.'};
  const kickoff=Date.parse(game?.kickoff);
  if(game?.id!=='nfl:401872987'||game?.venue?.id!=='3493'||game?.timeTbd||!Number.isFinite(kickoff)||guide?.state!=='current_published_plan'||guide.sourceUrl!==saintsGamedayUrl||!guide.claims?.some(item=>item.id==='champions_square'&&item.sourceUrl===saintsGamedayUrl&&/^[a-f0-9]{64}$/.test(item.sourceTextSha256||''))||road?.timingState!=='matched'||!Array.isArray(road.records))return empty;
  const start=kickoff-3*HOUR,end=kickoff-45*60000;
  const matches=road.records.filter(item=>{
    const from=Date.parse(item?.startAt),through=Date.parse(item?.endAt);
    return /^ladotd-511-\d+$/.test(item?.id||'')&&validRoadSource(item)&&item.timed===true&&item.overlaps===true&&Number.isFinite(item.distanceKm)&&item.distanceKm>=0&&item.distanceKm<=10&&Number.isFinite(from)&&Number.isFinite(through)&&from<=end&&through>=start;
  }).slice(0,4).map(item=>({id:item.id,name:item.name,distanceKm:item.distanceKm,startAt:item.startAt,endAt:item.endAt,sourceRecordDate:item.sourceRecordDate||null,sourceUrl:item.sourceUrl}));
  return {state:matches.length?'review_candidates':'no_bounded_window_overlap',plannedWindow:{startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()},matches,clubSourceUrl:saintsGamedayUrl,roadSourceUrl:roadLayer,interpretation:'This compares published time windows at an unreviewed venue point. Distance and time overlap do not establish an actual access route, active road condition, crowd effect, stadium impact or threat. Confirm with DOTD and the venue transport lead.'};
}
