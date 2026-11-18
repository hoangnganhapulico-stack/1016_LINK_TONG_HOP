#!/usr/bin/env python3
"""Gắn cầu nối S1016 vào các công cụ nguồn (idempotent - chạy lại nhiều lần không bị trùng).

Cách dùng:
    python3 patch_bridges.py <thư mục 0.LINK TỔNG HỢP> [--check]

- Chỉ chèn thêm khối <!--S1016-BRIDGE-START--> ... <!--S1016-BRIDGE-END--> và các móc nối nhỏ
  có đánh dấu /*S1016-HOOK*/ ; không xóa hay sửa logic gốc.
- --check: chỉ báo cáo file nào thiếu điểm neo, không ghi.
"""
import os, re, sys, json

HERE = os.path.dirname(os.path.abspath(__file__))
BRIDGE = open(os.path.join(HERE, '..', 'bridge', 's1016-bridge.js'), encoding='utf8').read()

TARGETS = [
    # (đường dẫn tương đối, mã công cụ, tên hiển thị, loại móc nối)
    ('01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html', 'LICH', 'Lịch Làm Việc & Điều Phối Ca', 'lich'),
    ('01_VAN_HANH_TEAM/VH_Bang_Dieu_Khien_Team_Admin/index.html', 'TEAM_ADMIN', 'Bảng Điều Khiển Team Admin', 'team_admin'),
    ('02_KHO_DAT_HANG/KHO_OrderIQ_Dat_Hang_Ton_Kho.html', 'ORDERIQ', 'OrderIQ Đặt hàng & Tồn kho', 'orderiq'),
    ('03_DOANH_SO/DS_2026-10_Dashboard_Sale_Budget.html', 'SALE_T10', 'Dashboard Sale 1016 - Tháng 10', 'sale'),
    ('03_DOANH_SO/DS_2026-11_Dashboard_Sale_Budget.html', 'SALE_T11', 'Dashboard Sale 1016 - Tháng 11', 'sale'),
    ('04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_1810_AVATAR_450.html', 'PS_T10_AVATAR_1810', 'Push Sale T10 - Tracker Team 18/10', None),
    ('04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_1510_AVATAR_450.html', 'PS_T10_AVATAR_1510', 'Push Sale T10 - Tracker Team 15/10', None),
    ('04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_0210_ON_Body_800.html', 'PS_T10_ONBODY_0210', 'Push Sale T10 - Tracker Team 02/10 ON Body', None),
    ('04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Nhan_Vien.html', 'PS_T10_NHANVIEN', 'Push Sale T10 - Tracker Nhân viên', None),
    ('04_PUSH_SALE/2026-10/PUSH_SALE_THANG_10.html', 'PS_T10_THANG10', 'Push Sale T10 - bản PUSH_SALE_THANG_10', None),
    ('03_DOANH_SO/DS_Dashboard_Sale_1016_T10_2026-2025.html', 'SALE_T10_V2', 'Dashboard Sale 1016 T10 2026-2025', 'sale2'),
    ('04_PUSH_SALE/2026-09/PS_2026-09_GD1_Tracker_Team.html', 'PS_T9_GD1', 'Push Sale T9 GĐ1 - Tracker Team', None),
    ('04_PUSH_SALE/2026-09/PS_2026-09_GD2_Tracker_Team.html', 'PS_T9_GD2', 'Push Sale T9 GĐ2 - Tracker Team', None),
]

