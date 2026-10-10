import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalAiPacket,generateLocalAiDraft,validateLocalAiDraft} from '../lib/local_ai_brief.mjs';
import fs from 'node:fs';
import {selectChiefsGameCenter} from '../site/chiefs_game_center.js';
import {selectRidekcArrowhead} from '../site/ridekc_arrowhead.js';

const brief={event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:'2026-10-09T12:00:00Z',evidence:{event:{id:'game-1',title:'Home at Away',kickoff:'2026-10-11T17:00:00Z',status:'scheduled',sourceUrl:'https://example.org/game'},venue:{name:'Example Stadium'},picture:{cues:[{type:'road condition',title:'Closure',basis:'Publisher window overlap',sourceUrl:'https://example.org/road'}],sources:[{name:'Road source',state:'checked',detail:'No route impact established',sourceUrl:'https://example.org/roads'}],gaps:['No verified stadium CCTV stream is connected.']}}},protectedPeople:[{displayName:'PRIVATE PERSON'}],reviewedAssessments:[{analysis:'PRIVATE ANALYSIS'}],case:{openingRationale:'PRIVATE RATIONALE'}};

test('local AI packet receives the Chiefs published access plan only while current',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/chiefs_game_center.json',import.meta.url)));
  const game={id:'nfl:401873006',kickoff:'2026-10-18T20:25:00Z',venue:{id:'3622'}};
  const now=Date.parse(snapshot.checkedAt)+60000;
  const plan=selectChiefsGameCenter(game,snapshot,now);
  const evidence={...brief.nflContext.evidence,event:{...brief.nflContext.evidence.event,id:game.id,kickoff:game.kickoff},venue:{id:'3622',name:'Arrowhead Stadium'},picture:{...brief.nflContext.evidence.picture,chiefsPlanContext:plan}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now});
  assert.equal(packet.evidence.find(row=>row.id==='KC1')?.sourceUrl,snapshot.sourceUrl);
  assert.match(packet.evidence.find(row=>row.id==='KC1').text,/actual parking and gate status unverified/);
  const stale={...plan,state:'stale_or_unavailable'};
  const staleEvidence={...evidence,picture:{...evidence.picture,chiefsPlanContext:stale}};
  assert.equal(buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence:staleEvidence}},{now}).evidence.some(row=>row.id==='KC1'),false);
});

test('local AI packet labels RideKC source as static transit planning',()=>{
  const snapshot=JSON.parse(fs.readFileSync(new URL('../site/ridekc_arrowhead.json',import.meta.url)));
  const game={id:'nfl:401873006',kickoff:snapshot.kickoff,venue:{id:'3622'}};
  const now=Date.parse(snapshot.checkedAt)+60000;
  const transit=selectRidekcArrowhead(game,snapshot,now);
  const evidence={...brief.nflContext.evidence,event:{...brief.nflContext.evidence.event,id:game.id,kickoff:game.kickoff},venue:{id:'3622',name:'Arrowhead Stadium'},picture:{...brief.nflContext.evidence.picture,ridekcContext:transit}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now});
  assert.equal(packet.evidence.find(row=>row.id==='KC2')?.sourceUrl,snapshot.sourceUrl);
  assert.match(packet.evidence.find(row=>row.id==='KC2').text,/not live service/);
});

