import fs from 'fs';
const r=JSON.parse(fs.readFileSync('cmp-report.json'));
const out={};let md='# Changed verdicts — before (live b0496a909) vs after (fix/engine-gaps-15nov), C172, 390px Amethyst, same frozen /api data\n\n';
for(const [mode,v] of Object.entries(r.modes)){
  const B=new Map(v.before.cards.map(c=>[c.id,c])),A=new Map(v.after.cards.map(c=>[c.id,c]));
  const rows=[];
  for(const [id,a] of A){const b=B.get(id);if(!b)continue;if(b.s===a.s)continue;
    const rb=new Set(b.rules),ra=new Set(a.rules);
    const gone=[...rb].filter(x=>!ra.has(x)),added=[...ra].filter(x=>!rb.has(x));
    let reason=[];
    if(gone.includes('caution:POL-DA'))reason.push('DA caution removed (DA now info only)');
    if(added.some(x=>/TAF-EARLY/.test(x))||a.early)reason.push('early TAF used');
    if(b.src!==a.src)reason.push(`source ${b.src}->${a.src}`);
    if(!reason.length)reason.push('other: -'+gone.join(',')+' +'+added.join(','));
    rows.push({id,before:b.s,after:a.s,reason:reason.join('; '),gone,added,whyBefore:b.why,whyAfter:a.why});}
  out[mode]=rows;
  md+=`## ${mode} — ${rows.length} changed\n\n| Card | Before | After | Reason |\n|---|---|---|---|\n`+rows.map(x=>`| ${x.id} | ${x.before} | ${x.after} | ${x.reason} |`).join('\n')+'\n\n';
}
fs.writeFileSync('changed-cards.json',JSON.stringify(out,null,1));fs.writeFileSync('changed-cards.md',md);console.log(md);