SALE_ANCHOR = 'buildPrintReport(agg, STATE.attainment);'
SALE_HOOK = r'''
    /*S1016-HOOK-SALE*/;(function(){try{
      if(!window.S1016Bridge||!agg||!agg.totals||!agg.totals.dateMax) return;
      var at=STATE.attainment, b=STATE.budget, bud={};
      if(b&&b.byDate) Object.keys(b.byDate).forEach(function(k){ bud[k]=Math.round(b.byDate[k].total||0); });
      var r=function(v){ return (typeof v==='number'&&isFinite(v))?Math.round(v):null; };
      var catT={}; if(at&&at.byCategory) at.byCategory.forEach(function(c){ catT[c.code]=c; });
      S1016Bridge.publish('SALE_'+agg.totals.dateMax.slice(0,7), {
        month: agg.totals.dateMax.slice(0,7), unit:'VND',
        revenueDef:'Doanh thu chưa thuế (Amount Tax excl.) = Sales - Return; các dòng khác bị loại (theo Dashboard Sale)',
        sourceFile: STATE.sourceFileName||'', budgetSource: STATE.budgetSourceFileName||'', budgetBuiltin: !!(b&&b.builtin),
        totals:{ revenue:r(agg.totals.revenue), revenueTaxIncl:r(agg.totals.revenueTaxIncl), slipCount:agg.totals.slipCount||0,
                 aov:r(agg.totals.aov), itemsPerSlip:agg.totals.itemsPerSlip||0, returnAmount:r(agg.totals.returnAmount),
                 dateMin:agg.totals.dateMin, dateMax:agg.totals.dateMax, daysCount:agg.totals.daysCount||0 },
        byDate: agg.byDate.map(function(d){ return {iso:d.iso, revenue:r(d.revenue), revenueTaxIncl:r(d.revenueTaxIncl), qty:d.qty, bills:d.slipCount}; }),
        byCategory: agg.byCategory.map(function(c){ var t=catT[c.code]||{}; return {code:c.code, name:c.name, revenue:r(c.revenue), mtdTarget:r(t.mtdTarget), monthTarget:r(t.monthTarget), attainmentPct:(typeof t.attainmentPct==='number')?Math.round(t.attainmentPct*10)/10:null}; }),
        attainment: at?{ mtdTarget:r(at.mtdTarget), mtdActual:r(at.mtdActual), attainmentPct:(at.attainmentPct==null?null:Math.round(at.attainmentPct*10)/10),
                         monthTarget:r(at.monthTarget), forecastTotal:r(at.forecastTotal), forecastPct:(at.forecastPct==null?null:Math.round(at.forecastPct*10)/10),
                         gapToTarget:r(at.gapToTarget), daysElapsed:at.daysElapsed, daysRemaining:at.daysRemaining, totalDaysInBudget:at.totalDaysInBudget }:null,
        budgetByDate: bud
      }, {rows: STATE.saleItems?STATE.saleItems.length:0});
    }catch(e){ if(window.console) console.warn('[S1016] publish sale lỗi', e); }})();
'''

TA_ANCHOR = 'function li(x){'
TA_HOOK = '/*S1016-HOOK-TA*/try{window.__S1016_TA={weekly:weekly,monthly:monthly};}catch(e){}\n  '
TA_TAIL = r'''<script id="s1016-hook-ta">/*S1016-HOOK-TA-PUBLISH*/
(function(){function go(){try{
  var T=window.__S1016_TA; if(!T||!window.S1016Bridge) return;
  var p=function(n){return n<10?'0'+n:''+n;}, now=new Date(), days={};
  var start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-14);
  for(var i=0;i<75;i++){ var d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
    var iso=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
    days[iso]=T.weekly(d).concat(T.monthly(d)).map(function(x){return [x[0],String(x[1]).replace(/<[^>]+>/g,''),x[2]];}); }
  var ks=Object.keys(days).sort();
  var procs={}; (window.__PROCS||[]).forEach(function(x){ procs[x.id]={g:x.g,n:x.n,t:String(x.t||'').replace(/<[^>]+>/g,''),r:x.r}; });
  S1016Bridge.publish('TA_TASKS',{from:ks[0],to:ks[ks.length-1],roles:{c:'Admin Chief',a:'Admin',s:'SC',all:'Toàn team'},procs:procs,days:days},{});
}catch(e){ if(window.console) console.warn('[S1016] publish Team Admin lỗi', e); }}
if(document.readyState==='complete') setTimeout(go,300); else window.addEventListener('load',function(){setTimeout(go,300);});})();
</script>'''

