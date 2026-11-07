import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { serverRoot } from '../src/config.js';
import { CONSENT_VERSION } from '@udyam/shared';

test('real OCR verifies generated fixtures and rejects stale address proof',{timeout:90000},async()=>{
  const store=openDatabase(':memory:');const {app}=await buildApp({store});
  try {
    const profile=JSON.parse(readFileSync(resolve(serverRoot,'tests/fixtures/demo-profile.json'),'utf8')).profile;
    const token=(await app.inject({method:'POST',url:'/api/v1/sessions',payload:{platform:'native'}})).json().token;
    const headers={authorization:`Bearer ${token}`};
    const request=(method:any,path:string,payload?:any)=>app.inject({method,url:`/api/v1${path}`,headers,payload});
    await request('PATCH','/profile',{profile,revision:0});
    const quote=(await request('POST','/quotes',{revision:1,selection:[{productId:'P01',quantity:1}]})).json();
    await request('POST',`/quotes/${quote.id}/accept`,{});
    await request('POST','/consents',{version:CONSENT_VERSION,accepted:true,language:'en'});
    async function waitForDocument(kind:string) {
      const deadline=Date.now()+45000;
      while (Date.now()<deadline) {
        const result=(await request('GET','/kyc')).json();
        const doc=result.documents.find((d:any)=>d.kind===kind);
        if (doc && doc.status!=='processing') return doc;
        await new Promise(resolve=>setTimeout(resolve,150));
      }
      throw new Error('OCR timed out');
    }
    for (const kind of ['gst','signatory']) {
      const response=await request('POST',`/demo/kyc/${kind}`,{});assert.equal(response.statusCode,202,response.body);
      const doc=await waitForDocument(kind);assert.equal(doc.status,'verified',JSON.stringify(doc));
    }
    await request('POST','/demo/kyc/address',{stale:true});
    const stale=await waitForDocument('address');assert.ok(stale.issues.includes('address_date'));
    await request('PATCH',`/kyc/documents/${stale.id}`,{fields:{billDate:'2026-06-26'}});
    assert.notEqual((await request('GET','/kyc')).json().status,'verified');
    await request('POST','/demo/kyc/address',{});
    const corrected=await waitForDocument('address');assert.equal(corrected.status,'verified',JSON.stringify(corrected));
    assert.equal((await request('GET','/kyc')).json().status,'verified');
  } finally {await app.close();store.sqlite.close();}
});
