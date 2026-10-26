/* S1016 DEMO - bộ dữ liệu minh họa lưu RIÊNG ở khóa S1016_A_DEMO.
   Chỉ hiển thị khi bật "Chế độ DEMO"; không bao giờ ghi vào dữ liệu thật hay nhật ký chính thức. */
(function () {
  "use strict";
  var S = window.S1016, U = S.util, D = S.demo = {};
  D.exists = function () { return !!S.readJ(S.KEYS.DEMO, null); };
  D.create = function () {
    var today = U.todayIso(), ym = today.slice(0, 7), dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    var names = [["DEMO Nguyễn Văn A", "Admin Chief"], ["DEMO Trần Thị B", "Admin"], ["DEMO Lê Văn C", "Admin"], ["DEMO Phạm Thị D", "SC"], ["DEMO Võ Văn E", "Sale Staff"]];
    var shiftsPool = ["07:30 ~ 15:30", "14:30 ~ 22:30", "OFF", "09:00 ~ 17:00"];
    var dates = {}, seed = 7; function rnd(n) { seed = (seed * 9301 + 49297) % 233280; return Math.floor(seed / 233280 * n); }
    for (var d = 1; d <= dim; d++) { var iso = ym + "-" + U.pad(d); dates[iso] = names.map(function (n, i) { return { name: n[0], pos: n[1], phone: "", raw: shiftsPool[(d + i) % 4] }; }); }
    var lich = (function () { var shifts = {}, employees = {}; Object.keys(dates).forEach(function (iso) { dates[iso].forEach(function (r) { var emp = S.empId(r.name), c = S.classifyShift(r.raw);
      shifts["SH:" + iso + ":" + emp] = { id: "SH:" + iso + ":" + emp, date: iso, emp: emp, name: r.name, pos: r.pos, team: S.teamOf(r.pos, r.name), raw: r.raw, kind: c.kind, start: c.startH == null ? null : c.startH, end: c.endH == null ? null : c.endH, bucket: c.bucket || null, demo: true };
      employees[emp] = { id: emp, name: r.name, pos: r.pos, team: S.teamOf(r.pos, r.name), phone: "" }; }); });
      var notes = {}; notes[ym + "-05"] = "DEMO - Kohnan Day"; notes[ym + "-20"] = "DEMO - Kohnan Day"; return { shifts: shifts, employees: employees, notes: notes, duplicates: [], fileName: "DEMO", builtin: false }; })();
    var products = { "DEMO-SP1": { pid: "DEMO-SP1", label: "DEMO Sản phẩm 1", unit: "Chai" }, "DEMO-SP2": { pid: "DEMO-SP2", label: "DEMO Sản phẩm 2", unit: "Tuýp" } };
    var staff = {}, targets = { "DEMO-SP1": {}, "DEMO-SP2": {} }, dayTargets = { "DEMO-SP1": {}, "DEMO-SP2": {} }, recs = {};
    names.slice(0, 4).forEach(function (n, i) { var emp = S.empId(n[0]); staff["D" + i] = { emp: emp, name: n[0], role: n[1] }; targets["DEMO-SP1"][emp] = 40 - i * 5; targets["DEMO-SP2"][emp] = 10; });
    for (d = 1; d <= dim; d++) { iso = ym + "-" + U.pad(d); dayTargets["DEMO-SP1"][iso] = 4.5; dayTargets["DEMO-SP2"][iso] = 1.3;
      if (iso <= today) Object.keys(staff).forEach(function (sid) { var q = rnd(4); if (!q) return; var id = "PS:DEMO-SP1:" + staff[sid].emp + ":" + iso; recs[id] = { id: id, pid: "DEMO-SP1", emp: staff[sid].emp, name: staff[sid].name, date: iso, qty: q, revenue: q * 99000, bills: q, verified: true, src: "DEMO", demo: true }; }); }
    var byDate = [], bud = {}, mtd = 0, mtdT = 0, monthT = 0;
    for (d = 1; d <= dim; d++) { iso = ym + "-" + U.pad(d); bud[iso] = 100000000; monthT += 1e8; if (iso <= today) { var rv = 80000000 + rnd(40) * 1e6; byDate.push({ iso: iso, revenue: rv, revenueTaxIncl: Math.round(rv * 1.1), qty: 1000, bills: 400 }); mtd += rv; mtdT += 1e8; } }
    var dl = byDate.length;
    var sale = { months: {} }; sale.months[ym] = { month: ym, at: U.nowIso(), origin: "demo", tool: "DEMO", sourceFile: "DEMO", budgetSource: "DEMO", revenueDef: "DEMO", unit: "VND",
      totals: { revenue: mtd, slipCount: dl * 400, dateMin: ym + "-01", dateMax: today }, byDate: byDate, byCategory: [{ code: "D1", name: "DEMO Ngành 1", revenue: Math.round(mtd * 0.6), mtdTarget: Math.round(mtdT * 0.6), attainmentPct: null }, { code: "D2", name: "DEMO Ngành 2", revenue: Math.round(mtd * 0.4), mtdTarget: Math.round(mtdT * 0.4), attainmentPct: null }],
      attainment: { mtdTarget: mtdT, mtdActual: mtd, attainmentPct: mtd / mtdT * 100, monthTarget: monthT, forecastTotal: monthT * mtd / mtdT, forecastPct: mtd / mtdT * 100, gapToTarget: monthT - monthT * mtd / mtdT, daysElapsed: dl, daysRemaining: dim - dl }, budgetByDate: bud };
    sale.days = {}; byDate.forEach(function (x) { sale.days["SD:" + x.iso] = { id: "SD:" + x.iso, date: x.iso, revenue: x.revenue, bills: x.bills }; });
    var items = {}; for (var i = 1; i <= 6; i++) items["INV:DEMO" + i] = { id: "INV:DEMO" + i, bc: "000000000000" + i, name: "DEMO Mã hàng " + i, cat: "D1", catName: "DEMO", sup: "DEMO", supName: "NCC DEMO", stock: i - 1, rate: 1.5, daysLeft: (i - 1) / 1.5, lead: 3, onOrder: 0, rec: 10, status: i < 3 ? "oos" : "low", statusText: i < 3 ? "Hết hàng" : "Sắp hết" };
    var fg = {}; fg["FG:KDEMO:0000000000001"] = { id: "FG:KDEMO:0000000000001", bc: "0000000000001", name: "DEMO Mã hàng 1", cat: "D1", sup: "DEMO", supName: "NCC DEMO", owner: "DEMO SUP", stock: 0, rate: 1.5, onOrder: 0, rec: 10, detected: today.replace(/-/g, ""), types: ["DEMO"], status: "unchecked", statusText: "Chưa kiểm tra", reasonCode: "", reason: "", note: "", by: "", at: "", poNew: [] };
    var kho = { refDate: today.replace(/-/g, ""), latestMonth: ym.replace("-", ""), months: [], counts: { total: 100, oos: 2, low: 4, ok: 94, zombie: 0, disc: 0, cons: 0, noorder: 0, recPositive: 6, onOrder: 0 }, items: items, forgot: { pid: "KDEMO", ref: today.replace(/-/g, ""), month: ym, created: U.nowIso() }, forgotRows: fg };
    var ta = S.data.TA ? U.clone(S.data.TA) : { templates: {}, occ: {} };
    var pack = { createdAt: U.nowIso(), data: { LICH: lich, TA: ta, PS_T10_AVATAR: null, SALE: sale, KHO: kho, BUDGET: null, ADHOC: {} } };
    pack.data["PS_DEMO"] = null;
    var cfg = S.PUSH_SOURCES.filter(function (c) { return c.month === ym; })[0];
    var pushData = { cfg: { id: "DEMO", name: "DEMO tracker", month: ym, priority: 99 }, products: products, staff: staff, targets: targets, dayTargets: dayTargets, recs: recs };
    if (cfg) pack.data[cfg.id] = pushData; else { S.PUSH_SOURCES.push({ id: "PS_DEMO", key: "__none__", name: "DEMO tracker", month: ym, priority: 99, products: {} }); pack.data.PS_DEMO = pushData; }
    S.writeJ(S.KEYS.DEMO, pack);
    S.addLog([{ origin: "Người dùng", source: "DEMO", entity: "demo", id: "S1016_A_DEMO", field: "tạo", old: null, new: "Tạo bộ dữ liệu DEMO (lưu tách riêng)" }]);
    return pack;
  };
  D.purge = function () {
    S.raw.del(S.KEYS.DEMO); S.state.settings.demoMode = false; S.saveState("demo");
    S.addLog([{ origin: "Người dùng", source: "DEMO", entity: "demo", id: "S1016_A_DEMO", field: "xóa", old: "có", new: "đã xóa toàn bộ DEMO - dữ liệu thật không bị ảnh hưởng" }]);
  };
})();
