export const CHARGERS_THEMES_URL='https://www.chargers.com/news/game-themes-2026-sofi-stadium';

const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

export function parseChargersThemes(html,checkedAt=new Date().toISOString()){
  if(typeof html!=='string'||html.length>1_000_000||!Number.isFinite(Date.parse(checkedAt)))throw Error('Invalid Chargers themes response');
  const published=html.match(/"datePublished":"(2026-[^"\s]{10,35})"/)?.[1];
  const table=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].find(([,content])=>/Game Theme/.test(content)&&/Presenting Partner/.test(content))?.[1];
  const body=table?.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if(!Number.isFinite(Date.parse(published))||!body)throw Error('Chargers season theme table unavailable');
  const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(rows.length<5||rows.length>12)throw Error('Unexpected Chargers game theme count');
  const themes=rows.map(([,row])=>{
    const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match=>plain(match[1]));
    const game=cells[0]?.match(/^Week (\d{1,2}) vs\. ([A-Za-z0-9 ]+)$/);
    if(cells.length!==3||!game||!cells[1]||cells[1].length>100||cells[2].length>100)throw Error('Invalid Chargers theme row');
    return {week:Number(game[1]),opponent:game[2],theme:cells[1],presentingPartner:cells[2]||null};
  });
  if(new Set(themes.map(row=>row.week)).size!==themes.length)throw Error('Duplicate Chargers theme week');
  return {status:'ok',checkedAt:new Date(checkedAt).toISOString(),publishedAt:new Date(published).toISOString(),sourceUrl:CHARGERS_THEMES_URL,themes};
}

export function selectChargersTheme(game,snapshot,now=Date.now()){
  if(game?.venue?.id!=='7065'||game.teams?.find(team=>team.role==='home')?.name!=='Los Angeles Chargers')return {state:'outside_source_event'};
  const checked=Date.parse(snapshot?.checkedAt);
  if(snapshot?.status!=='ok'||snapshot.sourceUrl!==CHARGERS_THEMES_URL||!Array.isArray(snapshot.themes)||!Number.isFinite(checked)||checked>now+60000||now-checked>24*3600000)return {state:'unavailable',sourceUrl:CHARGERS_THEMES_URL};
  const opponent=game.teams?.find(team=>team.role==='away')?.name?.split(' ').at(-1);
  const entry=snapshot.themes.find(row=>row.week===game.week&&row.opponent===opponent);
  if(!entry)return {state:'no_exact_match',checkedAt:snapshot.checkedAt,sourceUrl:CHARGERS_THEMES_URL};
  return {state:'published_game_theme',checkedAt:snapshot.checkedAt,publishedAt:snapshot.publishedAt,sourceUrl:CHARGERS_THEMES_URL,...entry};
}