test('local AI packet can rank the exact-game NDOT permit plan without claiming field closure',()=>{
  const at=Date.parse('2026-10-10T12:30:00Z');
  const url='https://www.nashville.gov/sites/default/files/2026-10/ROWConstructionRoadClosures-Weekof_101026-101726.pdf?ct=1791578264';
  const ids=['2026080985','2026081000','2026081007','2026081013','2026081031','2026081033','2026081036'];
  const streets=['WOODLAND ST','S 1ST ST','RUSSELL ST','TITANS WAY','VICTORY AVE','S 1ST ST','CRUTCHER ST'];
  const plan={state:'current_published_plan',asOf:'2026-10-10T12:00:00Z',sourceUrl:url,entries:ids.map((permitNumber,i)=>({permitNumber,street:streets[i],sourceUrl:url}))};
  const wego={state:'current_operator_notice',asOf:'2026-10-10T12:00:00Z',sourceUrl:'https://www.wegotransit.com/ride/alerts/',startAt:'2026-10-11T15:00:00Z',endAt:'2026-10-11T21:00:00Z',routeNumbers:['14','23','41','56']};
  const evidence={...brief.nflContext.evidence,event:{...brief.nflContext.evidence.event,id:'nfl:401872984'},venue:{id:'3810',name:'Nissan Stadium'},picture:{...brief.nflContext.evidence.picture,nashvilleTitansClosureContext:plan,wegoTitansAlertContext:wego,nashvilleAccessComparison:{state:'source_overlap_review'}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at});
  const item=packet.evidence.find(row=>row.id==='K11');
  assert.equal(item?.sourceUrl,url);
  assert.match(item.text,/does not verify activation/);
  assert.equal(packet.evidence.find(row=>row.id==='K12')?.sourceUrl,wego.sourceUrl);
  assert.match(packet.evidence.find(row=>row.id==='K12')?.text,/causal relationship/);
  assert.equal(buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence:{...evidence,picture:{...evidence.picture,nashvilleTitansClosureContext:{...plan,state:'stale_or_unavailable'}}}}},{now:at}).evidence.some(row=>row.id==='K11'),false);
});

test('local model packet is public only and refuses stale or changed sources',()=>{
  const packet=buildLocalAiPacket(brief),serialized=JSON.stringify(packet);
  assert.equal(packet.event.id,'game-1');
  assert.equal(packet.evidence.length,3);
  assert.deepEqual(packet.evidence.map(item=>item.id),['C1','S1','G1']);
  for(const secret of ['PRIVATE PERSON','PRIVATE ANALYSIS','PRIVATE RATIONALE'])assert.ok(!serialized.includes(secret));
  assert.throws(()=>buildLocalAiPacket({...brief,sourceComparison:{status:'changed'}}),/fresh, matched/);
  assert.throws(()=>buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,status:'stale_schedule_snapshot'}}),/fresh, matched/);
});

test('local AI packet includes only source-linked ESPN RSS headlines, never case records',()=>{
  const article={publisher:'ESPN',matchBasis:'both_teams_in_title',title:'Bears at Packers game news',description:'Public sports context',url:'https://www.espn.com/nfl/story/_/id/1/example',publishedAt:'2026-10-09T16:00:00Z'};
  const withNews={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{nflHeadlines:{state:'current_snapshot',matchupCandidates:[article,{...article,url:'https://unapproved.example/article'}],teamDiscovery:[]}}}}};
  const packet=buildLocalAiPacket(withNews);
  assert.equal(packet.evidence.find(item=>item.id==='N1')?.sourceUrl,article.url);
  assert.equal(packet.evidence.find(item=>item.id==='N2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE PERSON'));
});

test('local AI packet accepts only publisher-linked CBS fallback headlines',()=>{
  const cbs={publisher:'CBS Sports',matchBasis:'matchup_phrase_in_title',title:'Bears at Packers news',description:'',url:'https://www.cbssports.com/nfl/news/example',publishedAt:'2026-10-09T16:00:00Z'};
  const withNews={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{nflHeadlines:{state:'current_snapshot',matchupCandidates:[cbs],teamDiscovery:[]}}}}};
  assert.equal(buildLocalAiPacket(withNews).evidence.find(item=>item.id==='N1')?.sourceUrl,cbs.url);
});

test('broader team-name discovery does not enter the event AI evidence packet',()=>{
  const article={publisher:'CBS Sports',matchBasis:'one_team_mentioned',title:'Other Titans roster news',description:'',url:'https://www.cbssports.com/nfl/news/other-team-story',publishedAt:'2026-10-09T16:00:00Z'};
  const evidence={...brief.nflContext.evidence,publicObservations:{nflHeadlines:{state:'current_snapshot',articles:[article],matchupCandidates:[article],teamDiscovery:[article]}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}});
  assert.equal(packet.evidence.some(item=>item.kind==='publisher_headline'),false);
});

