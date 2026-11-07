import test from "node:test";
import assert from "node:assert/strict";
import {buildApp} from "../src/app.js";
import {openDatabase} from "../src/db.js";

test("staff sessions require password, origin, role and independent cookie",async()=>{
  const previous=process.env.STAFF_OPERATIONS_PASSWORD;
  process.env.STAFF_OPERATIONS_PASSWORD="test-operations-password";
  const store=openDatabase(":memory:");const {app}=await buildApp({store});
  try{
    assert.equal((await app.inject({url:"/api/v1/staff/auth/me"})).statusCode,401);
    const noOrigin=await app.inject({method:"POST",url:"/api/v1/staff/auth/login",payload:{username:"operations",password:"test-operations-password"}});assert.equal(noOrigin.statusCode,403);
    const login=await app.inject({method:"POST",url:"/api/v1/staff/auth/login",headers:{origin:"http://localhost:3001"},payload:{username:"operations",password:"test-operations-password"}});
    assert.equal(login.statusCode,200);assert.equal(login.json().role,"operations");
    const cookie=String(login.headers["set-cookie"]).split(";")[0];assert.ok(cookie.startsWith("udyam_staff="));
    assert.equal((await app.inject({url:"/api/v1/journey",headers:{cookie}})).statusCode,401);
    assert.equal((await app.inject({url:"/api/v1/staff/users",headers:{cookie}})).statusCode,200);
    const rows=store.sqlite.prepare("SELECT password_hash FROM staff_users").all() as {password_hash:string}[];assert.ok(rows.every(r=>!r.password_hash.includes("test-operations-password")));
    store.sqlite.prepare("UPDATE staff_sessions SET expires_at=0").run();assert.equal((await app.inject({url:"/api/v1/staff/auth/me",headers:{cookie}})).statusCode,401);
  }finally{await app.close();store.sqlite.close();if(previous===undefined)delete process.env.STAFF_OPERATIONS_PASSWORD;else process.env.STAFF_OPERATIONS_PASSWORD=previous;}
});
