import assert from "node:assert/strict";
const base=process.env.RECALL_TEST_URL||"http://127.0.0.1:5173";
async function call(path,method="GET",body){const response=await fetch(`${base}/api/${path}`,{method,headers:{"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
const report={title:"TEST — local workflow verification",service:"verification-only",severity:"SEV3",environment:"development",description:"Synthetic integration test: database pool exhaustion while handling requests.",logs:"pool timeout; api_key=test-secret"};
const invalid=await call("incidents","POST",{title:""});assert.equal(invalid.status,400);
const created=await call("incidents","POST",report);assert.equal(created.status,201);const id=created.data.id;
let detail=await call(`incidents/${id}`);assert.equal(detail.data.incident.status,"open");assert.ok(!detail.data.incident.logs.includes("test-secret"));
const event=await call(`incidents/${id}/events`,"POST",{content:"Restart did not repair the connection leak.",kind:"attempt",outcome:"failed"});assert.equal(event.status,201);
detail=await call(`incidents/${id}`);assert.equal(detail.data.events.length,2);assert.equal(detail.data.incident.revision,2);
const conflict=await call(`incidents/${id}/resolve`,"POST",{cause:"Database connection pool exhausted.",fix:"Closed leaked database connections.",verification:"Connections and successful responses recovered.",revision:1});assert.equal(conflict.status,409);
const result=await call(`incidents/${id}/resolve`,"POST",{cause:"Database connection pool exhausted.",fix:"Closed leaked database connections.",verification:"Connections and successful responses recovered.",prevention:"Regression test for connection cleanup.",revision:2});assert.equal(result.status,201);
detail=await call(`incidents/${id}`);assert.equal(detail.data.incident.status,"resolved");assert.equal(detail.data.jobs[0].status,"pending");assert.equal(detail.data.events.length,3);
const repeated=await call(`incidents/${id}/resolve`,"POST",{cause:"Database connection pool exhausted.",fix:"Closed leaked database connections.",verification:"Successful responses recovered after the fix.",revision:3});assert.equal(repeated.status,409);
const list=await call("incidents");assert.ok(list.data.incidents.some(i=>i.id===id));
console.log(JSON.stringify({passed:true,incidentId:id,checks:["validation","persistence","redaction","timeline","revision conflict","atomic resolution and sync job","duplicate resolution rejection"],note:"Synthetic test record; no live Hindsight operation was performed."}));
