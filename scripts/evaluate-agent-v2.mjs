import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {loadEnvFile} from "node:process";
import {Hindsight} from "../lib/hindsight.ts";
import {investigateIncident} from "../lib/investigation.ts";
import {generatedInvestigation} from "../lib/validation.ts";

loadEnvFile(".dev.vars");
const mode=process.argv[2],version=process.argv[3]||"v1";
if(!["regression","holdout"].includes(mode)||!/^v\d+$/.test(version))throw Error("Use regression|holdout and vN.");
const root="evaluation/v2",folder=`${root}/results/${mode}-${version}`;
mkdirSync(folder,{recursive:true});
const hash=s=>createHash("sha256").update(s).digest("hex");
const files=["lib/investigation.ts","lib/hindsight.ts","lib/validation.ts","scripts/evaluate-agent-v2.mjs",`${root}/${mode}.json`,`${root}/memories.json`,`${root}/learning.json`];
const fingerprints=Object.fromEntries(files.map(p=>[p,hash(readFileSync(p))]));
if(mode==="holdout"){
 const lock=JSON.parse(readFileSync(`${root}/lock.json`,"utf8"));
 for(const [p,h] of Object.entries(fingerprints))if(lock.fingerprints[p]!==h)throw Error(`Frozen holdout fingerprint changed: ${p}`);
}
const bank=`recall-eval-v2-${mode}-${version}`;
if([process.env.HINDSIGHT_BANK_ID,"recall-incidents"].includes(bank))throw Error("Use an isolated bank.");
const config={HINDSIGHT_BASE_URL:process.env.HINDSIGHT_BASE_URL,HINDSIGHT_API_KEY:process.env.HINDSIGHT_API_KEY,HINDSIGHT_BANK_ID:bank};
const client=new Hindsight(config);
const allInputs=JSON.parse(readFileSync(`${root}/${mode}.json`,"utf8"));
const selected=process.argv[4]?.split(",");
if(selected&&(mode!=="regression"||selected.some(id=>!allInputs.some(c=>c.id===id))))throw Error("Case selection is only allowed for named regression cases.");
const inputs=selected?allInputs.filter(c=>selected.includes(c.id)):allInputs;
const manifestPath=`${folder}/manifest.json`;
const manifest={dataset:"Recall synthetic v2",mode,version,bank,sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),fingerprints,count:inputs.length,selectedCaseIds:inputs.map(c=>c.id),startedAt:new Date().toISOString(),model:"Hindsight Cloud default; exact model not pinned",pipeline:"draft then evidence review; fail closed",concurrency:2,answerKeySent:false};
if(existsSync(manifestPath)){
 const previous=JSON.parse(readFileSync(manifestPath,"utf8"));
 if(JSON.stringify(previous.fingerprints)!==JSON.stringify(fingerprints)||JSON.stringify(previous.selectedCaseIds)!==JSON.stringify(manifest.selectedCaseIds))throw Error("Run fingerprints or selection changed; choose a new version.");
 manifest.startedAt=previous.startedAt;
}
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
const ready=`${folder}/bank-ready.json`;
if(!existsSync(ready)){
 await client.request(`/v1/default/banks/${bank}`,{name:`Recall v2 isolated ${mode}`},"PUT");
 const seeds=JSON.parse(readFileSync(`${root}/memories.json`,"utf8"));
 const r=await client.request(`${client.bankPath}/memories`,{items:seeds.map(s=>({document_id:s.id,content:`SYNTHETIC HISTORICAL INCIDENT ${s.id}\nService ${s.service}; environment production.\n${s.text}`,metadata:{incident_id:s.id,service:s.service,environment:"production"},tags:["recall-incident",`service:${s.service}`]})),async:false});
 if(r.success!==true||r.async===true)throw Error("Memory processing not confirmed.");
 writeFileSync(ready,JSON.stringify({bank,seededAt:new Date().toISOString(),sources:seeds.length})+"\n");
 console.log(`Seeded ${seeds.length} historical sources.`);
}
let stopped=false;
async function run(item,suffix=""){
 const path=`${folder}/${item.id}${suffix}.json`;
 if(existsSync(path)){console.log(`${item.id}${suffix}: reused persisted output`);return;}
 const record={id:item.id,category:item.category,input:item.incident,events:item.events,startedAt:new Date().toISOString()};const start=Date.now();
 try{
  const r=await investigateIncident(client,item.incident,item.events);
  Object.assign(record,{success:true,durationMs:Date.now()-start,schemaValid:generatedInvestigation.safeParse(r.result.structured_output).success,result:r.result,presented:{structured:r.structured,facts:r.facts,basedOn:r.basedOn},audit:r.audit});
  console.log(`${item.id}${suffix}: reviewed response in ${record.durationMs}ms`);
 }catch(e){record.success=false;record.durationMs=Date.now()-start;record.error=e.message;console.log(`${item.id}${suffix}: FAILED ${record.error}`);if(/rate.limit|insufficient credits|credits.*exhausted/i.test(e.message))stopped=true;}
 writeFileSync(path,JSON.stringify(record,null,2)+"\n");
}
const learning=inputs.find(c=>c.learning);
if(learning){if(existsSync(`${folder}/learning-added.json`)&&!existsSync(`${folder}/${learning.id}-before.json`))throw Error("Bank already learned; cannot reconstruct baseline.");await run(learning,"-before");}
const queue=inputs.filter(c=>!c.learning);let next=0;
await Promise.all(Array.from({length:2},async()=>{while(next<queue.length&&!stopped)await run(queue[next++]);}));
if(learning&&!stopped){
 if(!existsSync(`${folder}/learning-added.json`)){
  const learned=JSON.parse(readFileSync(`${root}/learning.json`,"utf8"));
  await client.retain(learned.id,learned.content,{incident_id:learned.id,service:learned.service,environment:"production"});
  writeFileSync(`${folder}/learning-added.json`,JSON.stringify({bank,learnedAt:new Date().toISOString(),source:learned.id})+"\n");
 }
 await run(learning,"-after");
}
writeFileSync(`${folder}/memory-snapshot.json`,JSON.stringify(await client.request(`${client.bankPath}/memories/list?limit=1000`),null,2)+"\n");
manifest.completedAt=new Date().toISOString();manifest.stoppedForQuota=stopped;writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({folder,completedAt:manifest.completedAt,stoppedForQuota:stopped}));
