import assert from "node:assert/strict";

// Run against the built local Worker, not the development server, which
// deliberately permits anonymous loopback access. No Hindsight calls are made.
const base = new URL(process.env.RECALL_AUTH_TEST_URL || "http://127.0.0.1:8787");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("RECALL_AUTH_TEST_URL must be a local Worker origin.");
}

const workspace = await fetch(new URL("/workspace", base), { redirect: "manual" });
assert.ok([302, 303, 307, 308].includes(workspace.status), `Anonymous workspace should redirect, got ${workspace.status}. Use the built Worker, not the development server.`);
const destination = new URL(workspace.headers.get("location") || "", base);
assert.equal(destination.origin, base.origin);
assert.equal(destination.pathname, "/signin-with-chatgpt");
assert.equal(destination.searchParams.get("return_to"), "/workspace");

const api = await fetch(new URL("/api/incidents", base), { redirect: "manual" });
assert.equal(api.status, 401, `Anonymous incident API should reject access, got ${api.status}.`);
const write = await fetch(new URL("/api/incidents", base), {
  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", redirect: "manual",
});
assert.equal(write.status, 401, `Anonymous incident creation should reject access, got ${write.status}.`);
console.log("Passed: anonymous workspace redirects to sign-in; incident API reads and writes return 401.");
console.log("This checks the local Worker only; hosted sign-in and sign-out require a browser test.");
