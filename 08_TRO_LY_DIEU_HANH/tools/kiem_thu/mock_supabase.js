// Máy chủ GIẢ LẬP PostgREST/Supabase cho kiểm thử (bảng s1016_kv). Không phải Supabase thật.
const http=require('http');const rows=new Map();const PORT=+process.argv[2]||8799;
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');}
http.createServer((req,res)=>{cors(res);if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const u=new URL(req.url,'http://x');if(!u.pathname.startsWith('/rest/v1/s1016_kv')){res.writeHead(404);return res.end('{}');}
 if(req.headers['x-s1016-store']!=='secret123'){res.writeHead(401,{'Content-Type':'application/json'});return res.end('{"message":"RLS: sai mã cửa hàng"}');}
 let body='';req.on('data',c=>body+=c);req.on('end',()=>{
  const f={};for(const [k,v] of u.searchParams){if(['select','order','limit'].includes(k))continue;const m=v.match(/^(eq|gt)\.(.*)$/);if(m)f[k]=[m[1],m[2]];}
  const match=r=>Object.entries(f).every(([k,[op,v]])=>op==='eq'?String(r[k])===v:String(r[k])>v);
  if(req.method==='GET'){let out=[...rows.values()].filter(match).sort((a,b)=>a.updated_at<b.updated_at?-1:1);if(u.searchParams.get('limit'))out=out.slice(0,+u.searchParams.get('limit'));res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(out));}
  if(req.method==='POST'){const arr=JSON.parse(body);arr.forEach(r=>rows.set(r.k,r));res.writeHead(201,{'Content-Type':'application/json'});return res.end(JSON.stringify(arr));}
  if(req.method==='PATCH'){const p=JSON.parse(body);const hit=[...rows.values()].filter(match);hit.forEach(r=>{Object.assign(r,p);rows.set(r.k,r);});res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(hit));}
  res.writeHead(405);res.end();});
}).listen(PORT,()=>console.log('mock supabase on',PORT));
