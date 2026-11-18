import sys, json
from playwright.sync_api import sync_playwright
from common import *
TOOLS = ['01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html', '01_VAN_HANH_TEAM/VH_Bang_Dieu_Khien_Team_Admin/index.html', '02_KHO_DAT_HANG/KHO_OrderIQ_Dat_Hang_Ton_Kho.html',
         '03_DOANH_SO/DS_2026-10_Dashboard_Sale_Budget.html', '03_DOANH_SO/DS_2026-11_Dashboard_Sale_Budget.html', '04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_1810_AVATAR_450.html',
         '04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Nhan_Vien.html', '04_PUSH_SALE/2026-10/PS_2026-10_Tracker_Team_0210_ON_Body_800.html', '04_PUSH_SALE/2026-09/PS_2026-09_GD2_Tracker_Team.html']
which = sys.argv[1] if len(sys.argv) > 1 else 'site'
res = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    for t in TOOLS:
        ctx = br.new_context(); route(ctx, '2026-10-26T15:00:00+07:00'); pg = ctx.new_page(); e = errs(pg)
        url = (BASE + t) if which == 'site' else 'file:///home/claude/src/' + t
        pg.goto(url); pg.wait_for_timeout(2500)
        snaps = pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('S1016'))")
        res[t] = {'errors': [x[:200] for x in e], 'snaps': snaps}
        ctx.close()
    ctx = br.new_context(); route(ctx, '2026-10-26T15:00:00+07:00'); pg = ctx.new_page(); e = errs(pg)
    pg.goto(BASE + '08_TRO_LY_DIEU_HANH/index.html'); pg.wait_for_timeout(2000)
    res['ASSISTANT'] = {'errors': e, 'sync': pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(S1016.sync).map(([k,v])=>[k,v.status])))")}
    pg.screenshot(path='/home/claude/testenv/shot_empty.png', full_page=False)
    br.close()
print(json.dumps(res, ensure_ascii=False, indent=1))
