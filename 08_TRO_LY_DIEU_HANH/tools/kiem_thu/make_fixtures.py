"""Sinh file kiểm thử theo đúng định dạng cột mà công cụ gốc đọc (POS bill/detail, lịch ca, tồn kho)."""
import os, datetime, csv
FX = os.path.join(os.path.dirname(__file__), 'fx'); os.makedirs(FX, exist_ok=True)
def w(name, rows):
    with open(os.path.join(FX, name), 'w', newline='', encoding='utf-8') as f: csv.writer(f).writerows(rows)

# 1. Push Sale - POS bill + detail (tracker T10 AVATAR)
AV, KEM, SON = '8936183971085', '4513574025905', '4987036412631'
billA = [['Slip No.', 'Sales Staff', 'Sales Day', 'Slip Div'],
         ['S001', 'NGUYEN LE MINH THU', '24/10/2026', 'Sales'], ['S002', 'NGUYEN LE MINH THU', '25/10/2026', 'Sales'],
         ['S003', 'LE UYEN NHI', '25/10/2026', 'Sales'], ['S004', 'VO DANG TU QUYEN', '26/10/2026', 'Sales']]
detA = [['Slip No.', 'Slip Div', 'Trading Datetime', 'Barcode', 'Item Name', 'QTY', 'Amount(Tax excl.)'],
        ['S001', 'Sales', '24/10/2026 10:00', AV, 'SUA TAM AVATAR', '2', '143636'], ['S002', 'Sales', '25/10/2026 11:00', AV, 'SUA TAM AVATAR', '1', '71818'],
        ['S003', 'Sales', '25/10/2026 15:00', KEM, 'KEM TAY HATOMUGI', '2', '89090'], ['S004', 'Sales', '26/10/2026 09:30', SON, 'SON MENTURM', '1', '35454']]
w('transaction_20261026_A.csv', billA); w('transaction_detail_20261026_A.csv', detA)
billB = [billA[0], ['S010', 'NGUYEN LE MINH THU', '26/10/2026', 'Sales']]
detB = [detA[0], ['S010', 'Sales', '26/10/2026 14:00', AV, 'SUA TAM AVATAR', '2', '143636']]
w('transaction_20261026_B.csv', billB); w('transaction_detail_20261026_B.csv', detB)

# 2. Lịch ca dạng file Excel (cột ngày là số serial Excel)
base = datetime.date(1899, 12, 30)
ser = [(datetime.date(2026, 10, d) - base).days for d in range(1, 32)]
notes = ['', '', '', ''] + ['' for _ in ser]; notes[4 + 25] = 'KIỂM KÊ TEST'
people = [('NGUYỄN LÊ MINH THƯ', 'CS'), ('LÊ UYÊN NHI', 'SC'), ('VÕ ĐẶNG TÚ QUYÊN', 'Admin'), ('Dương Xuân Hoàng Ngân', 'Admin Chief'), ('NGUYỄN QUỐC BẢO', 'Sale Senior')]
pat = ['07:30 ~ 15:30', '14:30 ~ 22:30', 'OFF', '09:00 ~ 17:00']
def lich(change=False):
    rows = [notes, ['STT', 'Mã NV', 'Họ tên', 'Vị trí'] + ser]
    for i, (n, p) in enumerate(people):
        sh = [pat[(d + i) % 4] for d in range(31)]
        if change and i == 2: sh[25] = '07:30 ~ 15:30' if sh[25] != '07:30 ~ 15:30' else '14:30 ~ 22:30'
        rows.append([i + 1, 1000 + i, n, p] + sh)
    return rows
w('1016_Lich_lam_viec_T10_v1.csv', lich()); w('1016_Lich_lam_viec_T10_v2.csv', lich(True))

# 3. Doanh số POS chi tiết (Dashboard Sale)
H = ['Trading DateTime', 'Store', 'POS', 'Slip No.', 'Slip Div', 'Layer1 Code', 'Layer1', 'Barcode', 'Item Name', 'Qty', 'Amount(Tax excl.)', 'Amount(Tax incl.)', 'Tax Amount']
def sale(days, extra=0):
    rows = [H]; n = 0
    for d in days:
        for k in range(5):
            n += 1; amt = 1000000 + k * 250000 + (extra if d == days[-1] and k == 0 else 0)
            rows.append([f'{d:02d}/10/2026 1{k}:00:00', '1016', '1', f'P{d:02d}{k:03d}', 'Sales', '02', 'TOOLS', f'89300000{n:05d}', f'Hang test {n}', '1', str(amt), str(int(amt * 1.1)), str(int(amt * 0.1))])
    rows.append(['26/10/2026 20:00:00', '1016', '1', 'R0001', 'Return', '02', 'TOOLS', '8930000000001', 'Hang test 1', '-1', '-1000000', '-1100000', '-100000'])
    return rows
w('transaction_detail_sale_A.csv', sale([24, 25, 26])); w('transaction_detail_sale_B.csv', sale([24, 25, 26], extra=5000000))

# 4. Tồn kho cho OrderIQ
HT = ['Barcode', 'Product Name', 'Supplier Code', 'Supplier Name', 'LAYER1', 'Order Group Name', 'Open Qty', 'Income Qty', 'Sales Qty', 'Sales Amt', 'Close Qty', 'Close Cst']
def ton(close_first):
    rows = [HT]
    for i in range(1, 13):
        sales = 30 + i * 3
        close = close_first if i == 1 else (2 if i <= 4 else 200)
        rows.append([f'8931234500{i:03d}', f'SP KHO TEST {i}', '100846', 'NCC TEST', '02', 'Normal Order', '50', '20', str(sales), str(sales * 50000), str(close), str(close * 30000)])
    return rows
w('Inventory_20261026090000.csv', ton(0)); w('Inventory_20261026180000.csv', ton(40))
print('fixtures:', sorted(os.listdir(FX)))
