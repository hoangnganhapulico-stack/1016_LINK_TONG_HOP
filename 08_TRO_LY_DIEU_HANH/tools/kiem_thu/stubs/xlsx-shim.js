/* XLSX shim CHỈ DÙNG KIỂM THỬ: đọc CSV (chuỗi hoặc Uint8Array UTF-8) thành sheet dạng mảng 2 chiều. */
(function(){
function parseCSV(t){t=String(t).replace(/^﻿/,'');var rows=[],row=[],f='',q=false;for(var i=0;i<t.length;i++){var c=t[i];
 if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++;}else q=false;}else f+=c;}
 else if(c=='"')q=true;else if(c==','){row.push(f);f='';}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;row.push(f);rows.push(row);row=[];f='';}else f+=c;}
 if(f!==''||row.length){row.push(f);rows.push(row);}return rows;}
function conv(v,raw){if(v===''||v==null)return null;if(raw&&/^-?\d+(\.\d+)?$/.test(v))return Number(v);return v;}
window.XLSX={read:function(d,o){var txt=typeof d==='string'?d:new TextDecoder('utf-8').decode(d instanceof Uint8Array?d:new Uint8Array(d));return {SheetNames:['Sheet1'],Sheets:{Sheet1:{__aoa:parseCSV(txt)}}};},
 utils:{sheet_to_json:function(ws,o){o=o||{};var raw=o.raw!==false;var a=ws.__aoa.map(function(r){return r.map(function(v){return conv(v,raw);});});
   if(o.header===1)return a;var h=a[0]||[];return a.slice(1).map(function(r){var x={};h.forEach(function(k,i){x[k]=r[i]==null?(o.defval!==undefined?o.defval:undefined):r[i];});return x;});},
  book_new:function(){return {SheetNames:[],Sheets:{}};},aoa_to_sheet:function(a){return {__aoa:a};},json_to_sheet:function(j){return {__aoa:[]};},book_append_sheet:function(b,s,n){b.SheetNames.push(n);b.Sheets[n]=s;}},
 writeFile:function(){},version:'shim-test'};
})();
