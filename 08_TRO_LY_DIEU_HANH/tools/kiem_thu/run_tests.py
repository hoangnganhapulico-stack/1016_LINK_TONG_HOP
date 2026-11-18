"""Kiểm thử 10 tình huống bắt buộc - chạy trên công cụ thật (bản đã gắn cầu nối) trong Chromium.
Ghi kết quả + bằng chứng vào report.json, ảnh chụp vào shots/."""
import json, os, time, subprocess, traceback
from playwright.sync_api import sync_playwright
from common import *
FX = '/home/claude/testenv/fx/'
os.makedirs('/home/claude/testenv/shots', exist_ok=True)
NOW = '2026-10-26T15:00:00+07:00'
A = BASE + '08_TRO_LY_DIEU_HANH/index.html'
R = []
def rec(no, name, ok, evidence, note=''):
    R.append({'no': no, 'name': name, 'result': 'ĐẠT' if ok is True else ('KHÔNG ĐẠT' if ok is False else ok), 'evidence': evidence, 'note': note})
    print(no, name, '=>', R[-1]['result'], json.dumps(evidence, ensure_ascii=False)[:400])
def ev(pg, js): return pg.evaluate(js)
def wait_sync(pg, sid, status='ok', t=8000):
    pg.wait_for_function("([s,st])=>S1016.sync[s]&&S1016.sync[s].status===st", arg=[sid, status], timeout=t)
def shot(pg, name): pg.screenshot(path=f'/home/claude/testenv/shots/{name}.png', full_page=True)

def push_total(pg, pid, emp=None):
    return ev(pg, """([pid,emp])=>{const pm=S1016.model.pushMerged('2026-10');let s=0;Object.values(pm.recs).forEach(r=>{if(r.pid===pid&&(!emp||r.emp===emp))s+=r.qty});return s}""", ) if False else pg.evaluate("""([pid,emp])=>{const pm=S1016.model.pushMerged('2026-10');let s=0;Object.values(pm.recs).forEach(r=>{if(r.pid===pid&&(!emp||r.emp===emp))s+=r.qty});return s}""", [pid, emp])