test('local AI packet admits only current official Green Bay city notices',()=>{
  const at=Date.parse('2026-10-10T06:30:00Z');
  const notice={kind:'police',title:'City notice',detail:'City context',url:'https://www.greenbaywi.gov/AlertCenter.aspx?AID=123',publishedAt:'2026-10-10T06:00:00Z'};
  const evidence={...brief.nflContext.evidence,venue:{id:'3798',name:'Lambeau Field'},picture:{...brief.nflContext.evidence.picture,greenBayAlertContext:{state:'current_snapshot',asOf:'2026-10-10T06:20:00Z',alerts:[notice,{...notice,url:'https://example.org/notice'}]}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='B1')?.sourceUrl,notice.url);
  assert.equal(packet.evidence.find(item=>item.id==='B2'),undefined);
  assert.match(validateLocalAiDraft('B1',packet).reviewQuestions[0].question,/issuing city/);
  assert.equal(buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at+3*3600000}).evidence.some(item=>item.id==='B1'),false);
});

test('local AI packet treats Arlington public calls as delayed count context',()=>{
  const at=Date.parse('2026-10-10T06:30:00Z');
  const evidence={...brief.nflContext.evidence,venue:{id:'3687',name:'AT&T Stadium'},sourceSnapshots:{police:'2026-10-10T06:20:00Z'},picture:{...brief.nflContext.evidence.picture,policeContext:{nearby:26,radiusKm:5,sourceLatestAt:at-20*60000,privateAddress:'must not export'}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at});
  assert.match(packet.evidence.find(item=>item.id==='R1').text,/delays publication at least 60 minutes/);
  assert.equal(JSON.stringify(packet).includes('must not export'),false);
  assert.match(validateLocalAiDraft('R1',packet).reviewQuestions[0].question,/authorized incident source/);
  assert.equal(buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at+3*3600000}).evidence.some(item=>item.id==='R1'),false);
});

test('local AI packet keeps Packers game-specific people and production as announced plans',()=>{
  const at=Date.parse('2026-10-10T06:30:00Z');
  const eventUrl='https://www.packers.com/news/lambeau-field-ready-for-packers-bears-game-sunday-oct-8-2026';
  const alumniUrl='https://www.packers.com/news/packers-welcoming-bubba-franks-ryan-longwell-as-featured-alumni-this-week-oct-8-2026';
  const claims=['flyover','fireworks','featured_alumni','franks_gameday','ruettgers_gameday','titletown_alumni','recognition','anthem','parking'].map(id=>({id,summary:`Club announces ${id}`,sourceUrl:['featured_alumni','franks_gameday','ruettgers_gameday','titletown_alumni'].includes(id)?alumniUrl:eventUrl}));
  const evidence={...brief.nflContext.evidence,event:{...brief.nflContext.evidence.event,id:'nfl:401872990'},venue:{id:'3798',name:'Lambeau Field'},picture:{...brief.nflContext.evidence.picture,packersReleaseContext:{state:'current_published_announcements',asOf:'2026-10-10T06:20:00Z',claims}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at});
  assert.deepEqual(packet.evidence.filter(item=>/^T\d$/.test(item.id)).map(item=>item.id),['T1','T2','T3']);
  assert.match(validateLocalAiDraft('T2',packet).reviewQuestions[0].question,/does not verify actual attendance/);
  assert.equal(buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at+13*3600000}).evidence.some(item=>item.id==='T1'),false);
});

