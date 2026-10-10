import {diffEventPicture} from './event_picture_changes.js?v=20261010-17';
import {selectNflNews} from './nfl_news_context.js';

const schema='event-atlas.published-report-state.v5';
const validTime=value=>Number.isFinite(Date.parse(value));
const validPrior=(prior,game,now)=>prior?.schema===schema&&prior.eventId===game.id&&validTime(prior.generatedAt)&&Date.parse(prior.generatedAt)<=now&&now-Date.parse(prior.generatedAt)<=14*86400000&&prior.picture?.eventId===game.id&&Array.isArray(prior.picture.sources)&&prior.picture.sources.length<=50&&Array.isArray(prior.picture.cues)&&prior.picture.cues.length<=50&&Array.isArray(prior.news?.articles)&&prior.news.articles.length<=8&&Array.isArray(prior.changes)&&prior.changes.length<=30&&prior.changes.every(item=>typeof item?.kind==='string'&&item.kind.length<=40&&typeof item?.title==='string'&&item.title.length<=300&&typeof item?.detail==='string'&&item.detail.length<=1500&&(!item.sourceUrl||typeof item.sourceUrl==='string'&&item.sourceUrl.length<=1200))&&prior.game?.sourceUrl===game.sourceUrl;

export function buildPublishedReportState(bundle,game,newsSnapshot,prior=null,now=Date.now()){
  const news=selectNflNews(game,newsSnapshot,now);
  const picture={eventId:game.id,sources:bundle.picture.sources.slice(0,50),cues:bundle.picture.cues.slice(0,50),forecastContext:bundle.picture.forecastContext,gameArticle:bundle.picture.gameArticle,directGame:bundle.picture.directGame,citywideAlertsContext:bundle.picture.citywideAlertsContext,greenBayAlertContext:bundle.picture.greenBayAlertContext,lambeauPlanContext:bundle.picture.lambeauPlanContext,packersReleaseContext:bundle.picture.packersReleaseContext,njTransitRailContext:bundle.picture.njTransitRailContext,nj511Context:bundle.picture.nj511Context,naturalEventsContext:bundle.picture.naturalEventsContext,usgsContext:bundle.picture.usgsContext,wildfireContext:bundle.picture.wildfireContext,airQualityContext:bundle.picture.airQualityContext,smokeContext:bundle.picture.smokeContext,environmentalCorrelation:bundle.picture.environmentalCorrelation};
  const comparable=validPrior(prior,game,now);
  const changes=comparable?diffEventPicture(prior.picture,picture,prior.news,news,prior.game,game,new Date(now).toISOString()):[];
  const history=comparable?[...changes,...prior.changes].slice(0,30):[];
  return {schema,eventId:game.id,generatedAt:new Date(now).toISOString(),comparison:comparable?'previous published run':'baseline; no comparable previous run',picture,news:{state:news.state,articles:news.articles},game:{kickoff:game.kickoff,status:game.status,timeTbd:game.timeTbd,gameState:game.gameState??null,sourceRetrievedAt:game.sourceRetrievedAt,sourceUrl:game.sourceUrl},changes:history,newChangeCount:changes.length};
}