ORDERIQ_TAIL = r'''<script id="s1016-hook-orderiq">/*S1016-HOOK-ORDERIQ*/
(function(){
  if(typeof compute!=='function'||typeof msSave!=='function') return;
  var timer=null;
  function snap(){ try{
    if(!window.S1016Bridge||!skus||!skus.length) return;
    var stx=function(s){ try{return stText(s);}catch(e){return s.status;} };
    var cnt={total:skus.length,oos:0,low:0,ok:0,zombie:0,disc:0,cons:0,noorder:0,recPositive:0,onOrder:0};
    skus.forEach(function(s){ if(s.isDisc)cnt.disc++; else if(s.isCons)cnt.cons++; else if(s.isNoOrder)cnt.noorder++; else if(s.isZombie)cnt.zombie++; else if(cnt[s.status]!=null)cnt[s.status]++;
      if(s.rec_qty>0)cnt.recPositive++; if(s.on_order>0)cnt.onOrder++; });
    var act=skus.filter(function(s){ return !s.isCons&&!s.isDisc&&!s.isNoOrder&&s.orderable&&(s.status==='oos'||s.status==='low'||s.rec_qty>0||s.z_cls==='forgot'); })
      .sort(function(a,b){ return (a.days_left==null?1e9:a.days_left)-(b.days_left==null?1e9:b.days_left); }).slice(0,400)
      .map(function(s){ return {bc:s.barcode,name:s.name,cat:s.layer1,catName:(catName&&catName[s.layer1])||'',sup:s.supplier,supName:s.supplier_name,
        stock:s.close_qty,rate:Math.round((s.sales_day||0)*100)/100,daysLeft:(s.days_left==null||!isFinite(s.days_left))?null:Math.round(s.days_left*10)/10,
        lead:s.lead,onOrder:s.on_order||0,rec:s.rec_qty||0,status:s.status,statusText:stx(s),zombie:s.z_cls||'',abc:s.abc||''}; });
    var fg=null, pid=MS&&MS.forgot&&MS.forgot.order&&MS.forgot.order[0];
    if(pid&&MS.forgot.periods[pid]){ var P=MS.forgot.periods[pid];
      fg={pid:pid,ref:P.ref,month:P.month,created:P.created,rows:Object.values(P.rows).map(function(r){ var eff=r.status; try{eff=fgEff(r,P);}catch(e){}
        var po=[]; try{po=fgPoAfter(r,P).map(function(l){return l.po_no;});}catch(e){}
        return {bc:r.bc,name:r.name,cat:r.cat,sup:r.sup,supName:r.supName,owner:r.sup_person||'',stock:r.stock,rate:r.rate,onOrder:r.onOrder,rec:r.rec,detected:r.detected,
          types:(r.types||[]).map(function(t){return (typeof FG_TYPE!=='undefined'&&FG_TYPE[t])||t;}),status:eff,statusText:(typeof FG_ST!=='undefined'&&FG_ST[eff])||eff,
          reasonCode:r.reasonCode||'',reason:r.reason||'',note:r.note||'',by:r.by||'',at:r.at||'',poNew:po}; })}; }
    S1016Bridge.publish('KHO',{refDate:(typeof ymd==='function'&&refDate)?ymd(refDate):'',latestMonth:latestMonth||'',months:monthsLoaded||[],counts:cnt,actionItems:act,forgot:fg,
      user:(typeof whoAmI==='function'?whoAmI():''),statusLabels:{oos:'Hết hàng',low:'Sắp hết',ok:'Ổn định'}},{skus:skus.length});
  }catch(e){ if(window.console) console.warn('[S1016] publish OrderIQ lỗi',e); } }
  function later(){ clearTimeout(timer); timer=setTimeout(snap,800); }
  var _c=compute; compute=function(){ var r=_c.apply(this,arguments); later(); return r; };
  var _m=msSave; msSave=function(){ var r=_m.apply(this,arguments); later(); return r; };
  var tries=0, iv=setInterval(function(){ tries++; if(skus&&skus.length){ snap(); clearInterval(iv);} if(tries>30) clearInterval(iv); },2000);
})();
</script>'''

