import assert from "node:assert/strict";
import { createServer } from "node:http";
import { acquireHttpDocument, persistRawSnapshot } from "../../../src/v8/foundation/acquisition.ts";

const server=createServer((req,res)=>{if(req.url==="/start"){res.writeHead(302,{Location:"/document"});res.end();return;}res.writeHead(200,{"content-type":"application/pdf"});res.end("RAW-V8-DOCUMENT");});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
try{
 const port=server.address().port;
 const doc=await acquireHttpDocument(`http://127.0.0.1:${port}/start`);
 assert.equal(doc.status,200); assert.equal(doc.redirectChain.length,2); assert.equal(doc.mediaType,"application/pdf"); assert.equal(doc.byteLength,"RAW-V8-DOCUMENT".length); assert.match(doc.documentHash,/^[a-f0-9]{64}$/);
 const path=persistRawSnapshot(doc.bytes,doc.documentHash,".nexmold-test/raw"); assert.match(path,new RegExp(doc.documentHash+"$"));
 console.log("PASS V8 acquisition + raw snapshot");
}finally{server.close();}
