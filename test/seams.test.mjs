import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FAA sporting-event polygons remain sourced and distinct from venue footprints',()=>{
  const feed=JSON.parse(fs.readFileSync('site/seams.json','utf8'));
  const schedule=JSON.parse(fs.readFileSync('site/nfl.json','utf8'));
  const games=new Map(schedule.games.map(game=>[game.id,game]));
  assert.match(feed.sourceUrl,/arcgis\/rest\/services\/SEAMS_Production_View\/FeatureServer\/0$/);
  assert.equal(feed.records,feed.matched+feed.unlinked);
  for(const [gameId,record] of Object.entries(feed.byGame)){
    const game=games.get(gameId);
    assert.ok(game);
    assert.equal(Date.parse(record.startAt),Date.parse(game.kickoff)-3600000);
    assert.ok(Date.parse(record.endAt)>Date.parse(record.startAt));
    assert.ok(record.ring.length>=24);
    assert.deepEqual(record.ring[0],record.ring.at(-1));
    assert.ok(record.objectId>0);
  }
});
