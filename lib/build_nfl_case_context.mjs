import {buildNflEvidenceBundle} from '../site/nfl_evidence_bundle.js';

const HOUR=3600000;

export function buildNflCaseContext(subject,currentEvent,snapshots={},now=Date.now()){
  if(subject?.sourceId!=='nfl')return null;
  const schedule=snapshots.schedule,game=schedule?.games?.find(item=>item.id===subject.id);
  if(!currentEvent||!game)return {status:'unavailable',reason:'NFL event is absent from the current local event source or public demo snapshot.',scheduleSnapshotAt:schedule?.builtAt||null,evidence:null};
  const mismatches=[];
  for(const [label,current,exported] of [['title',currentEvent.title,game.title],['kickoff',currentEvent.startsAtLocal,game.kickoff],['status',currentEvent.status,game.status],['source URL',currentEvent.sourceUrl,game.sourceUrl]])if(current!==exported)mismatches.push(label);
  if(mismatches.length)return {status:'source_mismatch',reason:`The current local event and public demo snapshot differ: ${mismatches.join(', ')}. Refresh and reconcile before using the demo context.`,scheduleSnapshotAt:schedule?.builtAt||null,evidence:null};
  const at=Date.parse(schedule.builtAt),fresh=Number.isFinite(at)&&at<=now+60000&&now-at<=12*HOUR;
  const policeSnapshot=game.venue.id==='3812'?snapshots.indianapolis:game.venue.id==='3628'?snapshots.charlotte:null;
  const policeAt=Date.parse(policeSnapshot?.builtAt);
  const police=policeSnapshot?.status==='ok'&&Number.isFinite(policeAt)&&policeAt<=now+60000&&now-policeAt<=12*HOUR&&policeSnapshot.byVenue?.[game.venue.id]?{state:'retrieved',sourceId:game.venue.id==='3812'?'indianapolis':'charlotte',checkedAt:policeAt,context:policeSnapshot.byVenue[game.venue.id]}:null;
  const transit=game.venue.id==='3738'?snapshots.transit:null;
  const transitSchedule=game.venue.id==='3738'?snapshots.transitSchedule:null;
  const transitPredictions=game.venue.id==='3738'?snapshots.transitPredictions:null;
  const evidence=buildNflEvidenceBundle(game,{schedule,ground:snapshots.ground,airspace:snapshots.airspace,tfr:snapshots.tfr,cameras:snapshots.cameras,roads:snapshots.roads,spc:snapshots.spc,wpcRain:snapshots.wpcRain,news:snapshots.news,ntas:snapshots.ntas,septa:snapshots.septa,police,transit,transitSchedule,transitPredictions},now);
  return {status:fresh?'snapshot_available_unreviewed':'stale_schedule_snapshot',scheduleSnapshotAt:schedule.builtAt||null,evidence};
}
