import {randomBytes,createHash,scryptSync,timingSafeEqual} from "node:crypto";
import type {FastifyInstance,FastifyRequest} from "fastify";
import {z} from "zod";
import type {StaffUser} from "@udyam/shared";
import type {Store} from "./db.js";
import {DomainError} from "./catalogue.js";
declare module "fastify" {interface FastifyRequest {staff:StaffUser|null}}
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export function staffError(code:string,en:string,hi:string,status=403):never {throw new DomainError(code,hi,en,status)}
export function requireStaff(req:FastifyRequest,operations=false):StaffUser {
  if(!req.staff)staffError("staff_required","Sign in to the staff portal.","कर्मचारी पोर्टल में प्रवेश करें।",401);
  if(operations && req.staff.role!=="operations")staffError("staff_forbidden","Operations access is required.","ऑपरेशंस की अनुमति आवश्यक है।");
  return req.staff;
}
export function seedStaff(store:Store) {
  for(const [id,key,role] of [["operations","STAFF_OPERATIONS_PASSWORD","operations"],["partner-a","STAFF_PARTNER_A_PASSWORD","partner"],["partner-b","STAFF_PARTNER_B_PASSWORD","partner"]]) {
    const password=process.env[key];if(!password || password.length<12)continue;
    const old=store.sqlite.prepare("SELECT password_hash FROM staff_users WHERE id=?").get(id) as {password_hash:string}|undefined;
    if(old && checkPassword(password,old.password_hash))continue;
    const salt=randomBytes(16).toString("hex");const hash=`${salt}:${scryptSync(password,salt,64).toString("hex")}`;
    store.sqlite.prepare("INSERT INTO staff_users(id,username,role,password_hash) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash").run(id,id,role,hash);
    store.sqlite.prepare("DELETE FROM staff_sessions WHERE user_id=?").run(id);
  }
}
function checkPassword(password:string,stored:string){const [salt,hash]=stored.split(":");const value=scryptSync(password,salt,64);return hash.length===128 && timingSafeEqual(value,Buffer.from(hash,"hex"));}
export function registerStaffAuth(app:FastifyInstance,store:Store) {
  seedStaff(store);app.decorateRequest("staff",null);
  const attempts=new Map<string,{count:number;until:number}>();
  app.addHook("preHandler",async(req)=>{
    const path=req.url.split("?")[0];if(!path.startsWith("/api/v1/staff/") && !path.startsWith("/api/v1/demo/orders/"))return;
    if(!["GET","HEAD","OPTIONS"].includes(req.method)){
      const own=`${req.protocol}://${req.headers.host}`;
      if(!req.headers.origin || (req.headers.origin!==own && !(process.env.WEB_ORIGINS||"http://localhost:8081,http://localhost:3001").split(",").includes(req.headers.origin)))staffError("origin_required","An allowed browser origin is required.","अनुमत ब्राउज़र स्रोत आवश्यक है।");
    }
    if(req.method==="OPTIONS")return;
    const token=req.cookies.udyam_staff;
    if(token){const user=store.sqlite.prepare("SELECT u.id,u.username,u.role FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(digest(token),Date.now()) as StaffUser|undefined;req.staff=user||null;}
    if(path!=="/api/v1/staff/auth/login")requireStaff(req);
  });
  app.post("/api/v1/staff/auth/login",async(req,reply)=>{
    const {username,password}=z.object({username:z.string().max(80),password:z.string().max(200)}).parse(req.body);
    const now=Date.now();for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);
    const attempt=attempts.get(req.ip)||{count:0,until:now+60000};attempt.count++;attempts.set(req.ip,attempt);
    if(attempt.count>5)staffError("login_rate_limit","Too many attempts. Retry in one minute.","बहुत प्रयास हुए। एक मिनट बाद कोशिश करें।",429);
    const row=store.sqlite.prepare("SELECT * FROM staff_users WHERE username=?").get(username) as (StaffUser&{password_hash:string})|undefined;
    if(!row || !checkPassword(password,row.password_hash))staffError("invalid_login","Username or password is incorrect.","यूज़र नाम या पासवर्ड गलत है।",401);
    const token=randomBytes(32).toString("base64url");
    store.sqlite.prepare("DELETE FROM staff_sessions WHERE expires_at<=?").run(now);
    store.sqlite.prepare("INSERT INTO staff_sessions VALUES(?,?,?)").run(digest(token),row.id,now+8*3600000);
    reply.setCookie("udyam_staff",token,{httpOnly:true,sameSite:"lax",secure:req.protocol==="https",path:"/",maxAge:8*3600});
    return {id:row.id,username:row.username,role:row.role};
  });
  app.get("/api/v1/staff/auth/me",async req=>requireStaff(req));
  app.post("/api/v1/staff/auth/logout",async(req,reply)=>{store.sqlite.prepare("DELETE FROM staff_sessions WHERE token_hash=?").run(digest(req.cookies.udyam_staff||""));reply.clearCookie("udyam_staff",{path:"/"});return {ok:true};});
  app.get("/api/v1/staff/users",async req=>{requireStaff(req,true);return store.sqlite.prepare("SELECT id,username,role FROM staff_users ORDER BY username").all();});
}
