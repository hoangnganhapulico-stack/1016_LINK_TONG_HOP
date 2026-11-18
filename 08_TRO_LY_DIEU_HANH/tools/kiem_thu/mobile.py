from playwright.sync_api import sync_playwright
from common import *
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={'width':390,'height':844}); route(ctx,'2026-10-26T15:00:00+07:00')
    l=ctx.new_page(); l.goto(BASE+'01_VAN_HANH_TEAM/VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html'); l.wait_for_timeout(800)
    pg=ctx.new_page(); pg.goto(BASE+'08_TRO_LY_DIEU_HANH/index.html'); pg.wait_for_timeout(1500)
    out={}
    for t in ['ov','cal','task','push','sale','kho','journal','tools','src','hist']:
        pg.evaluate(f"S1016.ui.tab='{t}';S1016.ui.render()"); pg.wait_for_timeout(250)
        out[t]=pg.evaluate("document.documentElement.scrollWidth")
        if t in ('ov','cal','src'): pg.screenshot(path=f'shots/m_{t}.png')
    print(out); br.close()