LICH_TAIL = r"""<script id="s1016-hook-lich">/*S1016-HOOK-LICH*/
(function(){
  if(typeof renderAll!=='function') return;
  function snap(){ try{
    if(!window.S1016Bridge||!scheduleData) return;
    S1016Bridge.publish('LICH',{fileName:(fileMeta&&fileMeta.name)||'',fileAt:(fileMeta&&fileMeta.updatedAt)||'',
      builtin:/nhúng/i.test((fileMeta&&fileMeta.name)||''),dates:scheduleData.dates||{},notes:scheduleData.notes||{},
      sheetsUsed:scheduleData.sheetsUsed||0,sheetCount:scheduleData.sheetCount||0},{});
  }catch(e){ if(window.console) console.warn('[S1016] publish Lịch lỗi',e); } }
  var _r=renderAll; renderAll=function(){ var r=_r.apply(this,arguments); snap(); return r; };
  snap();
})();
</script>"""

SALE2_TAIL = r"""<script id="s1016-hook-sale2">/*S1016-HOOK-SALE2*/
(function(){
  if(typeof UI==='undefined'||typeof CALC==='undefined'||typeof DB==='undefined'||!UI.render) return;
  var tm=null;
  function snap(){ try{
    if(!window.S1016Bridge) return;
    var R=CALC.runFull(); if(!R||!R.C) return;
    var C=R.C, b=R.budget||{}, fc=R.fc, r=function(v){ return (typeof v==='number'&&isFinite(v))?Math.round(v):null; };
    var days=R.days.filter(function(d){return d.inR;}).map(function(d){ return {iso:d.d, revenue:r(d.revx), revenueTaxIncl:r(d.rev), qty:d.qty, bills:d.bills, partial:!!d.partial}; });
    var bud={}; R.days.forEach(function(d){ if(d.bud!=null) bud[d.d]=r(d.bud); });
    var BM=(DB.data.budget&&DB.data.budget.months&&DB.data.budget.months[C.ym])||null;
    var cats=(R.cats||[]).map(function(o){ return {code:o.code, name:o.n, revenue:r(o.actx!=null?o.actx:o.rev), revenueTaxIncl:r(o.rev), mtdTarget:r(o.bud),
      monthTarget:(BM&&BM.month&&BM.month[o.code]!=null)?r(BM.month[o.code]*1000):null, attainmentPct:o.budAch!=null?Math.round(o.budAch*1000)/10:null, pyRevenue:r(o.pyRev)}; });
    var full=R.days.filter(function(d){return d.inR&&!d.partial;}).length, dim=R.days.length;
    var att=b.ok?{mtdTarget:r(b.full), mtdActual:r(b.act), attainmentPct:b.ach!=null?Math.round(b.ach*1000)/10:null, monthTarget:r(b.month),
      forecastTotal:fc?r(fc.revx):null, forecastPct:(fc&&fc.ach!=null)?Math.round(fc.ach*1000)/10:null, gapToTarget:(fc&&b.month!=null)?r(b.month-fc.revx):null,
      daysElapsed:full, daysRemaining:dim-full, totalDaysInBudget:dim, dateMax:b.lastFull}:null;
    var sm=DB.data.sales[C.ym]||{meta:{},rows:[]};
    S1016Bridge.publish('SALE_V2_'+C.ym,{month:C.ym, unit:'VND',
      revenueDef:'Doanh thu chưa thuế (Amount Tax excl.) theo Dashboard Sale T10 2026-2025: cộng mọi dòng POS (Return âm)'+((S.adj&&S.adj.lug)?', đã tách hàng ký gửi LUG':'')+'; % Budget tính trên các ngày đủ dữ liệu',
      sourceFile:sm.meta.file||'', budgetSource:(DB.data.budget&&DB.data.budget.meta&&DB.data.budget.meta.file)||'', budgetBuiltin:false,
      totals:{revenue:r(R.K.cur.revx), revenueTaxIncl:r(R.K.cur.rev), slipCount:R.K.cur.bills, aov:r(R.K.cur.basket), itemsPerSlip:R.K.cur.ipb, returnAmount:r(R.K.cur.ret),
        dateMin:C.first, dateMax:C.last, daysCount:days.length, partialLastDay:!!C.partial, pyRevenue:r(R.K.py.revx)},
      byDate:days, byCategory:cats, attainment:att, budgetByDate:bud},{rows:sm.rows.length});
  }catch(e){ if(window.console) console.warn('[S1016] publish Sale V2 lỗi',e); } }
  function later(){ clearTimeout(tm); tm=setTimeout(snap,600); }
  var _r=UI.render; UI.render=function(){ var x=_r.apply(this,arguments); later(); return x; };
})();
</script>"""