mock = subprocess.Popen(['node', '/home/claude/testenv/mock_supabase.js', '8799'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
time.sleep(0.8)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(accept_downloads=True); route(ctx, NOW)
    ast = ctx.new_page(); aerr = errs(ast)
    ast.goto(A); ast.wait_for_timeout(1200)
    ev(ast, "S1016.state.settings.user='Ngân (kiểm thử)';S1016.saveState()")
    shot(ast, '00_tro_ly_chua_co_du_lieu')

    # ---------- KT2: LỊCH CA ----------
    try:
        lich = ctx.new_page(); lerr = errs(lich)
        lich.goto(BASE + '01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html'); lich.wait_for_timeout(800)
        wait_sync(ast, 'LICH')
        n_builtin = ev(ast, "S1016.sync.LICH.read")
        lich.set_input_files('#scheduleFile', FX + '1016_Lich_lam_viec_T10_v1.csv'); lich.wait_for_timeout(1200)
        ast.wait_for_function("S1016.data.LICH&&S1016.data.LICH.fileName.indexOf('v1')>=0", timeout=8000)
        emp = 'EMP-' + 'VO-DANG-TU-QUYEN'
        before = ev(ast, f"S1016.data.LICH.shifts['SH:2026-10-26:{emp}'].raw")
        lich.set_input_files('#scheduleFile', FX + '1016_Lich_lam_viec_T10_v2.csv'); lich.wait_for_timeout(1200)
        ast.wait_for_function("S1016.data.LICH&&S1016.data.LICH.fileName.indexOf('v2')>=0", timeout=8000)
        after = ev(ast, f"S1016.data.LICH.shifts['SH:2026-10-26:{emp}'].raw")
        inday = ev(ast, f"S1016.model.shiftsOn('2026-10-26').filter(s=>s.emp==='{emp}').map(s=>s.raw)")
        logrow = ev(ast, f"S1016.log.filter(l=>l.source==='LICH'&&l.id==='SH:2026-10-26:{emp}').map(l=>[l.field,l.old,l.new,l.origin])")
        ev(ast, "S1016.ui.tab='cal';S1016.ui.calView='day';S1016.ui.date='2026-10-26';S1016.ui.render()"); ast.wait_for_timeout(300)
        dom = ast.inner_text('#m-cal')
        ok = before != after and inday == [after] and len(logrow) >= 1 and 'VÕ ĐẶNG TÚ QUYÊN' in dom and after in dom
        rec(2, 'Lịch ca: sửa ca ở công cụ Lịch → lịch tổng hợp + nhân sự trong ca', ok, {'ca_nhung_san_ban_dau': n_builtin, 'ca_truoc': before, 'ca_sau': after, 'danh_sach_ngay_26': inday, 'lich_su': logrow, 'loi_trang_nguon': [x for x in lerr if 'PAGEERROR' in x]})
        shot(ast, '02_lich_ngay_sau_khi_sua_ca')
    except Exception as e: rec(2, 'Lịch ca', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT3: CÔNG VIỆC ----------
    try:
        lich.fill('#datePicker', '2026-10-26'); lich.dispatch_event('#datePicker', 'change'); lich.wait_for_timeout(200)
        lich.fill('#newTaskTitle', 'KT3 - Kiểm tra kệ hàng khuyến mãi'); lich.click('#btnAddTask'); lich.wait_for_timeout(500)
        ast.wait_for_function("S1016.data.LICH_TASKS&&Object.values(S1016.data.LICH_TASKS.tasks).some(t=>t.title.indexOf('KT3')>=0)", timeout=8000)
        st0 = ev(ast, "S1016.model.taskStats(S1016.model.tasksOn('2026-10-26'))")
        t0 = ev(ast, "S1016.model.tasksOn('2026-10-26').filter(t=>t.title.indexOf('KT3')>=0).map(t=>[t.id,t.status,t.origin])[0]")
        lich.click('.task-row:has-text("KT3") [data-action=toggle]'); lich.wait_for_timeout(500)
        ast.wait_for_function("S1016.model.tasksOn('2026-10-26').some(t=>t.title.indexOf('KT3')>=0&&t.status==='done')", timeout=8000)
        st1 = ev(ast, "S1016.model.taskStats(S1016.model.tasksOn('2026-10-26'))")
        ev(ast, "S1016.ui.tab='ov';S1016.ui.render()"); ast.wait_for_timeout(300)
        ovtxt = ast.inner_text('#m-ov')
        ok = st1['total'] == st0['total'] and st1['done'] == st0['done'] + 1 and t0[1] == 'todo'
        rec(3, 'Công việc: tạo + hoàn thành ở công cụ Lịch → danh sách công việc + tổng quan', ok, {'cong_viec': t0, 'thong_ke_truoc': st0, 'thong_ke_sau': st1, 'tong_quan_hien': ('%d/%d' % (st1['done'], st1['total'])) in ovtxt})
        shot(ast, '03_tong_quan_sau_khi_hoan_thanh_viec')
    except Exception as e: rec(3, 'Công việc', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT1: PUSH SALE ----------
    try:
        tr = ctx.new_page(); terr = errs(tr)
        tr.goto(BASE + '04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_1810_AVATAR_450.html'); tr.wait_for_timeout(1500)
        tr.set_input_files('#excelFileInput', [FX + 'transaction_20261026_A.csv', FX + 'transaction_detail_20261026_A.csv']); tr.wait_for_timeout(2500)
        wait_sync(ast, 'PS_T10_AVATAR', 'ok', 10000)
        thu = 'EMP-NGUYEN-LE-MINH-THU'
        a1 = push_total(ast, 'SUATAM-AVATAR', thu); k1 = push_total(ast, 'KEMTAY-HATOMUGI'); s1 = push_total(ast, 'SON-MENTURM')
        src_at1 = ev(ast, "S1016.sync.PS_T10_AVATAR.sourceAt")
        tr.set_input_files('#excelFileInput', [FX + 'transaction_20261026_B.csv', FX + 'transaction_detail_20261026_B.csv']); tr.wait_for_timeout(2500)
        ast.wait_for_function("([e])=>{const pm=S1016.model.pushMerged('2026-10');return Object.values(pm.recs).filter(r=>r.pid==='SUATAM-AVATAR'&&r.emp===e).reduce((s,r)=>s+r.qty,0)>=5}", arg=[thu], timeout=10000)
        a2 = push_total(ast, 'SUATAM-AVATAR', thu)
        row = ev(ast, f"(()=>{{const pm=S1016.model.pushMerged('2026-10'),s=S1016.model.pushSummary(pm);const r=s.rows['{thu}'].p['SUATAM-AVATAR'];return [r.actual,r.target,Math.round(r.actual/r.target*1000)/10]}})()")
        src_at2 = ev(ast, "S1016.sync.PS_T10_AVATAR.sourceAt")
        ev(ast, "S1016.ui.tab='push';S1016.ui.pushScope='all';S1016.ui.render()"); ast.wait_for_timeout(300)
        dom = ast.inner_text('#m-push')
        ok = a1 == 3 and a2 == 5 and k1 == 2 and s1 == 1 and row[0] == 5 and 'Nguyễn Lê Minh Thư' in dom and src_at2 and src_at2 != src_at1
        rec(1, 'Push Sale: nhập POS ở tracker → Trợ lý phản ánh số mới', ok, {'avatar_MTHU_lan1': a1, 'avatar_MTHU_lan2': a2, 'kem_tay': k1, 'son': s1, 'MTHU_[TH,chi_tieu,%]': row, 'thoi_diem_luu_nguon': [src_at1, src_at2], 'loi_trang_nguon': [x for x in terr if 'PAGEERROR' in x]})
        shot(ast, '01_push_sale_sau_cap_nhat')
    except Exception as e: rec(1, 'Push Sale', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT4: SALE ----------
    try:
        ds = ctx.new_page(); derr = errs(ds)
        ds.goto(BASE + '03_DOANH_SO/DS_2026-10_Dashboard_Sale_Budget.html'); ds.wait_for_timeout(1500)
        ds.set_input_files('#fileInput', FX + 'transaction_detail_sale_A.csv'); ds.wait_for_timeout(3000)
        wait_sync(ast, 'SALE', 'ok', 10000)
        m1 = ev(ast, "(()=>{const s=S1016.model.sale('2026-10');return {rev:s.totals.revenue,d26:s.byDate.find(d=>d.iso==='2026-10-26').revenue,att:s.attainment&&s.attainment.attainmentPct,mtdT:s.attainment&&s.attainment.mtdTarget,budget:s.budgetSource}})()")
        ds.set_input_files('#fileInput', FX + 'transaction_detail_sale_B.csv'); ds.wait_for_timeout(3000)
        ast.wait_for_function("S1016.model.sale('2026-10').totals.revenue>%d" % m1['rev'], timeout=10000)
        m2 = ev(ast, "(()=>{const s=S1016.model.sale('2026-10');return {rev:s.totals.revenue,d26:s.byDate.find(d=>d.iso==='2026-10-26').revenue,att:s.attainment&&s.attainment.attainmentPct,mtdT:s.attainment&&s.attainment.mtdTarget}})()")
        expect1 = 3 * (1000000 + 1250000 + 1500000 + 1750000 + 2000000) - 1000000
        att_ok = m2['att'] is not None and abs(m2['att'] - round(m2['rev'] / m2['mtdT'] * 1000) / 10) < 0.11
        ev(ast, "S1016.ui.tab='sale';S1016.ui.render()"); ast.wait_for_timeout(300)
        ok = m1['rev'] == expect1 and m2['rev'] == expect1 + 5000000 and m2['d26'] == m1['d26'] + 5000000 and att_ok
        rec(4, 'Sale: nạp file bán hàng mới ở Dashboard Sale → tổng hợp + % hoàn thành', ok, {'lan1': m1, 'lan2': m2, 'doanh_so_ky_vong_lan1_(Sales-Return)': expect1, 'kiem_tra_%': att_ok})
        shot(ast, '04_doanh_so')
    except Exception as e: rec(4, 'Sale', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT5: KHO ----------
    try:
        oq = ctx.new_page(); oerr = errs(oq)
        oq.goto(BASE + '02_KHO_DAT_HANG/KHO_OrderIQ_Dat_Hang_Ton_Kho.html'); oq.wait_for_timeout(2000)
        oq.set_input_files('#fi-ton', FX + 'Inventory_20261026090000.csv'); oq.wait_for_timeout(3000)
        if oq.is_visible('#map-card'): oq.click('#map-card button:has-text("Xác nhận")'); oq.wait_for_timeout(2000)
        wait_sync(ast, 'KHO', 'ok', 15000)
        k1 = ev(ast, "(()=>{const k=S1016.model.kho();const it=k.items['INV:8931234500001'];return {counts:k.counts,item1:it?[it.stock,it.status,it.rec]:null}})()")
        oq.evaluate("fgBuild()"); oq.wait_for_timeout(1500)
        ast.wait_for_function("S1016.model.kho().forgot", timeout=8000)
        pid = ev(ast, "S1016.model.kho().forgot.pid")
        oq.evaluate(f"fgSet('{pid}','8931234500001','reason','NCC tạm hết hàng - KT5')"); oq.wait_for_timeout(1500)
        ast.wait_for_function("Object.values(S1016.model.kho().forgotRows).some(r=>r.reason.indexOf('KT5')>=0)", timeout=8000)
        oq.set_input_files('#fi-ton', FX + 'Inventory_20261026180000.csv'); oq.wait_for_timeout(3000)
        if oq.is_visible('#map-card'): oq.click('#map-card button:has-text("Xác nhận")'); oq.wait_for_timeout(2000)
        ast.wait_for_function("(()=>{const it=S1016.model.kho().items['INV:8931234500001'];return !it||it.stock===40})()", timeout=10000)
        k2 = ev(ast, "(()=>{const k=S1016.model.kho();const it=k.items['INV:8931234500001'];const f=Object.values(k.forgotRows).find(r=>r.bc==='8931234500001');return {counts:k.counts,item1:it?[it.stock,it.status,it.rec]:'không còn trong danh sách cần xử lý',forgot_reason:f&&f.reason}})()")
        ev(ast, "S1016.ui.tab='kho';S1016.ui.khoTab='forgot';S1016.ui.render()"); ast.wait_for_timeout(300)
        with ast.expect_download() as dl: ast.click('[data-act=kho-xlsx]')
        dl.value.save_as('/home/claude/testenv/shots/kho_export.xlsx')
        ok = k1['counts']['oos'] >= 1 and k1['item1'] and k1['item1'][0] == 0 and k2['forgot_reason'] and 'KT5' in k2['forgot_reason'] and k2['counts']['oos'] == k1['counts']['oos'] - 1
        rec(5, 'Kho: cập nhật tồn + lý do quên đặt ở OrderIQ → cảnh báo + danh sách cần xử lý', ok, {'lan1': k1, 'lan2': k2, 'loi_trang_nguon': [x for x in oerr if 'PAGEERROR' in x]})
        shot(ast, '05_kho_sku_quen_dat')
    except Exception as e: rec(5, 'Kho', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT10: LỊCH SỬ ----------
    try:
        h = ev(ast, "S1016.log.filter(l=>l.source==='PS_T10_AVATAR'&&l.field!=='(lần đầu)').map(l=>({at:l.at,origin:l.origin,id:l.id,field:l.field,new:l.new}))")
        h2 = ev(ast, "S1016.log.filter(l=>l.source==='KHO'&&l.field==='reason').map(l=>({at:l.at,id:l.id,new:l.new}))")
        ev(ast, "S1016.ui.tab='hist';S1016.ui.render()"); ast.wait_for_timeout(300); shot(ast, '10_lich_su')
        ok = any(x['id'] == 'PS:SUATAM-AVATAR:EMP-NGUYEN-LE-MINH-THU:2026-10-26' and x['field'] == '(mới)' and x['new']['qty'] == 2 for x in h) and len(h2) >= 1
        rec(10, 'Lịch sử: truy được nguồn + thời điểm thay đổi', ok, {'push_qty': h, 'kho_ly_do': h2})
    except Exception as e: rec(10, 'Lịch sử', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT8: NHẬT KÝ ----------
    try:
        ev(ast, "S1016.ui.tab='journal';S1016.ui.date='2026-10-26';S1016.ui.render()"); ast.wait_for_timeout(200)
        ast.click('[data-act=j-gen]'); ast.wait_for_timeout(300)
        draft_status = ev(ast, "S1016.state.journals['J:2026-10-26']?'đã lưu':'chưa lưu (bản nháp chỉ trên màn hình)'")
        ast.fill('#js_issues', 'KT8 - Máy POS 3 chập chờn, đã báo IT'); ast.dispatch_event('#js_issues', 'input')
        ast.click('[data-act=j-save]'); ast.wait_for_timeout(300)
        s_draft = ev(ast, "S1016.state.journals['J:2026-10-26'].status")
        ast.fill('#jWho', 'Dương Xuân Hoàng Ngân')
        ast.once('dialog', lambda d: d.accept()); ast.click('[data-act=j-confirm]'); ast.wait_for_timeout(400)
        ast.reload(); ast.wait_for_timeout(1500)
        j = ev(ast, "(()=>{const j=S1016.state.journals['J:2026-10-26'];return {status:j.status,by:j.confirmedBy,at:j.confirmedAt,created:j.createdAt,issues:j.sections.issues,push_in:j.sections.push.slice(0,120),sources:Object.keys(j.sources),metrics_keys:Object.keys(j.metrics)}})()")
        resave = ev(ast, "S1016.model.saveJournalDraft('2026-10-26',{},{metrics:{},sources:{}})")
        ev(ast, "S1016.ui.tab='journal';S1016.ui.render()"); ast.wait_for_timeout(200); shot(ast, '08_nhat_ky_da_xac_nhan')
        ok = draft_status.startswith('chưa') and s_draft == 'draft' and j['status'] == 'confirmed' and 'KT8' in j['issues'] and resave['ok'] is False
        rec(8, 'Nhật ký: bản nháp → sửa → xác nhận → lưu (không tự lưu chính thức)', ok, {'tao_nhap_khong_tu_luu': draft_status, 'sau_luu_nhap': s_draft, 'sau_xac_nhan_va_tai_lai': j, 'thu_ghi_de_ban_chinh_thuc': resave})
    except Exception as e: rec(8, 'Nhật ký', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT9: DEMO ----------
    try:
        real = ev(ast, "(()=>{const pm=S1016.model.pushMerged('2026-10');const s=S1016.model.pushSummary(pm);return {push:JSON.stringify(s.team),sale:S1016.model.sale('2026-10').totals.revenue,cache:localStorage.getItem('S1016_A_CACHE').length}})()")
        ev(ast, "S1016.demo.create();S1016.state.settings.demoMode=true;S1016.saveState();S1016.ui.tab='ov';S1016.ui.render()"); ast.wait_for_timeout(400)
        demo = ev(ast, "(()=>{const s=S1016.model.sale('2026-10');return {sale:s.totals.revenue,ribbon:getComputedStyle(document.querySelector('.demo-ribbon')).display,tag:document.querySelector('#m-ov').innerText.indexOf('DEMO')>=0,confirm:S1016.model.confirmJournal('2026-10-27','x').error}})()")
        shot(ast, '09_che_do_demo')
        ev(ast, "S1016.state.settings.demoMode=false;S1016.saveState();S1016.ui.render()"); ast.wait_for_timeout(300)
        real2 = ev(ast, "(()=>{const pm=S1016.model.pushMerged('2026-10');const s=S1016.model.pushSummary(pm);return {push:JSON.stringify(s.team),sale:S1016.model.sale('2026-10').totals.revenue,cache:localStorage.getItem('S1016_A_CACHE').length,demoInCache:localStorage.getItem('S1016_A_CACHE').indexOf('DEMO')>=0}})()")
        ev(ast, "S1016.demo.purge()"); gone = ev(ast, "localStorage.getItem('S1016_A_DEMO')===null")
        real3 = ev(ast, "S1016.model.sale('2026-10').totals.revenue")
        ok = real['push'] == real2['push'] and real['sale'] == real2['sale'] == real3 and demo['sale'] != real['sale'] and demo['ribbon'] == 'block' and not real2['demoInCache'] and gone and bool(demo['confirm'])
        rec(9, 'Dữ liệu DEMO không cộng vào báo cáo thật', ok, {'that_truoc': real, 'khi_bat_demo': demo, 'that_sau_khi_tat': real2, 'xoa_demo': gone, 'doanh_so_that_sau_xoa_demo': real3})
    except Exception as e: rec(9, 'DEMO', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT6: NHẬP TRÙNG (máy B) ----------
    try:
        tr.bring_to_front()
        with tr.expect_download() as dl: tr.click('#s1016-chip [data-s1016=pack]')
        pack = '/home/claude/testenv/shots/pack_tracker.json'; dl.value.save_as(pack)
        ctxB = br.new_context(); route(ctxB, NOW); b = ctxB.new_page(); berr = errs(b)
        b.goto(A); b.wait_for_timeout(1200)
        before = ev(b, "S1016.sync.PS_T10_AVATAR.status")
        b.set_input_files('#fileImport', pack); b.wait_for_timeout(1500)
        wait_sync(b, 'PS_T10_AVATAR', 'ok', 8000)
        t1 = push_total(b, 'SUATAM-AVATAR'); k1 = push_total(b, 'KEMTAY-HATOMUGI')
        b.set_input_files('#fileImport', pack); b.wait_for_timeout(1500)
        t2 = push_total(b, 'SUATAM-AVATAR'); k2 = push_total(b, 'KEMTAY-HATOMUGI')
        log = ev(b, "S1016.state.importLog.map(l=>[l.file,l.newKeys,l.sameKeys,l.duplicate])")
        mode = ev(b, "S1016.sync.PS_T10_AVATAR.mode")
        # nhập lại file POS cùng nội dung ở tracker (chế độ ghi đè) -> không cộng trùng ở Trợ lý
        ev(b, "S1016.ui.tab='src';S1016.ui.render()"); b.wait_for_timeout(200); shot(b, '06_may_B_nhap_goi_2_lan')
        ok = before == 'notConfigured' and t1 == t2 == 5 and k1 == k2 == 2 and log[0][1] == 0 and log[0][3] is True and mode == 'import'
        rec(6, 'Nhập trùng: nhập cùng 1 gói 2 lần → không cộng trùng', ok, {'truoc_khi_nhap': before, 'avatar_lan1_lan2': [t1, t2], 'kem_lan1_lan2': [k1, k2], 'nhat_ky_nhap_(file,moi,trung,file_da_nhap)': log, 'che_do': mode})
        ctxB.close()
    except Exception as e: rec(6, 'Nhập trùng', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- KT7: MẤT KẾT NỐI / SAI CẤU HÌNH ----------
    try:
        res = {}
        good = ev(ast, "localStorage.getItem('S1016_SNAP_KHO')")
        oq.evaluate("localStorage.setItem('S1016_SNAP_KHO','{hỏng')"); ast.wait_for_timeout(1200)
        wait_sync(ast, 'KHO', 'fail', 8000)
        res['kho_hong'] = ev(ast, "({status:S1016.sync.KHO.status,err:S1016.sync.KHO.lastError,stale:S1016.isStale('KHO'),staleFrom:S1016.sync.KHO.staleFrom})")
        ev(ast, "S1016.ui.tab='kho';S1016.ui.render()"); ast.wait_for_timeout(200)
        res['canh_bao_tren_man_hinh'] = 'Nguồn lỗi' in ast.inner_text('#m-kho')
        shot(ast, '07_kho_nguon_loi')
        ast.wait_for_timeout(2600); res['so_lan_thu_lai'] = ev(ast, "S1016.sync.KHO.retry")
        oq.evaluate("([v])=>localStorage.setItem('S1016_SNAP_KHO',v)", [good]); ast.wait_for_timeout(1200)
        wait_sync(ast, 'KHO', 'ok', 8000); res['sau_khi_khoi_phuc'] = ev(ast, "S1016.sync.KHO.status")
        # Đám mây: sai mã cửa hàng -> thất bại; đúng -> đẩy/kéo; tắt máy chủ -> thất bại
        r1 = ev(ast, "(async()=>{S1016.state.settings.cloud={url:'http://127.0.0.1:8799',key:'anon-test',storeKey:'SAI',enabled:true};return await S1016.cloud.test()})()")
        res['cloud_sai_ma'] = [r1, ev(ast, "S1016.cloud.status.status")]
        r2 = ev(ast, "(async()=>{S1016.state.settings.cloud.storeKey='secret123';const t=await S1016.cloud.test();const p=await S1016.cloud.push();return {t,p:{ok:p.ok,pushed:p.pushed,conflicts:p.conflicts}}})()")
        res['cloud_dung_cau_hinh'] = r2
        ctxC = br.new_context(); route(ctxC, NOW); c = ctxC.new_page(); c.goto(A); c.wait_for_timeout(1000)
        rc = ev(c, "(async()=>{S1016.state.settings.cloud={url:'http://127.0.0.1:8799',key:'anon-test',storeKey:'secret123',enabled:true};const r=await S1016.cloud.pull();const pm=S1016.model.pushMerged('2026-10');return {r,avatar:Object.values(pm.recs).filter(x=>x.pid==='SUATAM-AVATAR').reduce((s,x)=>s+x.qty,0),journal:(S1016.state.journals['J:2026-10-26']||{}).status,kho:S1016.sync.KHO.status}})()")
        res['may_C_keo_ve'] = rc
        ctxC.close()
        mock.terminate(); mock.wait(); time.sleep(0.3)
        r3 = ev(ast, "(async()=>{const t=await S1016.cloud.test();return [t,S1016.cloud.status.status]})()")
        res['cloud_may_chu_tat'] = r3
        r4 = ev(ast, "(async()=>{S1016.state.settings.cloud.url='http://127.0.0.1:1';return await S1016.cloud.push()})()")
        res['cloud_sai_url'] = {'ok': r4['ok'], 'errors': r4['errors'][:2]}
        ev(ast, "S1016.state.settings.cloud={url:'',key:'',storeKey:'',enabled:false};S1016.saveState()")
        ok = (res['kho_hong']['status'] == 'fail' and res['kho_hong']['stale'] and res['canh_bao_tren_man_hinh'] and res['sau_khi_khoi_phuc'] == 'ok'
              and not r1['ok'] and res['cloud_sai_ma'][1] == 'fail' and r2['t']['ok'] and r2['p']['ok'] and rc['r']['ok'] and rc['avatar'] == 5 and rc['journal'] == 'confirmed'
              and not r3[0]['ok'] and r3[1] == 'fail' and not r4['ok'])
        rec(7, 'Mất kết nối / sai cấu hình → báo lỗi, không giả vờ đã đồng bộ', ok, res, 'Đám mây kiểm thử với máy chủ GIẢ LẬP PostgREST (mock_supabase.js), chưa kiểm thử với dự án Supabase thật.')
    except Exception as e: rec(7, 'Mất kết nối', False, {'exception': traceback.format_exc()[-800:]})

    # ---------- BỔ SUNG: chạy bằng file:// (mở trực tiếp từ OneDrive) ----------
    try:
        ctxF = br.new_context(); route(ctxF, NOW)
        f1 = ctxF.new_page(); f1.goto('file:///home/claude/site/01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html'); f1.wait_for_timeout(800)
        f2 = ctxF.new_page(); f2.goto('file:///home/claude/site/08_TRO_LY_DIEU_HANH/index.html'); f2.wait_for_timeout(1500)
        stF = ev(f2, "({lich:S1016.sync.LICH.status,read:S1016.sync.LICH.read,ta:S1016.sync.TA.status})")
        rec('BS1', 'Mở bằng file:// trên Chromium (Chrome/Edge): Trợ lý đọc được công cụ Lịch', stF['lich'] == 'ok', stF, 'Chrome/Edge dùng chung bộ nhớ cho mọi file://; Safari tách riêng từng file → dùng bản GitHub Pages.')
        ctxF.close()
    except Exception as e: rec('BS1', 'file://', False, {'exception': traceback.format_exc()[-800:]})
    rec('BS2', 'Không có lỗi JavaScript ở Trợ lý trong suốt kiểm thử', not [x for x in aerr if 'PAGEERROR' in x], [x for x in aerr if 'PAGEERROR' in x][:5])
    br.close()
json.dump(R, open('/home/claude/testenv/report.json', 'w'), ensure_ascii=False, indent=1)
print('\nTỔNG:', sum(1 for r in R if r['result'] == 'ĐẠT'), '/', len(R), 'ĐẠT')
