const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const inline=value=>{
  const source=String(value),linkPattern=/\[([^\]\r\n]{1,120})\]\((https:\/\/[^)\s]{1,1200})\)/g;
  let html='',start=0,match;
  while((match=linkPattern.exec(source))){
    if(match.index>0&&source[match.index-1]==='\\')continue;
    html+=esc(source.slice(start,match.index));
    try{
      const parsed=new URL(match[2]);
      html+=parsed.protocol==='https:'?`<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(match[1])} ↗</a>`:esc(match[0]);
    }catch{html+=esc(match[0])}
    start=linkPattern.lastIndex;
  }
  return (html+esc(source.slice(start))).replace(/\*\*([^*\r\n]{1,180})\*\*/g,'<strong>$1</strong>');
};

export function renderPublicReportHtml(markdown,{title,generatedAt,markdownPath}){
  if(typeof markdown!=='string'||markdown.length>500000||!/^nfl-\d+\.md$/.test(markdownPath))throw Error('Invalid published report');
  const body=markdown.split('\n').map(line=>{
    if(line.startsWith('## '))return `<h2>${inline(line.slice(3))}</h2>`;
    if(line.startsWith('# '))return `<h1>${inline(line.slice(2))}</h1>`;
    if(line.startsWith('- '))return `<p class="item">${inline(line.slice(2))}</p>`;
    return line?`<p>${inline(line)}</p>`:'';
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="author" content="Angelis Pseftis"><meta name="generator" content="Event Atlas automated public-source compilation"><title>${esc(title)}</title><style>body{margin:0;background:#07131c;color:#e8f1f3;font:16px/1.58 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:28px 22px 70px}header{border-bottom:1px solid #36505d;padding-bottom:20px;margin-bottom:28px}.eyebrow{color:#8cbdc7;text-transform:uppercase;letter-spacing:.1em;font-size:.76rem}h1{font-size:2rem;line-height:1.2}h2{font-size:1.25rem;margin-top:2.3rem;border-top:1px solid #36505d;padding-top:1rem}p{margin:.55rem 0}.item{padding-left:1.2rem;text-indent:-1.2rem}.item:before{content:'• ';color:#e5a15a}a{color:#8bd9ee;overflow-wrap:anywhere}strong{color:#fff}.note{color:#a9bdc5}time{font-variant-numeric:tabular-nums}</style></head><body><main><header><p class="eyebrow">Event Atlas / published public-source report</p><p class="note">Generated <time>${esc(generatedAt)}</time>. Unreviewed point-in-time compilation; source feeds update on different schedules. Confirm current source records before action.</p><p><a href="${esc(markdownPath)}">Download authoritative Markdown report ↗</a> · <a href="../">Return to NFL demo ↗</a></p></header>${body}</main></body></html>\n`;
}