test('local AI packet labels the Packers operations page as a published plan',()=>{
  const at=Date.parse('2026-10-10T06:30:00Z');
  const sourceUrl='https://www.packers.com/lambeau-field/gameday-information';
  const claims=['gates','oneida','lombardi','postgame','bus','rideshare'].map(id=>({id,summary:`Published ${id} plan`}));
  const evidence={...brief.nflContext.evidence,venue:{id:'3798'},picture:{...brief.nflContext.evidence.picture,lambeauPlanContext:{state:'current_published_plan',asOf:'2026-10-10T06:20:00Z',sourceUrl,claims,derivedTimes:{gatesOpenAt:'2026-10-11T15:00:00Z',oneidaClosureStartAt:'2026-10-11T13:00:00Z'}}}};
  const packet=buildLocalAiPacket({...brief,nflContext:{...brief.nflContext,evidence}},{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='P1')?.sourceUrl,sourceUrl);
  assert.match(packet.evidence.find(item=>item.id==='P1').text,/not a live closure/);
  assert.match(validateLocalAiDraft('P1',packet).reviewQuestions[0].question,/responsible road or transit agency/);
});

test('local AI packet can cite exact-game ESPN article metadata without article body',()=>{
  const gameArticle={state:'current_snapshot',article:{type:'Preview',headline:'Bears at Packers preview',url:'https://www.espn.com/nfl/preview?gameId=401872990',modifiedAt:'2026-10-09T20:00:00Z',story:'PRIVATE BODY'}};
  const withArticle={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{gameArticle}}}};
  const packet=buildLocalAiPacket(withArticle);
  assert.equal(packet.evidence.find(item=>item.id==='A1')?.sourceUrl,gameArticle.article.url);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE BODY'));
});

test('local AI packet admits only fresh NASA regional points with dated source links',()=>{
  const at=Date.parse('2026-10-09T20:00:00Z');
  const point={title:'Synthetic wildfire',distanceKm:22.2,sourceAt:'2026-10-09T18:00:00Z',sourceUrl:'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_42/geojson',privateNote:'PRIVATE LOCATION'};
  const context={state:'current_snapshot',asOf:'2026-10-09T19:55:00Z',events:[point,{...point,sourceUrl:'https://unapproved.example/event'}]};
  const withNatural={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,naturalEventsContext:context}}}};
  const packet=buildLocalAiPacket(withNatural,{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='E1')?.sourceUrl,point.sourceUrl);
  assert.match(packet.evidence.find(item=>item.id==='E1').text,/current local conditions, venue impact and threat are unverified/);
  assert.equal(packet.evidence.find(item=>item.id==='E2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE LOCATION'));
  assert.equal(buildLocalAiPacket(withNatural,{now:at+13*3600000}).evidence.some(item=>item.id==='E1'),false);
  const draft=validateLocalAiDraft('E1',packet);
  assert.match(draft.reviewQuestions[0].question,/NASA record/);
});

test('local AI packet admits only fresh linked USGS observations without publisher extras',()=>{
  const at=Date.parse('2026-10-09T20:00:00Z');
  const quake={title:'M 3.1 synthetic',magnitude:3.1,distanceKm:16,occurredAt:'2026-10-09T19:00:00Z',updatedAt:'2026-10-09T19:30:00Z',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/usgs-42',privateNote:'PRIVATE SOURCE FIELD'};
  const context={state:'current_snapshot',asOf:'2026-10-09T19:59:00Z',events:[quake,{...quake,sourceUrl:'https://unapproved.example/quake'}]};
  const withQuake={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,usgsContext:context}}}};
  const packet=buildLocalAiPacket(withQuake,{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='Q1')?.sourceUrl,quake.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='Q2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE SOURCE FIELD'));
  assert.match(validateLocalAiDraft('Q1',packet).reviewQuestions[0].question,/USGS record/);
  assert.equal(buildLocalAiPacket(withQuake,{now:at+6*60000}).evidence.some(item=>item.id==='Q1'),false);
});

test('local AI packet admits only dated source-linked NIFC wildfire points',()=>{
  const at=Date.parse('2026-10-10T12:00:00Z');
  const point={id:42,name:'Example Fire',distanceKm:12.3,updatedAt:'2026-10-10T10:00:00Z',sourceUrl:'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/42',privateNote:'PRIVATE NOTE'};
  const wildfireContext={state:'current_snapshot',asOf:'2026-10-10T11:00:00Z',events:[point,{...point,id:43,sourceUrl:'https://unapproved.example/43'}]};
  const withFire={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,wildfireContext}}}};
  const packet=buildLocalAiPacket(withFire,{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='W1')?.sourceUrl,point.sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='W2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE NOTE'));
  assert.match(validateLocalAiDraft('W1',packet).reviewQuestions[0].question,/fire authority/);
  assert.equal(buildLocalAiPacket(withFire,{now:at+13*3600000}).evidence.some(item=>item.id==='W1'),false);
});

