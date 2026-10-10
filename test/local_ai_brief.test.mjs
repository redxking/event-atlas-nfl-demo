import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalAiPacket,generateLocalAiDraft,validateLocalAiDraft} from '../lib/local_ai_brief.mjs';

const brief={event:{sourceId:'nfl'},sourceComparison:{status:'unchanged_since_intake'},nflContext:{status:'snapshot_available_unreviewed',scheduleSnapshotAt:'2026-10-09T12:00:00Z',evidence:{event:{id:'game-1',title:'Home at Away',kickoff:'2026-10-11T17:00:00Z',status:'scheduled',sourceUrl:'https://example.org/game'},venue:{name:'Example Stadium'},picture:{cues:[{type:'road condition',title:'Closure',basis:'Publisher window overlap',sourceUrl:'https://example.org/road'}],sources:[{name:'Road source',state:'checked',detail:'No route impact established',sourceUrl:'https://example.org/roads'}],gaps:['No verified stadium CCTV stream is connected.']}}},protectedPeople:[{displayName:'PRIVATE PERSON'}],reviewedAssessments:[{analysis:'PRIVATE ANALYSIS'}],case:{openingRationale:'PRIVATE RATIONALE'}};

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
  const article={publisher:'ESPN',matchBasis:'one_team_mentioned',title:'Bears game news',description:'Public sports context',url:'https://www.espn.com/nfl/story/_/id/1/example',publishedAt:'2026-10-09T16:00:00Z'};
  const withNews={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{nflHeadlines:{state:'current_snapshot',articles:[article,{...article,url:'https://unapproved.example/article'}]}}}}};
  const packet=buildLocalAiPacket(withNews);
  assert.equal(packet.evidence.find(item=>item.id==='N1')?.sourceUrl,article.url);
  assert.equal(packet.evidence.find(item=>item.id==='N2'),undefined);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE PERSON'));
});

test('local AI packet accepts only publisher-linked CBS fallback headlines',()=>{
  const cbs={publisher:'CBS Sports',matchBasis:'one_team_mentioned',title:'Bears news',description:'',url:'https://www.cbssports.com/nfl/news/example',publishedAt:'2026-10-09T16:00:00Z'};
  const withNews={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{nflHeadlines:{state:'current_snapshot',articles:[cbs]}}}}};
  assert.equal(buildLocalAiPacket(withNews).evidence.find(item=>item.id==='N1')?.sourceUrl,cbs.url);
});

test('local AI packet can cite exact-game ESPN article metadata without article body',()=>{
  const gameArticle={state:'current_snapshot',article:{type:'Preview',headline:'Bears at Packers preview',url:'https://www.espn.com/nfl/preview?gameId=401872990',modifiedAt:'2026-10-09T20:00:00Z',story:'PRIVATE BODY'}};
  const withArticle={...brief,nflContext:{...brief.nflContext,evidence:{...brief.nflContext.evidence,publicObservations:{gameArticle}}}};
  const packet=buildLocalAiPacket(withArticle);
  assert.equal(packet.evidence.find(item=>item.id==='A1')?.sourceUrl,gameArticle.article.url);
  assert.ok(!JSON.stringify(packet).includes('PRIVATE BODY'));
});

test('local model result must cite supplied evidence IDs',()=>{
  const packet=buildLocalAiPacket(brief);
  const draft={selectedEvidenceIds:['C1'],reviewQuestions:[{question:'Is the road condition relevant to event access?',evidenceIds:['C1']}]};
  assert.deepEqual(validateLocalAiDraft(draft,packet),{selectedEvidence:[packet.evidence[0]],reviewQuestions:draft.reviewQuestions,coverageGaps:[{text:'No verified stadium CCTV stream is connected.',evidenceId:'G1'}]});
  assert.throws(()=>validateLocalAiDraft({...draft,reviewQuestions:[{question:'Unknown source?',evidenceIds:['X1']}]},packet),/unknown/);
  assert.throws(()=>validateLocalAiDraft({...draft,selectedEvidenceIds:['X1']},packet),/unknown/);
  assert.throws(()=>validateLocalAiDraft({...draft,selectedEvidenceIds:['C1','C1']},packet),/duplicate/);
  assert.throws(()=>validateLocalAiDraft({...draft,reviewQuestions:[{question:'Unsupported question?',evidenceIds:[]}]},packet),/missing evidence/);
});

test('local Ollama request fixes model and endpoint without private fields',async()=>{
  const packet=buildLocalAiPacket(brief);
  let called=false;
  const result=await generateLocalAiDraft(packet,{fetchImpl:async(url,options)=>{called=true;assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(options.body);assert.equal(request.model,'qwen3.5:9b');assert.equal(request.stream,false);assert.equal(request.messages[1].content,JSON.stringify(packet));assert.ok(!options.body.includes('PRIVATE PERSON'));return {ok:true,json:async()=>({model:'qwen3.5:9b',done_reason:'stop',message:{content:JSON.stringify({selectedEvidenceIds:['C1'],reviewQuestions:[{question:'Verify publisher detail?',evidenceIds:['C1']}]})}})}}});
  assert.ok(called);
  assert.equal(result.status,'model_generated_unreviewed');
  assert.equal(result.schema,'event-atlas.local-ai-draft.v3');
  assert.deepEqual(result.draft.selectedEvidence,[packet.evidence[0]]);
  assert.equal(result.publicPacketSha256.length,64);
});
