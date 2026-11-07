import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { calculateQuote, products } from '../src/catalogue.js';
import type { BusinessProfile } from '@udyam/shared';

export const profile: BusinessProfile = {businessName:'Test Kirana',signatoryName:'Test Owner',city:'Delhi',state:'Delhi',address:'12 Market Road, Delhi 110001',cityTier:1,employees:2,counters:1,budget:2000,internet:'hotspot',fibreAvailable:true,needs:['billing'],hasGstin:false,language:'en'};
test('catalogue prices and dependencies are authoritative',()=>{
  assert.equal(products.length,25);
  const quote=calculateQuote(profile,[{productId:'P01',quantity:1},{productId:'P19',quantity:1}],1);
  assert.equal(quote.monthlyPaise,159800);
  assert.equal(quote.setupPaise,250000);
  assert.throws(()=>calculateQuote(profile,[{productId:'P23',quantity:1}],1),/requires/);
  assert.throws(()=>calculateQuote(profile,[{productId:'P15',quantity:1}],1,false,true),/GST/);
});
test('native sessions require credentials and cannot use web transport',async()=>{
  const store=openDatabase(':memory:');const {app}=await buildApp({store});
  assert.equal((await app.inject({method:'GET',url:'/api/v1/catalogue'})).statusCode,401);
  const response=await app.inject({method:'POST',url:'/api/v1/sessions',payload:{platform:'native'}});
  const {token}=response.json();
  assert.equal((await app.inject({method:'GET',url:'/api/v1/catalogue',headers:{authorization:`Bearer ${token}`}})).statusCode,200);
  assert.equal((await app.inject({method:'GET',url:'/api/v1/catalogue',headers:{cookie:`udyam_session=${token}`}})).statusCode,401);
  await app.close();store.sqlite.close();
});