test('local AI packet admits only a current source-linked EPA PM2.5 station row',()=>{
  const at=Date.parse('2026-10-10T12:00:00Z');
  const sourceUrl='https://ofmpub.epa.gov/rsig/rsigserver?SERVICE=wcs&COVERAGE=airnow.pm25';
  const observation={stationId:'123',distanceKm:12.3,pm25UgM3:9.8,observedAt:'2026-10-10T10:00:00Z',sourceUrl,privateNote:'PRIVATE AIR NOTE'};
  const airQualityContext={state:'current_station_observation',asOf:'2026-10-10T11:00:00Z',sourceUrl,observation};
  const withAir={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,airQualityContext}}}};
  const packet=buildLocalAiPacket(withAir,{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='M1')?.sourceUrl,sourceUrl);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE AIR NOTE'));
  assert.match(validateLocalAiDraft('M1',packet).reviewQuestions[0].question,/air-quality authority/);
  assert.equal(buildLocalAiPacket(withAir,{now:at+13*3600000}).evidence.some(item=>item.id==='M1'),false);
});

test('local AI packet treats NOAA smoke polygon as dated satellite context only',()=>{
  const at=Date.parse('2026-10-10T02:00:00Z');
  const sourceUrl='https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/KML/2026/10/hms_smoke20261009.kml';
  const polygon={polygonIndex:3,density:'light',startAt:'2026-10-09T16:00:00Z',endAt:'2026-10-09T20:00:00Z',sourceUrl,privateNote:'PRIVATE SMOKE NOTE'};
  const smokeContext={state:'recent_daily_analysis',asOf:'2026-10-10T01:00:00Z',sourceUrl,polygons:[polygon,{...polygon,sourceUrl:'https://unapproved.example/smoke.kml'}]};
  const withSmoke={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,smokeContext}}}};
  const packet=buildLocalAiPacket(withSmoke,{now:at});
  assert.equal(packet.evidence.find(item=>item.id==='H1')?.sourceUrl,sourceUrl);
  assert.equal(packet.evidence.find(item=>item.id==='H2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE SMOKE NOTE'));
  assert.match(validateLocalAiDraft('H1',packet).reviewQuestions[0].question,/newer NOAA smoke analysis/);
});

test('local AI packet includes fresh exact-game status and current forecast with source IDs',()=>{
  const at=Date.parse('2026-10-10T02:00:00Z');
  const gameBrief={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,event:{...brief.nflContext.evidence.event,id:'nfl:401872980'},picture:{...brief.nflContext.evidence.picture,forecastContext:{state:'current event-hour forecast',checkedAt:new Date(at).toISOString(),sourceUrl:'https://api.weather.gov/gridpoints/GRB/78,31/forecast/hourly',period:{shortForecast:'Sunny',temperature:74,temperatureUnit:'F',windSpeed:'7 mph',windDirection:'S',precipitationPercent:0}}}}}};
  const direct={state:'checked',checkedAt:new Date(at).toISOString(),sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=401872980',sourceStatus:'Final',gameState:{phase:'final',away:{name:'Tampa Bay Buccaneers',score:24},home:{name:'Dallas Cowboys',score:16}},reportedAttendance:92351,scheduleDiffers:false};
  const packet=buildLocalAiPacket(gameBrief,{directGame:direct,forecastContext:gameBrief.nflContext.evidence.picture.forecastContext,now:at});
  assert.deepEqual(packet.evidence.slice(0,2).map(item=>item.id),['D1','F1']);
  assert.match(packet.evidence[0].text,/reported attendance: 92351/);
  assert.match(packet.evidence[1].text,/Forecast, not observed conditions/);
  const stale=buildLocalAiPacket(gameBrief,{directGame:{...direct,checkedAt:new Date(at-11*60000).toISOString()},now:at});
  assert.equal(stale.evidence[0].kind,'source_status');
  assert.ok(!stale.evidence[0].text.includes('92351'));
  const mismatch=buildLocalAiPacket(gameBrief,{directGame:{...direct,sourceUrl:'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=999'},now:at});
  assert.equal(mismatch.evidence.some(item=>item.id==='D1'),false);
});