START, END = '<!--S1016-BRIDGE-START-->', '<!--S1016-BRIDGE-END-->'


def head_block(tid, name):
    cfg = json.dumps({'id': tid, 'name': name}, ensure_ascii=False)
    return f'{START}<script>window.S1016_BRIDGE_TOOL={cfg};</script><script id="s1016-bridge">\n{BRIDGE}\n</script>{END}'


def patch(text, tid, name, kind):
    notes = []
    # 1. bỏ khối cũ (nếu chạy lại)
    text = re.sub(r'(<meta charset="utf-8" data-s1016>)?' + re.escape(START) + r'.*?' + re.escape(END), '', text, flags=re.S)
    text = re.sub(r'\n?<script id="s1016-hook-(?:ta|orderiq|lich|sale2)">.*?</script>', '', text, flags=re.S)
    text = re.sub(r'\n?\s*/\*S1016-HOOK-SALE\*/.*?\}\)\(\);\n', '\n', text, flags=re.S)
    text = text.replace(TA_HOOK, '')
    # 2. chèn cầu nối sớm (trước mọi script của công cụ)
    blk = head_block(tid, name)
    mc = re.search(r'<meta[^>]*charset[^>]*>', text, flags=re.I)
    mh = re.search(r'<head[^>]*>', text[:4000], flags=re.I)
    if mc:      # sau thẻ charset để trình duyệt vẫn nhận UTF-8 trong 1024 byte đầu
        text = text[:mc.end()] + blk + text[mc.end():]
    elif mh:
        text = text[:mh.end()] + '<meta charset="utf-8" data-s1016>' + blk + text[mh.end():]
    else:       # file dạng artifact không có <head>: thêm charset + cầu nối ở đầu file
        text = '<meta charset="utf-8" data-s1016>' + blk + text
    # 3. móc nối riêng
    if kind == 'sale':
        if text.count(SALE_ANCHOR) != 1: notes.append('THIẾU/NHIỀU điểm neo Sale: %d' % text.count(SALE_ANCHOR))
        else: text = text.replace(SALE_ANCHOR, SALE_ANCHOR + SALE_HOOK, 1)
    if kind == 'team_admin':
        if text.count(TA_ANCHOR) != 1: notes.append('THIẾU/NHIỀU điểm neo Team Admin: %d' % text.count(TA_ANCHOR))
        else: text = text.replace(TA_ANCHOR, TA_HOOK + TA_ANCHOR, 1)
        text = append_tail(text, TA_TAIL)
    if kind == 'sale2':
        text = append_tail(text, SALE2_TAIL)
    if kind == 'lich':
        text = append_tail(text, LICH_TAIL)
    if kind == 'orderiq':
        text = append_tail(text, ORDERIQ_TAIL)
    return text, notes


def append_tail(text, tail):
    i = text.lower().rfind('</body>')
    return text[:i] + tail + '\n' + text[i:] if i >= 0 else text + '\n' + tail


def main():
    root = sys.argv[1]
    check = '--check' in sys.argv
    report = []
    for rel, tid, name, kind in TARGETS:
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            report.append({'file': rel, 'status': 'KHÔNG CÓ FILE'}); continue
        src = open(p, encoding='utf8').read()
        out, notes = patch(src, tid, name, kind)
        if not check and not notes:
            open(p, 'w', encoding='utf8').write(out)
        report.append({'file': rel, 'tool': tid, 'status': 'LỖI ĐIỂM NEO' if notes else ('OK (kiểm tra)' if check else 'ĐÃ GẮN'), 'notes': notes, 'bytes': len(out)})
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
