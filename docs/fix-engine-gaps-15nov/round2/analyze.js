const R=require("./cmp-report.json");const out={};const lines=[];
for(const [m,v] of Object.entries(R.modes)){const B=new Map(v.before.cards.map(c=>[c.id,c]));const ch=[];
 for(const a of v.after.cards){const b=B.get(a.id);if(!b||b.s===a.s)continue;
  const rb=new Set(b.rules),ra=new Set(a.rules);const add=[...ra].filter(x=>!rb.has(x)),rem=[...rb].filter(x=>!ra.has(x));
  let why="other";const t=add.concat(rem).join(" ");
  if(/runway headings unavailable/.test(b.why)&&!/runway headings unavailable/.test(a.why))why="real runway headings now (before: none, worst-case gust)";
  else if(/runway headings unavailable/.test(a.why)&&!/runway headings unavailable/.test(b.why))why="no DB heading now";
  else if(/POL-DA/.test(t))why="density altitude switch";
  else if(/XW|TW|VRB/.test(t))why="crosswind/tailwind on new headings";
  else if(/BORDERLINE/.test(t))why="model borderline on new headings";
  else if(/TAF/.test(t))why="TAF rule";
  ch.push({id:a.id,from:b.s,to:a.s,why,add,rem,whyBefore:b.why,whyAfter:a.why})}
 out[m]=ch;const tally={},wt={};ch.forEach(c=>{const k=c.from+"->"+c.to;tally[k]=(tally[k]||0)+1;wt[c.why]=(wt[c.why]||0)+1});
 const heliNoWx=v.after.cards.filter(c=>c.s==="heli"&&/No current weather/.test(c.why)).length;
 lines.push(m+": "+ch.length+" changed "+JSON.stringify(tally)+" by cause "+JSON.stringify(wt)+" heliNoWx "+heliNoWx)}
require("fs").writeFileSync("verdict-changes.json",JSON.stringify(out,null,1));console.log(lines.join("\n"));
const other=Object.values(out).flat().filter(c=>c.why==="other");console.log("other",other.length,JSON.stringify(other.slice(0,5)).slice(0,1800));
for(const k of Object.keys(R.status)){const rows=R.status[k];console.log(k,"max diff",Math.max(...rows.map(r=>r.diff)),"rows",rows.length)}
console.log("errs",JSON.stringify(Object.fromEntries(Object.entries(R.errs).map(([k,v])=>[k,v.length]))));
