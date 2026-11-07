import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {loadEnvFile} from "node:process";
import {Hindsight} from "../lib/hindsight.ts";
import {buildInvestigationQuery,normalizeInvestigation} from "../lib/investigation.ts";
import {generatedInvestigation} from "../lib/validation.ts";

loadEnvFile(".dev.vars");
const mode=process.argv[2]||"calibration";
if(!["calibration","benchmark"].includes(mode))throw Error("Choose calibration or benchmark.");
const version=process.argv[3]||"v1";
if(!/^v\d+$/.test(version))throw Error("Use a version such as v1.");
const bank="recall-eval-20261107-v1";
if(bank===process.env.HINDSIGHT_BANK_ID||bank==="recall-incidents")throw Error("Evaluation must use an isolated bank.");
const config={HINDSIGHT_BASE_URL:process.env.HINDSIGHT_BASE_URL,HINDSIGHT_API_KEY:process.env.HINDSIGHT_API_KEY,HINDSIGHT_BANK_ID:bank};
const client=new Hindsight(config);
const root="evaluation/results";mkdirSync(root,{recursive:true});
const folder=`${root}/${mode}-${version}`;mkdirSync(folder,{recursive:true});
const hash=s=>createHash("sha256").update(s).digest("hex");
const inputsPath=`evaluation/${mode==="calibration"?"calibration":"inputs"}.json`;
const cases=JSON.parse(readFileSync(inputsPath,"utf8"));
const promptHash=hash(readFileSync("lib/investigation.ts"));
const manifestPath=`${folder}/manifest.json`;
const manifest={dataset:"Recall synthetic incident benchmark v1",mode,version,bank,sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),promptHash,clientHash:hash(readFileSync("lib/hindsight.ts")),inputHash:hash(readFileSync(inputsPath)),memoryHash:hash(readFileSync("evaluation/memories.json")),startedAt:new Date().toISOString(),count:cases.length,model:"Hindsight Cloud default; exact provider model not pinned",concurrency:2,answerKeySent:false};
if(existsSync(manifestPath)){const previous=JSON.parse(readFileSync(manifestPath,"utf8"));if(previous.promptHash!==promptHash||previous.inputHash!==manifest.inputHash||previous.clientHash!==manifest.clientHash)throw Error("Run fingerprints changed. Choose a new run version instead of mixing outputs.");manifest.startedAt=previous.startedAt;}
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");

if(!existsSync(`${root}/bank-ready.json`)){
  await client.request(`/v1/default/banks/${bank}`,{name:"Recall isolated accuracy evaluation"},"PUT");
  await client.retain("HIST-CATALOG-CORRECTED","Source version 1, 2026-10-10. Initial unconfirmed hypothesis: catalog cache may have memory exhaustion. This is preliminary and has not been verified.",{service:"catalog",incident_id:"HIST-CATALOG-CORRECTED",revision:"1"});
  const seeds=JSON.parse(readFileSync("evaluation/memories.json","utf8"));
  const retained=await client.request(`${client.bankPath}/memories`,{items:seeds.map(s=>({document_id:s.id,content:`SYNTHETIC HISTORICAL INCIDENT ${s.id}\nService ${s.service}; environment production.\n${s.text}`,metadata:{incident_id:s.id,service:s.service,environment:"production",revision:s.id==="HIST-CATALOG-CORRECTED"?"2":"1"},tags:["recall-incident",`service:${s.service}`]})),async:false});
  if(retained.success!==true||retained.async===true)throw Error("Historical memory processing was not confirmed.");
  writeFileSync(`${root}/bank-ready.json`,JSON.stringify({bank,seededAt:new Date().toISOString(),memoryHash:manifest.memoryHash,documents:seeds.length},null,2)+"\n");
  console.log(`Seeded ${seeds.length} isolated historical sources, including a corrected document.`);
}

let stop=false;
async function runCase(item,suffix=""){
  const path=`${folder}/${item.id}${suffix}.json`;
  if(existsSync(path)){console.log(`${item.id}${suffix}: reused persisted output`);return JSON.parse(readFileSync(path,"utf8"));}
  const query=buildInvestigationQuery(item.incident,item.events);
  const started=Date.now();
  const record={id:item.id,category:item.category,stage:suffix||"single",input:item.incident,events:item.events,queryHash:hash(query),promptHash,startedAt:new Date().toISOString()};
  try{
    const result=await new Hindsight(config).reflect(query);
    const parsed=generatedInvestigation.safeParse(result.structured_output);
    Object.assign(record,{success:true,durationMs:Date.now()-started,schemaValid:parsed.success,result,presented:normalizeInvestigation(result)});
    console.log(`${item.id}${suffix}: response in ${record.durationMs}ms; schema=${parsed.success}`);
  }catch(error){Object.assign(record,{success:false,durationMs:Date.now()-started,error:error instanceof Error?error.message:"Unknown provider failure"});console.log(`${item.id}${suffix}: FAILED (${record.error})`);if(/rate.limit|insufficient credits/i.test(record.error))stop=true;}
  writeFileSync(path,JSON.stringify(record,null,2)+"\n");
  return record;
}

const learning=mode==="benchmark"?cases.find(c=>c.id==="T30"):null;
if(learning){if(existsSync(`${root}/learning-added.json`)&&!existsSync(`${folder}/T30-before.json`))throw Error("This bank has already learned T30. Use a fresh bank for a new before/after experiment.");await runCase(learning,"-before");}
const queue=cases.filter(c=>!learning||c.id!==learning.id);let next=0;
await Promise.all(Array.from({length:2},async()=>{while(next<queue.length&&!stop){const item=queue[next++];await runCase(item);}}));
if(learning&&!stop){
  if(!existsSync(`${root}/learning-added.json`)){
    await client.retain("HIST-LEDGER-LEARNED","SYNTHETIC CONFIRMED HISTORICAL INCIDENT HIST-LEDGER-LEARNED. In the ledger production service, internal settlement code E7742 was confirmed to mean decimal-to-minor-unit serialization failed for currencies with fractional minor units. Updating to settlement serializer-v2 and encoding currency amounts as integer minor units restored batch processing. This diagnosis was verified by replaying the failed batch successfully. Generic worker restarts did not correct the serialization bug.",{service:"ledger",incident_id:"HIST-LEDGER-LEARNED",environment:"production",revision:"1"});
    writeFileSync(`${root}/learning-added.json`,JSON.stringify({bank,learnedAt:new Date().toISOString(),source:"HIST-LEDGER-LEARNED"},null,2)+"\n");
  }
  await runCase(learning,"-after");
}
const snapshot=await client.request(`${client.bankPath}/memories/list?limit=1000`);
writeFileSync(`${folder}/memory-snapshot.json`,JSON.stringify(snapshot,null,2)+"\n");
manifest.completedAt=new Date().toISOString();manifest.stoppedForQuota=stop;
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify({mode,folder,stoppedForQuota:stop,completedAt:manifest.completedAt}));
