"""Kiểm thử bổ sung 28/10: các file chị cập nhật (Lịch mới, Dashboard Sale T10 2026-2025, tracker 18/10 mới) + link chỉ lấy GitHub."""
import json, re, traceback
from playwright.sync_api import sync_playwright
from common import *
FX = '/home/claude/testenv/fx/'
A = BASE + '08_TRO_LY_DIEU_HANH/index.html'
R = []
def rec(no, name, ok, ev):
    R.append({'no': no, 'name': name, 'result': 'ĐẠT' if ok else 'KHÔNG ĐẠT', 'evidence': ev}); print(no, name, '=>', R[-1]['result'], json.dumps(ev, ensure_ascii=False)[:500])
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(accept_downloads=True); route(ctx, '2026-10-28T16:00:00+07:00')
    ast = ctx.new_page(); aerr = errs(ast); ast.goto(A); ast.wait_for_timeout(1200)
    # V1: Lịch bản 27/10
    try:
        l = ctx.new_page(); le = errs(l); l.goto(BASE + '01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html'); l.wait_for_timeout(1000)
        ast.wait_for_function("S1016.sync.LICH.status==='ok'", timeout=8000)
        l.set_input_files('#scheduleFile', FX + '1016_Lich_lam_viec_T10_v1.csv'); l.wait_for_timeout(1200)
        ast.wait_for_function("S1016.data.LICH.fileName.indexOf('v1')>=0", timeout=8000)
        a = ast.evaluate("S1016.data.LICH.shifts['SH:2026-10-26:EMP-VO-DANG-TU-QUYEN'].raw")
        l.set_input_files('#scheduleFile', FX + '1016_Lich_lam_viec_T10_v2.csv'); l.wait_for_timeout(1200)
        ast.wait_for_function("S1016.data.LICH.fileName.indexOf('v2')>=0", timeout=8000)
        b = ast.evaluate("S1016.data.LICH.shifts['SH:2026-10-26:EMP-VO-DANG-TU-QUYEN'].raw")
        rec('V1', 'Lịch làm việc bản 27/10: sửa ca → Trợ lý cập nhật', a != b, {'truoc': a, 'sau': b, 'loi_trang': [x for x in le if 'PAGEERROR' in x]})
    except Exception: rec('V1', 'Lịch', False, {'ex': traceback.format_exc()[-600:]})
    # V2: Dashboard Sale T10 2026-2025
    try:
        d = ctx.new_page(); de = errs(d); d.goto(BASE + '03_DOANH_SO/DS_Dashboard_Sale_1016_T10_2026-2025.html'); d.wait_for_timeout(1500)
        d.set_input_files('#fileIn', [FX + 'sale2025.csv', FX + 'sale2026_A.csv']); d.wait_for_timeout(3000)
        ast.wait_for_function("S1016.sync.SALE.status==='ok'&&S1016.model.sale('2026-10')&&S1016.model.sale('2026-10').v2", timeout=10000)
        s1 = ast.evaluate("(()=>{const s=S1016.model.sale('2026-10');return {tool:s.tool,rev:s.totals.revenue,py:s.totals.pyRevenue,d26:s.byDate.find(x=>x.iso==='2026-10-26').revenue}})()")
        d.set_input_files('#fileIn', [FX + 'sale2026_B.csv']); d.wait_for_timeout(3000)
        ast.wait_for_function("S1016.model.sale('2026-10').totals.revenue>%d" % s1['rev'], timeout=10000)
        s2 = ast.evaluate("(()=>{const s=S1016.model.sale('2026-10');return {rev:s.totals.revenue,d26:s.byDate.find(x=>x.iso==='2026-10-26').revenue}})()")
        # dashboard cũ cùng tháng không được đè nguồn chuẩn
        o = ctx.new_page(); o.goto(BASE + '03_DOANH_SO/DS_2026-10_Dashboard_Sale_Budget.html'); o.wait_for_timeout(1200)
        o.set_input_files('#fileInput', FX + 'transaction_detail_sale_A.csv'); o.wait_for_timeout(2500); ast.wait_for_timeout(800)
        s3 = ast.evaluate("(()=>{const s=S1016.model.sale('2026-10');return {v2:s.v2,rev:s.totals.revenue,tool:s.tool}})()")
        exp = 3 * (1000000 + 1500000 + 2000000 + 2500000) - 1000000
        ok = s1['rev'] == exp and s1['py'] == exp and s2['rev'] == exp + 3000000 and s3['v2'] and s3['rev'] == s2['rev']
        rec('V2', 'Dashboard Sale T10 2026-2025: nạp file → Trợ lý nhận, là nguồn chuẩn', ok, {'lan1': s1, 'lan2': s2, 'sau_khi_mo_dashboard_cu': s3, 'ky_vong': exp, 'loi_trang': [x for x in de if 'PAGEERROR' in x]})
        ast.evaluate("S1016.ui.tab='sale';S1016.ui.render()"); ast.wait_for_timeout(300); ast.screenshot(path='/home/claude/testenv/shots/v2_sale.png', full_page=True)
    except Exception: rec('V2', 'Sale V2', False, {'ex': traceback.format_exc()[-600:]})
    # V3: tracker 18/10 bản mới + bản PUSH_SALE_THANG_10
    try:
        t = ctx.new_page(); te = errs(t); t.goto(BASE + '04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_1810_AVATAR_450.html'); t.wait_for_timeout(1500)
        t.set_input_files('#excelFileInput', [FX + 'transaction_20261026_A.csv', FX + 'transaction_detail_20261026_A.csv']); t.wait_for_timeout(2500)
        ast.wait_for_function("S1016.sync.PS_T10_AVATAR.status==='ok'", timeout=10000)
        q = ast.evaluate("Object.values(S1016.model.pushMerged('2026-10').recs).filter(r=>r.pid==='SUATAM-AVATAR').reduce((s,r)=>s+r.qty,0)")
        t2 = ctx.new_page(); t2.goto(BASE + '04_PUSH_SALE/2026-10/PUSH_SALE_THANG_10.html'); t2.wait_for_timeout(1500)
        chip = t2.inner_text('#s1016-chip') if t2.query_selector('#s1016-chip') else ''
        rec('V3', 'Tracker T10 bản mới (18/10 + PUSH_SALE_THANG_10) gửi số liệu', q == 3 and 'Trợ lý' in chip, {'avatar': q, 'chip_ban_THANG_10': chip, 'loi_trang': [x for x in te if 'PAGEERROR' in x]})
    except Exception: rec('V3', 'Tracker', False, {'ex': traceback.format_exc()[-600:]})
    # V4: Trợ lý không còn link tới file trên máy
    try:
        bad = []
        for tab in ['tools', 'task', 'ov']:
            ast.evaluate(f"S1016.ui.tab='{tab}';S1016.ui.taskView='list';S1016.ui.render()"); ast.wait_for_timeout(300)
            hrefs = ast.evaluate("[...document.querySelectorAll('section.mod.on a[href]')].map(a=>a.getAttribute('href'))")
            bad += [h for h in hrefs if not h.startswith('https://') and not h.startswith('#')]
        n_tools = ast.evaluate("document.querySelectorAll('#m-tools .toolcard').length")
        rec('V4', 'Mọi link công cụ trong Trợ lý trỏ GitHub (không còn file trên máy)', not bad, {'link_khong_phai_github': bad[:10]})
        hub = open('/home/claude/v3/00_TRANG_CHU_LINK_TONG_HOP.html', encoding='utf8').read()
        loc = [h for h in re.findall(r'<a class="(?:main|loc)" href="([^"]+)"', hub) if not h.startswith('http')]
        rec('V5', 'Trang chủ: mọi link trỏ GitHub (trừ CCCD giữ trên máy)', all('CCCD' in h for h in loc), {'con_lai': loc})
    except Exception: rec('V4', 'Link', False, {'ex': traceback.format_exc()[-600:]})
    rec('V6', 'Không lỗi JavaScript ở Trợ lý', not [x for x in aerr if 'PAGEERROR' in x], [x for x in aerr if 'PAGEERROR' in x][:5])
    br.close()
json.dump(R, open('/home/claude/testenv/report_v2.json', 'w'), ensure_ascii=False, indent=1)
print('TỔNG', sum(r['result'] == 'ĐẠT' for r in R), '/', len(R))
