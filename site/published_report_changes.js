import {snapshotSofiPlans,diffSofiPlans} from './sofi_plan_changes.js';
import {snapshotDenverPlan,diffDenverPlan} from './denver_plan_changes.js';
import {diffEventPicture} from './event_picture_changes.js?v=20261010-41';
import {selectNflNews} from './nfl_news_context.js';
import {diffRoadRelationships,snapshotRoadRelationships} from './relationship_changes.js';
import {diffCalfireCounty,validCalfireContext} from './calfire_change_detection.js';

const schema='event-atlas.published-report-state.v9';
const validTime=value=>Number.isFinite(Date.parse(value));
const validRoadSnapshot=items=>Array.isArray(items)&&items.length<=25&&items.every(item=>typeof item?.recordId==='string'&&item.recordId.length<=120&&roadClasses.has(item.relationship)&&typeof item.claim==='string'&&item.claim.length<=300&&typeof item.sourceUrl==='string'&&item.sourceUrl.length<=1200&&/^https:\/\//.test(item.sourceUrl));
const roadClasses=new Set(['time_place_candidate','excluded_link']);
const validPrior=(prior,game,now)=>['event-atlas.published-report-state.v7','event-atlas.published-report-state.v8',schema].includes(prior?.schema)&&(!['event-atlas.published-report-state.v8',schema].includes(prior.schema)||validRoadSnapshot(prior.roadRelationships))&&(prior.schema!==schema||validCalfireContext(prior.calfireRegional))&&prior.eventId===game.id&&validTime(prior.generatedAt)&&Date.parse(prior.generatedAt)<=now&&now-Date.parse(prior.generatedAt)<=14*86400000&&prior.picture?.eventId===game.id&&Array.isArray(prior.picture.sources)&&prior.picture.sources.length<=50&&Array.isArray(prior.picture.cues)&&prior.picture.cues.length<=50&&Array.isArray(prior.news?.articles)&&prior.news.articles.length<=8&&Array.isArray(prior.changes)&&prior.changes.length<=30&&prior.changes.every(item=>typeof item?.kind==='string'&&item.kind.length<=40&&typeof item?.title==='string'&&item.title.length<=300&&typeof item?.detail==='string'&&item.detail.length<=1500&&(!item.sourceUrl||typeof item.sourceUrl==='string'&&item.sourceUrl.length<=1200))&&prior.game?.sourceUrl===game.sourceUrl;

export function retainPublishedChanges(current=[],prior=[]){
  const substantive=[],coverage=[],seenCoverage=new Set();
  for(const item of [...current,...prior]){
    if(item.kind!=='source_status_changed'){substantive.push(item);continue}
    const key=JSON.stringify([item.title,item.sourceUrl]);
    if(seenCoverage.has(key))continue;
    seenCoverage.add(key);
    coverage.push(item);
  }
  return [...substantive.slice(0,20),...coverage.slice(0,10)].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
}

export function buildPublishedReportState(bundle,game,newsSnapshot,prior=null,now=Date.now()){
  const news=selectNflNews(game,newsSnapshot,now);
  const roadRelationships=snapshotRoadRelationships(bundle.relationshipLedger);
  const calfireRegional=validCalfireContext(bundle.calfireRegional)?bundle.calfireRegional:null;
  const picture={eventId:game.id,sofiVenueEventContext:bundle.sofiVenueEvent,inglewoodAlertsContext:bundle.inglewoodAlerts,sources:bundle.picture.sources.slice(0,50),cues:bundle.picture.cues.slice(0,50),forecastContext:bundle.picture.forecastContext,gameArticle:bundle.picture.gameArticle,directGame:bundle.picture.directGame,citywideAlertsContext:bundle.picture.citywideAlertsContext,greenBayAlertContext:bundle.picture.greenBayAlertContext,lambeauPlanContext:bundle.picture.lambeauPlanContext,packersReleaseContext:bundle.picture.packersReleaseContext,patriotsPreviewContext:bundle.picture.patriotsPreviewContext,jetsGuideContext:bundle.picture.jetsGuideContext,seahawksGuideContext:bundle.picture.seahawksGuideContext,titansGuideContext:bundle.picture.titansGuideContext,cardinalsContext:bundle.picture.cardinalsContext,az511AlertContext:bundle.picture.az511AlertContext,houstonTranstarContext:bundle.picture.houstonTranstarContext,falconsGuideContext:bundle.picture.falconsGuideContext,commandersGuideContext:bundle.picture.commandersGuideContext,ramsBillsGuideContext:bundle.picture.ramsBillsGuideContext,saintsGuideContext:bundle.picture.saintsGuideContext,nolaReadyEventContext:bundle.picture.nolaReadyEventContext,nolaReadyActiveContext:bundle.picture.nolaReadyActiveContext,nolaReadyUpdatesContext:bundle.picture.nolaReadyUpdatesContext,nashvilleOemNewsContext:bundle.picture.nashvilleOemNewsContext,nashvilleTitansClosureContext:bundle.picture.nashvilleTitansClosureContext,wegoTitansAlertContext:bundle.picture.wegoTitansAlertContext,wegoTitansServiceContext:bundle.picture.wegoTitansServiceContext,nashvilleAccessComparison:bundle.picture.nashvilleAccessComparison,nolaReadyRegionalContext:bundle.picture.nolaReadyRegionalContext,saintsAccessComparison:bundle.picture.saintsAccessComparison,nortaAlertContext:bundle.picture.nortaAlertContext,nolaCallsContext:bundle.picture.nolaCallsContext,martaRailContext:bundle.picture.martaRailContext,martaAlertContext:bundle.picture.martaAlertContext,georgiaTrafficContext:bundle.picture.georgiaTrafficContext,soundTransitContext:bundle.picture.soundTransitContext,sounderAlertsContext:bundle.picture.sounderAlertsContext,seattleFireContext:bundle.picture.seattleFireContext,seattleSpdContext:bundle.picture.seattleSpdContext,njTransitRailContext:bundle.picture.njTransitRailContext,nj511Context:bundle.picture.nj511Context,naturalEventsContext:bundle.picture.naturalEventsContext,usgsContext:bundle.picture.usgsContext,wildfireContext:bundle.picture.wildfireContext,airQualityContext:bundle.picture.airQualityContext,smokeContext:bundle.picture.smokeContext,environmentalCorrelation:bundle.picture.environmentalCorrelation};
  const sofiPlans=snapshotSofiPlans(bundle);
  const denverPlan=snapshotDenverPlan(bundle.denverEventPlan,game,now);
  const comparable=validPrior(prior,game,now);
  const observedAt=new Date(now).toISOString();
  const changes=comparable?[...diffDenverPlan(prior.denverPlan,denverPlan,{...prior.game,id:game.id,venue:game.venue},game,observedAt),...diffSofiPlans(prior.sofiPlans,sofiPlans,observedAt),...diffEventPicture(prior.picture,picture,prior.news,news,prior.game,game,observedAt),...(['event-atlas.published-report-state.v8',schema].includes(prior.schema)?diffRoadRelationships(prior.roadRelationships,roadRelationships,prior.picture,picture,prior.game,game,observedAt):[]),...(prior.schema===schema?diffCalfireCounty(prior.calfireRegional,calfireRegional,observedAt):[])]:[];
  const history=comparable?retainPublishedChanges(changes,prior.changes):[];
  return {schema,eventId:game.id,generatedAt:observedAt,comparison:comparable?'previous published run':'baseline; no comparable previous run',picture,roadRelationships,calfireRegional,sofiPlans,denverPlan,news:{state:news.state,articles:news.matchupCandidates},game:{kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd,gameState:game.gameState??null,sourceRetrievedAt:game.sourceRetrievedAt,sourceUrl:game.sourceUrl},changes:history,newItems:changes.slice(0,30),newChangeCount:changes.length};
}
