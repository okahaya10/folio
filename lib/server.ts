import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){const d=(env as any).DB as D1Database;if(!d)throw new Error('保存先に接続できません。しばらくして再度お試しください。');return d}
export function bucket(){return (env as any).BUCKET as R2Bucket}
export async function identity(){const u=await getChatGPTUser();if(!u)throw new Error('ログインが必要です');return u}
export async function tenant(id:string,user:string){const r=await db().prepare('SELECT t.*, m.role FROM tenants t JOIN members m ON m.tenant=t.id WHERE t.id=? AND m.user=?').bind(id,user).first<any>();if(!r)throw new Error('この会社へのアクセス権がありません');if(['suspended','closed'].includes(r.status))throw new Error('この会社は利用停止中です。運営者にお問い合わせください。');return r}
export function checkOrigin(r:Request){const o=r.headers.get('origin');if(o&&o!==new URL(r.url).origin)throw new Error('不正なリクエストです');if(r.headers.get('sec-fetch-site')==='cross-site')throw new Error('不正なリクエストです')}
export function fail(e:any){const msg=e instanceof Error?e.message:'処理に失敗しました';const known=!/SQLITE|D1_|R2_|binding|constraint|syntax/i.test(msg);return Response.json({error:known?msg:'処理を完了できませんでした。再度お試しください。'},{status:msg.includes('ログイン')?401:msg.includes('アクセス権')?403:400,headers:{'Cache-Control':'no-store'}})}
export const json=(v:any)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