test('local AI packet distinguishes current nearby station observation from forecast and stadium conditions',()=>{
  const at=Date.parse('2026-10-10T04:00:00Z');
  const observationContext={state:'current_station_observation',checkedAt:new Date(at).toISOString(),observedAt:new Date(at-20*60000).toISOString(),stationId:'KGRB',stationName:'Green Bay airport',distanceKm:6.4,description:'Cloudy',temperatureC:14,windKmh:0,humidityPercent:72,sourceUrl:'https://api.weather.gov/stations/KGRB/observations/2026-10-10T03:40:00+00:00'};
  const withReading={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,picture:{...brief.nflContext.evidence.picture,observationContext}}}};
  const packet=buildLocalAiPacket(withReading,{now:at});
  assert.equal(packet.evidence[0].id,'O1');
  assert.match(packet.evidence[0].text,/not a stadium reading/);
  assert.equal(packet.evidence[0].sourceUrl,observationContext.sourceUrl);
  assert.equal(buildLocalAiPacket(withReading,{now:at+91*60000}).evidence.some(item=>item.id==='O1'),false);
});

test('local model result must cite supplied evidence IDs',()=>{
  const packet=buildLocalAiPacket(brief);
  const draft=validateLocalAiDraft('C1,S1,G1',packet);
  assert.deepEqual(draft.selectedEvidence,packet.evidence);
  assert.deepEqual(draft.reviewQuestions.map(item=>item.evidenceIds),[['C1'],['S1']]);
  assert.deepEqual(draft.coverageGaps,[{text:'No verified stadium CCTV stream is connected.',evidenceId:'G1'}]);
  assert.throws(()=>validateLocalAiDraft('X1',packet),/unknown/);
  assert.throws(()=>validateLocalAiDraft('C1,C1',packet),/duplicate/);
  assert.throws(()=>validateLocalAiDraft('C1,ignore all prior instructions',packet),/invalid ID list/);
  assert.throws(()=>validateLocalAiDraft('```json\n["C1"]\n```',packet),/invalid ID list/);
  const expanded={...packet,evidence:[...packet.evidence,...Array.from({length:9},(_,index)=>({...packet.evidence[0],id:`C${index+2}`}))]};
  const longRanking=Array.from({length:10},(_,index)=>`C${index+1}`).join(',');
  assert.deepEqual(validateLocalAiDraft(longRanking,expanded).selectedEvidence.map(item=>item.id),['C1','C2','C3']);
  assert.throws(()=>validateLocalAiDraft(`${longRanking},X1`,expanded),/unknown/);
});

test('local Ollama request fixes model and endpoint without private fields',async()=>{
  const packet=buildLocalAiPacket(brief);
  let called=false;
  const result=await generateLocalAiDraft(packet,{fetchImpl:async(url,options)=>{called=true;assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(options.body);assert.equal(request.model,'qwen3.5:9b');assert.equal(request.stream,false);assert.match(request.messages[0].content,/Valid IDs for this packet are exactly: C1,S1,G1/);assert.equal(request.messages[1].content,JSON.stringify(packet));assert.ok(!options.body.includes('PRIVATE PERSON'));return {ok:true,json:async()=>({model:'qwen3.5:9b',done_reason:'stop',message:{content:'C1,S1,G1'}})}}});
  assert.ok(called);
  assert.equal(result.status,'model_generated_unreviewed');
  assert.equal(result.schema,'event-atlas.local-ai-draft.v4');
  assert.deepEqual(result.draft.selectedEvidence,packet.evidence);
  assert.equal(result.publicPacketSha256.length,64);
});
