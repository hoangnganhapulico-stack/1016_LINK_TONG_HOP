#!/usr/bin/env python3
"""Bộ chuyển đổi tĩnh: trích dữ liệu từ mã nguồn công cụ gốc -> file dữ liệu của Trợ lý.

    python3 extract_sources.py <thư mục 0.LINK TỔNG HỢP> <thư mục 08_TRO_LY_DIEU_HANH>

Sinh ra:
  js/data-tools.js        - danh mục link công cụ (đọc từ 00_TRANG_CHU_LINK_TONG_HOP.html)
  js/data-budget-2026.js  - Budget 2026 theo ngày (đọc hằng BUDGET_2026 trong công cụ Lịch làm việc)
  js/data-ta-snapshot.js  - mẫu công việc định kỳ (chạy hàm weekly()/monthly() thật của Team Admin bằng Chromium)
Chạy lại mỗi khi công cụ gốc thay đổi. Mỗi file ghi rõ nguồn + thời điểm trích.
"""
import os, re, sys, json, datetime, html

root, out = sys.argv[1], sys.argv[2]
now = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
def w(name, var, obj, src):
    p = os.path.join(out, 'js', name)
    with open(p, 'w', encoding='utf8') as f:
        f.write(f'/* Tự sinh bởi tools/extract_sources.py - nguồn: {src} - trích lúc {now}. KHÔNG sửa tay. */\n')
        f.write(f'window.{var} = ' + json.dumps(obj, ensure_ascii=False) + ';\n')
    print('đã ghi', p, os.path.getsize(p), 'bytes')

# 1. Danh mục công cụ từ trang chủ
from bs4 import BeautifulSoup
hub = open(os.path.join(root, '00_TRANG_CHU_LINK_TONG_HOP.html'), encoding='utf8').read()
soup = BeautifulSoup(hub, 'html.parser')
tools = []
for sec in soup.select('section.sec'):
    h2 = sec.find('h2'); group = h2.get_text(strip=True) if h2 else sec.get('id')
    for t in sec.select('.tile'):
        a = t.select_one('a.main');
        if not a: continue
        b = a.find('b'); d = a.select_one('.d'); srcl = t.select_one('.src'); dt = t.select_one('.dt'); loc = t.select_one('a.loc')
        href = a.get('href', '')
        tools.append({
            'name': b.get_text(strip=True) if b else a.get_text(strip=True), 'desc': d.get_text(strip=True) if d else '',
            'group': group, 'groupId': sec.get('id'), 'href': href, 'local': loc.get('href') if loc else (href if not href.startswith('http') else ''),
            'host': srcl.get_text(strip=True) if srcl else '', 'updated': dt.get('data-d') if dt else ''})
w('data-tools.js', 'S1016_TOOLS', {'extractedAt': now, 'count': len(tools), 'tools': tools}, '00_TRANG_CHU_LINK_TONG_HOP.html')

# 2. Budget 2026 từ công cụ Lịch
lich = open(os.path.join(root, '01_VAN_HANH_TEAM', 'VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html'), encoding='utf8').read()
m = re.search(r'const BUDGET_2026\s*=\s*(\{.*?\});', lich, re.S)
budget = json.loads(m.group(1)) if m else {}
w('data-budget-2026.js', 'S1016_BUDGET_2026', {'extractedAt': now, 'unit': 'nghìn đồng, chưa thuế', 'source': 'VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html (hằng BUDGET_2026)', 'byDate': budget}, 'VH_Lich_Lam_Viec_Dieu_Phoi_Ca.html')

# 3. Mẫu công việc Team Admin - chạy hàm thật trong trình duyệt
ta = os.path.join(root, '01_VAN_HANH_TEAM', 'VH_Bang_Dieu_Khien_Team_Admin', 'index.html')
if '__S1016_TA' not in open(ta, encoding='utf8').read():
    print('Team Admin chưa gắn cầu nối - chạy patch_bridges.py trước'); sys.exit(1)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page()
    pg.route(re.compile(r'^https?://(?!127\.0\.0\.1).*'), lambda r: r.abort())
    pg.goto('file://' + os.path.abspath(ta)); pg.wait_for_timeout(800)
    days = pg.evaluate('''() => { const T=window.__S1016_TA, p=n=>n<10?'0'+n:''+n, out={};
      for(let d=new Date(2026,9,1); d<=new Date(2027,2,31); d.setDate(d.getDate()+1)){
        const iso=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
        out[iso]=T.weekly(new Date(d)).concat(T.monthly(new Date(d))).map(x=>[x[0],String(x[1]).replace(/<[^>]+>/g,''),x[2]]); }
      const procs={}; (window.__PROCS||[]).forEach(x=>{ procs[x.id]={g:x.g,n:x.n,t:String(x.t||'').replace(/<[^>]+>/g,''),r:x.r}; });
      return {days:out, procs}; }''')
    days, procs = days['days'], days['procs']
    br.close()
ks = sorted(days)
w('data-ta-snapshot.js', 'S1016_TA_SNAPSHOT', {'extractedAt': now, 'from': ks[0], 'to': ks[-1], 'source': 'VH_Bang_Dieu_Khien_Team_Admin/index.html - hàm weekly()/monthly()', 'roles': {'c': 'Admin Chief', 'a': 'Admin', 's': 'SC', 'all': 'Toàn team'}, 'procs': procs, 'days': days}, 'Team Admin index.html')
