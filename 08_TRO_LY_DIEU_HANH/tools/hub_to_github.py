#!/usr/bin/env python3
"""Chuyển mọi link trên Trang chủ sang bản GitHub (repo 1016_LINK_TONG_HOP) + thêm ô công cụ mới.

    python3 hub_to_github.py <thư mục 0.LINK TỔNG HỢP>

- Link chính đang trỏ file trong máy  → https://hoangnganhapulico-stack.github.io/1016_LINK_TONG_HOP/<đường dẫn>
- Link "📁 Bản lưu thư mục"           → cùng bản trên kho tổng GitHub ("🗂 Bản kho tổng")
- Giữ nguyên file dữ liệu cá nhân (CCCD) ở máy, không đưa lên GitHub.
Chạy lại nhiều lần không bị trùng.
"""
import re, sys, os
G = 'https://hoangnganhapulico-stack.github.io/1016_LINK_TONG_HOP/'
KEEP_LOCAL = re.compile(r'CCCD', re.I)
NEW_TILES = [  # (id section, đường dẫn, tên, mô tả, ngày, đứng trước ô có tên)
    ('doanh-so', '03_DOANH_SO/DS_Dashboard_Sale_1016_T10_2026-2025.html', 'Dashboard Sale 1016 T10 - So sánh 2026/2025',
     'Doanh số T10 so cùng kỳ 2025, Budget theo ngày/CAT, giỏ hàng, SKU, kế hoạch hành động - nguồn doanh số chuẩn của Trợ lý', '27/10/2026', 'Dashboard Sale 1016 - Tháng 10'),
    ('hay-dung', '03_DOANH_SO/DS_Dashboard_Sale_1016_T10_2026-2025.html', 'Dashboard Sale 1016 T10 - So sánh 2026/2025',
     'Doanh số T10 so cùng kỳ 2025, Budget, giỏ hàng, SKU - gửi số liệu sang Trợ lý', '27/10/2026', 'Dashboard Sale 1016 - Tháng 10'),
]


def tile(path, name, desc, date):
    key = (name + ' ' + desc + ' ' + os.path.basename(path)).lower()
    return (f'<div class="tile" data-s="{key}"><a class="main" href="{G}{path}" target="_blank"><b>{name}</b><span class="d">{desc}</span></a>'
            f'<span class="meta"><span class="row"><span class="src gh">GitHub</span><span class="dt" data-d="{date}">Cập nhật {date}</span></span>'
            f'<code>{os.path.basename(path)}</code></span></div>')


def convert(s):
    n = {'main': 0, 'loc': 0, 'new': 0}
    def fix_tile(m):
        t = m.group(0)
        def main(mm):
            h = mm.group(1)
            if h.startswith('http') or KEEP_LOCAL.search(h): return mm.group(0)
            n['main'] += 1; return f'<a class="main" href="{G}{h}"'
        t2 = re.sub(r'<a class="main" href="([^"]+)"', main, t)
        if t2 != t:
            t2 = t2.replace('<span class="src lc">File máy</span>', '<span class="src gh">GitHub</span>')
        def loc(mm):
            h = mm.group(1)
            if h.startswith('http') or KEEP_LOCAL.search(h): return mm.group(0)
            n['loc'] += 1; return f'<a class="loc" href="{G}{h}"'
        t2 = re.sub(r'<a class="loc" href="([^"]+)"', loc, t2)
        return t2.replace('📁 Bản lưu thư mục', '🗂 Bản kho tổng')
    s = re.sub(r'<div class="tile".*?</span></div>', fix_tile, s, flags=re.S)
    for sec, path, name, desc, date, before in NEW_TILES:
        m = re.search(r'<section id="%s".*?</section>' % sec, s, re.S)
        if not m or (G + path) in m.group(0): continue
        body = m.group(0)
        i = body.find('<b>' + before + '</b>')
        pos = body.rfind('<div class="tile"', 0, i) if i >= 0 else body.find('<div class="grid">') + len('<div class="grid">')
        body = body[:pos] + tile(path, name, desc, date) + body[pos:]
        s = s[:m.start()] + body + s[m.end():]; n['new'] += 1
    return s, n


if __name__ == '__main__':
    root = sys.argv[1]
    p = os.path.join(root, '00_TRANG_CHU_LINK_TONG_HOP.html')
    s, n = convert(open(p, encoding='utf8').read())
    open(p, 'w', encoding='utf8').write(s)
    print(n)
