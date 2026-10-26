/* =====================================================================
   S1016 ADAPTERS - bộ chuyển đổi dữ liệu theo từng công cụ nguồn
   Mỗi adapter: đọc khóa thật của công cụ -> kiểm tra cấu trúc -> chuẩn hóa về mô hình chung.
   ===================================================================== */
(function () {
  "use strict";
  var S = window.S1016, U = S.util;

  function parseOrThrow(str, label) {
    try { return JSON.parse(str); } catch (e) { throw new Error(label + ": dữ liệu không đọc được (JSON lỗi)."); }
  }
  function readSnap(kind) {
    var r = S.getSourceKey("S1016_SNAP_" + kind);
    if (r.value == null) return null;
    var o = parseOrThrow(r.value, "Ảnh chụp " + kind);
    if (!o || o.v !== 1 || !o.payload || o.kind !== kind) throw new Error("Ảnh chụp " + kind + " sai cấu trúc (thiếu v/payload/kind).");
    return { snap: o, origin: r.origin, at: o.at };
  }
  S.empId = function (name) { return "EMP-" + U.slug(name); };

  /* Phân loại ca - giữ nguyên quy tắc của công cụ Lịch làm việc */
  S.classifyShift = function (raw) {
    var s = String(raw || "").trim(), u = s.toUpperCase();
    var m = s.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
    if (m) {
      var sh = parseInt(m[1], 10) + parseInt(m[2], 10) / 60, eh0 = parseInt(m[3], 10) + parseInt(m[4], 10) / 60;
      var over = eh0 <= sh, eh = over ? eh0 + 24 : eh0, bk = "day";
      if (sh < 6.5 || over) bk = "night"; else if (sh >= 13.5) bk = "evening";
      return { kind: "shift", label: s, startH: sh, endH: eh, overnight: over, bucket: bk };
    }
    if (u.indexOf("OFF") >= 0 || u === "WO") return { kind: "off", label: s || "OFF" };
    if (u.indexOf("AL") === 0 || u.indexOf("NGHỈ PHÉP") >= 0) return { kind: "leave", label: s || "AL" };
    if (u === "PH") return { kind: "leave", label: "Lễ (PH)" };
    if (u.indexOf("SL") === 0) return { kind: "sick", label: s };
    if (u.indexOf("UP") === 0) return { kind: "swap", label: s };
    return { kind: "note", label: s };
  };
  S.teamOf = function (pos, name) {
    if (/^(sm|store manager)\b/i.test(pos || "")) return "SM";
    if (U.normName(name) === "nguyen hoang dung") return "SM";
    if (/sale/i.test(pos || "")) return "SALES";
    return "ADMIN";
  };

  /* ================= 1. LỊCH LÀM VIỆC (ca) ================= */
  function normLich(dates, notes) {
    var shifts = {}, employees = {}, dup = [];
    Object.keys(dates || {}).forEach(function (iso) {
      (dates[iso] || []).forEach(function (r) {
        if (!r || !r.name) return;
        var emp = S.empId(r.name), id = "SH:" + iso + ":" + emp;
        var c = S.classifyShift(r.raw);
        if (shifts[id] && shifts[id].raw !== String(r.raw)) dup.push({ date: iso, name: r.name, a: shifts[id].raw, b: String(r.raw) });
        shifts[id] = { id: id, date: iso, emp: emp, name: String(r.name).trim(), pos: String(r.pos || "").trim(), team: S.teamOf(r.pos, r.name), raw: String(r.raw), kind: c.kind, start: c.startH == null ? null : c.startH, end: c.endH == null ? null : c.endH, bucket: c.bucket || null };
        var e = employees[emp] || (employees[emp] = { id: emp, name: String(r.name).trim(), pos: String(r.pos || "").trim(), team: S.teamOf(r.pos, r.name), phone: "" });
        if (r.phone && !e.phone) e.phone = String(r.phone);
      });
    });
    return { shifts: shifts, employees: employees, notes: notes || {}, duplicates: dup };
  }
  S.registerSource({
    id: "LICH", name: "Lịch làm việc & điều phối ca", group: "Vận hành", tool: "LICH", entity: "Ca làm, nhân sự, sự kiện ngày",
    keys: ["S1016_SNAP_LICH", "khn16-sched"], how: "Mở công cụ Lịch làm việc (bản có cầu nối) hoặc tải file Excel lịch vào công cụ đó.",
    read: function () {
      var sn = readSnap("LICH"), d, meta;
      if (sn) { d = sn.snap.payload; meta = { at: sn.at, origin: sn.origin, file: d.fileName, builtin: d.builtin }; }
      else {
        var r = S.getSourceKey("khn16-sched"); if (r.value == null) return { missing: true, message: "Chưa thấy dữ liệu: công cụ Lịch chưa được mở (bản có cầu nối) hoặc chưa tải file Excel trong trình duyệt này." };
        var p = parseOrThrow(r.value, "khn16-sched");
        if (!p.data || !p.data.dates) throw new Error("khn16-sched sai cấu trúc (thiếu data.dates).");
        d = { dates: p.data.dates, notes: p.data.notes, fileName: p.fn, fileAt: p.at };
        meta = { at: p.at, origin: r.origin, file: p.fn };
      }
      if (!d.dates || typeof d.dates !== "object") throw new Error("Dữ liệu lịch thiếu danh sách ngày.");
      var n = normLich(d.dates, d.notes);
      n.fileName = d.fileName || ""; n.fileAt = d.fileAt || ""; n.builtin = !!d.builtin;
      return { data: n, count: Object.keys(n.shifts).length, origin: meta.origin, sourceAt: meta.at,
        message: (n.builtin ? "Dữ liệu nhúng trong công cụ Lịch (trích từ file Excel lịch T10)" : "File: " + (n.fileName || "?")),
        warnings: n.duplicates.length ? [n.duplicates.length + " ca trùng người/ngày khác nội dung - đã lấy bản sau cùng"] : [] };
    },
    diff: function (a, b, origin) { return S.diffRecords("LICH", "Ca làm", a && a.shifts, b.shifts, ["raw", "pos"], origin); }
  });

  /* ================= 2. CÔNG VIỆC TRONG CÔNG CỤ LỊCH ================= */
  S.registerSource({
    id: "LICH_TASKS", name: "Công việc (công cụ Lịch)", group: "Vận hành", tool: "LICH", entity: "Công việc phát sinh theo ngày",
    keys: ["khn16-tasks"], canWrite: true, how: "Thêm/tick công việc trong khung Công việc của công cụ Lịch làm việc.",
    read: function () {
      var r = S.getSourceKey("khn16-tasks");
      if (r.value == null) return { missing: true, message: "Chưa có công việc nào được lưu trong công cụ Lịch (trình duyệt này)." };
      var p = parseOrThrow(r.value, "khn16-tasks"); if (typeof p !== "object" || Array.isArray(p)) throw new Error("khn16-tasks sai cấu trúc.");
      var tasks = {};
      Object.keys(p).forEach(function (iso) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Array.isArray(p[iso])) return;
        p[iso].forEach(function (t) { if (!t || !t.id) return; var id = "LT:" + iso + ":" + t.id;
          tasks[id] = { id: id, srcId: t.id, date: iso, title: String(t.title || ""), assignee: String(t.assignee || ""), done: !!t.done, source: t.source || "" }; });
      });
      return { data: { tasks: tasks }, count: Object.keys(tasks).length, origin: r.origin, sourceAt: r.at };
    },
    diff: function (a, b, origin) { return S.diffRecords("LICH_TASKS", "Công việc", a && a.tasks, b.tasks, ["title", "assignee", "done"], origin); }
  });
  /* Ghi ngược: chỉ đổi cờ done của 1 công việc, đọc lại ngay trước khi ghi để tránh ghi đè thay đổi đồng thời */
  S.writeBackLichTask = function (task, done) {
    if (!S.state.settings.writeBackLich) return { ok: false, error: "Chưa bật quyền ghi ngược vào công cụ Lịch (mục Nguồn dữ liệu)." };
    var cur = S.raw.get("khn16-tasks"); if (cur == null) return { ok: false, error: "Công cụ Lịch trên trình duyệt này không có dữ liệu công việc (có thể đang dùng gói nhập)." };
    var p; try { p = JSON.parse(cur); } catch (e) { return { ok: false, error: "khn16-tasks lỗi JSON - không ghi." }; }
    var list = p[task.date] || [], t = list.filter(function (x) { return x.id === task.srcId; })[0];
    if (!t) return { ok: false, error: "Công việc đã bị xóa/sửa ở công cụ Lịch - không ghi. Bấm Đồng bộ lại." };
    if (String(t.title) !== task.title || !!t.done !== !!task.done) return { ok: false, error: "Công việc vừa được sửa ở công cụ Lịch (xung đột) - đã hủy ghi. Bấm Đồng bộ lại rồi thao tác lại." };
    t.done = !!done;
    try { S.raw.set("khn16-tasks", JSON.stringify(p)); } catch (e) { return { ok: false, error: "Không ghi được: " + e.message }; }
    S.addLog([{ origin: "Ghi ngược", source: "LICH_TASKS", entity: "Công việc", id: task.id, field: "done", old: !done, new: !!done, by: S.state.settings.user || "" }]);
    return { ok: true };
  };

  /* ================= 3. PUSH SALE - các tracker ================= */
  var P_AVATAR = { SuaTam: { pid: "SUATAM-AVATAR", key: "SUATAM", label: "Sữa Tắm AVATAR Hộp Quà", unit: "Hộp" }, KemTay: { pid: "KEMTAY-HATOMUGI", key: "KEMTAY", label: "Kem Dưỡng Tay Hatomugi", unit: "Tuýp" }, Son: { pid: "SON-MENTURM", key: "SON", label: "Son Dưỡng Môi Menturm", unit: "Thỏi" } };
  var P_ONBODY = { SuaTam: { pid: "SUATAM-ONBODY", key: "SUATAM", label: "Sữa Tắm On: The Body", unit: "Chai" }, KemTay: P_AVATAR.KemTay, Son: P_AVATAR.Son };
  var P_T9 = { SuaTam: { pid: "SUATAM-ONBODY", key: "SUATAM", label: "Sữa Tắm On: The Body", unit: "Chai", bills: "pushBillsSuaTam" }, Remos: { pid: "XITMUOI-REMOS", key: "REMOS", label: "Xịt Muỗi Remos", unit: "Chai", bills: "pushBillsRemos" } };
  S.PUSH_SOURCES = [
    { id: "PS_T10_AVATAR", key: "TEAM_ADMIN_POS_PUSH_SALE_OCT_2026_AVATAR_V2", name: "Push Sale T10 - Tracker Team (AVATAR, bản 15/10 & 18/10)", month: "2026-10", priority: 30, products: P_AVATAR, tool: "PS_T10_AVATAR_1810" },
    { id: "PS_T10_ONBODY", key: "TEAM_ADMIN_POS_PUSH_SALE_OCT_2026_V1", name: "Push Sale T10 - Tracker Team (ON Body, bản 02/10)", month: "2026-10", priority: 20, products: P_ONBODY, tool: "PS_T10_ONBODY_0210" },
    { id: "PS_T10_NV", key: "TEAM_ADMIN_PUSH_SALE_OCT_2026_NHANVIEN_AVATAR_V2", name: "Push Sale T10 - Tracker Nhân viên", month: "2026-10", priority: 10, products: P_AVATAR, tool: "PS_T10_NHANVIEN" },
    { id: "PS_T9_GD2", key: "TEAM_ADMIN_POS_PUSH_SALE_SEPT_2026_GD2_V1", name: "Push Sale T9 GĐ2 - Tracker Team", month: "2026-09", priority: 20, products: P_T9, tool: "PS_T9_GD2", sampleRisk: true },
    { id: "PS_T9_GD1", key: "TEAM_ADMIN_POS_PUSH_SALE_SEPT_2026_V1", name: "Push Sale T9 GĐ1 - Tracker Team", month: "2026-09", priority: 15, products: P_T9, tool: "PS_T9_GD1", sampleRisk: true }
  ];
  function billCount(state, cfg, prodCfg, staffId, day) {
    var bs = state.billStats || {}, set = null;
    if (prodCfg.bills && bs[prodCfg.bills]) set = (bs[prodCfg.bills][staffId] || {})[day];
    else if (bs.pushBills && bs.pushBills[prodCfg.key]) set = (bs.pushBills[prodCfg.key][staffId] || {})[day];
    return set ? Object.keys(set).length : 0;
  }
  function readTracker(cfg) {
    var r = S.getSourceKey(cfg.key);
    if (r.value == null) return { missing: true, message: "Chưa có dữ liệu: tracker chưa được mở/nhập file POS trong trình duyệt này (khóa " + cfg.key + ")." };
    var st = parseOrThrow(r.value, cfg.key);
    if (!st || !Array.isArray(st.staffList) || !Array.isArray(st.days)) throw new Error("Cấu trúc tracker không đúng (thiếu staffList/days).");
    var fields = Object.keys(cfg.products), staff = {}, targets = {}, dayTargets = {}, recs = {}, unverified = 0, unverifiedQty = 0;
    st.staffList.forEach(function (s) {
      var emp = S.empId(s.name); staff[s.id] = { emp: emp, name: s.name, role: s.role || "" };
      fields.forEach(function (f) { var pid = cfg.products[f].pid; targets[pid] = targets[pid] || {}; var t = Number(s["target" + f]); if (isFinite(t)) targets[pid][emp] = t; });
    });
    st.days.forEach(function (d) {
      var ds = String(d.dateStr || ""), m = ds.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      var iso = m ? m[3] + "-" + m[2] + "-" + m[1] : cfg.month + "-" + U.pad(d.dd);
      fields.forEach(function (f) {
        var pc = cfg.products[f], pid = pc.pid; dayTargets[pid] = dayTargets[pid] || {};
        var dt = Number(d["target" + f]); if (isFinite(dt)) dayTargets[pid][iso] = dt;
        Object.keys(d.staffDaily || {}).forEach(function (sid) {
          var sd = d.staffDaily[sid] || {}, q = Number(sd["actual" + f]) || 0, rev = Number(sd["revenue" + f]) || 0;
          if (!q && !rev) return;
          var sf = staff[sid]; if (!sf) return;
          var bills = billCount(st, cfg, pc, sid, d.day);
          var id = "PS:" + pid + ":" + sf.emp + ":" + iso;
          recs[id] = { id: id, pid: pid, emp: sf.emp, name: sf.name, date: iso, qty: q, revenue: Math.round(rev), bills: bills, verified: bills > 0, src: cfg.id };
          if (!bills) { unverified++; unverifiedQty += q; }
        });
      });
    });
    var products = {}; fields.forEach(function (f) { var pc = cfg.products[f]; products[pc.pid] = { pid: pc.pid, label: pc.label, unit: pc.unit }; });
    var warns = [];
    if (unverified) warns.push(unverified + " bản ghi (" + unverifiedQty + " SP) không có hóa đơn đi kèm - gắn Chưa xác minh, không cộng vào tổng" + (cfg.sampleRisk ? " (tracker T9 tự sinh số mẫu ngẫu nhiên ngày 1-5)" : ""));
    return { data: { cfg: { id: cfg.id, name: cfg.name, month: cfg.month, priority: cfg.priority }, products: products, staff: staff, targets: targets, dayTargets: dayTargets, recs: recs, totalStoreRevenue: st.totalStoreRevenue || 0 },
      count: Object.keys(recs).length, origin: r.origin, sourceAt: r.at, reconcile: unverified, warnings: warns,
      message: r.at ? "" : "Công cụ chưa ghi thời điểm lưu (mở lại tracker bản có cầu nối để có thời điểm chính xác)" };
  }
  S.PUSH_SOURCES.forEach(function (cfg) {
    S.registerSource({ id: cfg.id, name: cfg.name, group: "Push Sale", tool: cfg.tool, entity: "Kết quả Push Sale theo NV/ngày/SP", keys: [cfg.key],
      how: "Mở tracker và nhập file POS (Excel) như thường lệ.",
      read: function () { return readTracker(cfg); },
      diff: function (a, b, origin) { return S.diffRecords(cfg.id, "Push Sale", a && a.recs, b.recs, ["qty", "revenue", "bills"], origin); } });
  });

  /* ================= 4. DOANH SỐ (ảnh chụp từ Dashboard Sale) ================= */
  S.registerSource({
    id: "SALE", name: "Dashboard Sale (doanh số, Budget)", group: "Doanh số", tool: "SALE_T10", entity: "Doanh số theo ngày/ngành, Budget, % hoàn thành",
    keys: [/^S1016_SNAP_SALE_/], how: "Mở Dashboard Sale tháng (bản có cầu nối) và nạp file bán hàng POS - dashboard tự gửi số liệu.",
    read: function () {
      var months = {}, keys = {}, latestAt = null, origins = {};
      S.raw.keys().forEach(function (k) { if (/^S1016_SNAP_SALE_\d{4}-\d{2}$/.test(k)) keys[k] = 1; });
      Object.keys(S.imports.items).forEach(function (k) { if (/^S1016_SNAP_SALE_\d{4}-\d{2}$/.test(k)) keys[k] = 1; });
      var ks = Object.keys(keys); if (!ks.length) return { missing: true, message: "Chưa có số liệu: mở Dashboard Sale (bản có cầu nối) và nạp file bán hàng." };
      ks.forEach(function (k) {
        var kind = k.replace("S1016_SNAP_", ""), sn = readSnap(kind), p = sn.snap.payload;
        if (!p.month || !Array.isArray(p.byDate)) throw new Error(k + ": thiếu month/byDate.");
        months[p.month] = { month: p.month, at: sn.at, origin: sn.origin, tool: sn.snap.toolName, sourceFile: p.sourceFile, budgetSource: p.budgetSource, budgetBuiltin: p.budgetBuiltin, revenueDef: p.revenueDef, unit: p.unit,
          totals: p.totals, byDate: p.byDate, byCategory: p.byCategory || [], attainment: p.attainment, budgetByDate: p.budgetByDate || {} };
        origins[sn.origin] = 1; if (!latestAt || sn.at > latestAt) latestAt = sn.at;
      });
      var days = {}; Object.keys(months).forEach(function (m) { months[m].byDate.forEach(function (d) { days["SD:" + d.iso] = { id: "SD:" + d.iso, date: d.iso, revenue: d.revenue, bills: d.bills }; }); });
      return { data: { months: months, days: days }, count: Object.keys(days).length, origin: Object.keys(origins).join("+"), sourceAt: latestAt };
    },
    diff: function (a, b, origin) { return S.diffRecords("SALE", "Doanh số ngày", a && a.days, b.days, ["revenue", "bills"], origin); }
  });

  /* ================= 5. KHO & ĐẶT HÀNG (ảnh chụp từ OrderIQ) ================= */
  S.registerSource({
    id: "KHO", name: "OrderIQ - tồn kho & đặt hàng", group: "Kho - Đặt hàng", tool: "ORDERIQ", entity: "Mã cần xử lý, SKU quên đặt, lý do, người phụ trách",
    keys: ["S1016_SNAP_KHO"], how: "Mở OrderIQ (bản có cầu nối); dữ liệu tự gửi sau khi nạp file tồn/PO hoặc cập nhật lý do quên đặt.",
    read: function () {
      var sn = readSnap("KHO"); if (!sn) return { missing: true, message: "Chưa có số liệu: mở OrderIQ (bản có cầu nối) trong trình duyệt này." };
      var p = sn.snap.payload; if (!p.counts || !Array.isArray(p.actionItems)) throw new Error("Ảnh chụp KHO thiếu counts/actionItems.");
      var items = {}; p.actionItems.forEach(function (x) { items["INV:" + x.bc] = Object.assign({ id: "INV:" + x.bc }, x); });
      var fg = {}; if (p.forgot) p.forgot.rows.forEach(function (x) { fg["FG:" + p.forgot.pid + ":" + x.bc] = Object.assign({ id: "FG:" + p.forgot.pid + ":" + x.bc }, x); });
      return { data: { refDate: p.refDate, latestMonth: p.latestMonth, months: p.months, counts: p.counts, items: items, forgot: p.forgot ? { pid: p.forgot.pid, ref: p.forgot.ref, month: p.forgot.month, created: p.forgot.created } : null, forgotRows: fg, user: p.user },
        count: Object.keys(items).length + Object.keys(fg).length, origin: sn.origin, sourceAt: sn.at };
    },
    diff: function (a, b, origin) {
      return S.diffRecords("KHO", "Mã hàng", a && a.items, b.items, ["stock", "rec", "onOrder", "status"], origin)
        .concat(S.diffRecords("KHO", "SKU quên đặt", a && a.forgotRows, b.forgotRows, ["status", "reason", "reasonCode", "owner"], origin));
    }
  });

  /* ================= 6. MẪU CÔNG VIỆC ĐỊNH KỲ (Team Admin) ================= */
  S.registerSource({
    id: "TA", name: "Bảng Điều Khiển Team Admin - việc định kỳ", group: "Vận hành", tool: "TEAM_ADMIN", entity: "Mẫu công việc định kỳ theo vị trí, nhóm nghiệp vụ",
    keys: ["S1016_SNAP_TA_TASKS"], how: "Mở Bảng Điều Khiển Team Admin (bản có cầu nối) - tự gửi lịch việc 75 ngày.",
    read: function () {
      var sn = readSnap("TA_TASKS"), p, origin, at, unver = false, msg = "";
      if (sn) { p = sn.snap.payload; origin = sn.origin; at = sn.at; msg = "Trực tiếp từ Team Admin " + p.from + " → " + p.to; }
      else if (window.S1016_TA_SNAPSHOT) { p = window.S1016_TA_SNAPSHOT; origin = "bundled"; at = p.extractedAt; unver = true; msg = "Bản trích (chạy hàm thật của Team Admin) lúc " + U.hm(p.extractedAt) + ", phủ " + U.dmy(p.from) + " - " + U.dmy(p.to) + ". Mở Team Admin bản có cầu nối để cập nhật trực tiếp."; }
      else return { missing: true };
      if (!p.days) throw new Error("Thiếu danh sách ngày.");
      var procs = Object.assign({}, (window.S1016_TA_SNAPSHOT && window.S1016_TA_SNAPSHOT.procs) || {}, p.procs || {});
      var tpls = {}, occ = {};
      Object.keys(p.days).sort().forEach(function (iso) {
        p.days[iso].forEach(function (x) {
          var tid = S.tplId(x[0], x[1]);
          var t = tpls[tid] || (tpls[tid] = { id: tid, role: x[0], title: S.tplTitle(x[1]), link: x[2], group: (procs[x[2]] && procs[x[2]].g) || S.groupFromLink(x[2]), dates: [] });
          t.dates.push(iso); (occ[iso] = occ[iso] || []).push({ tid: tid, title: x[1] });
        });
      });
      var range = Object.keys(p.days).sort();
      Object.keys(tpls).forEach(function (k) { tpls[k].freq = S.freqOf(tpls[k].dates, range); });
      return { data: { templates: tpls, occ: occ, from: range[0], to: range[range.length - 1], procs: procs }, count: Object.keys(tpls).length, origin: origin, sourceAt: at, unverified: unver, message: msg };
    },
    diff: function (a, b, origin) {
      var A = {}, B = {}; if (a) Object.keys(a.templates).forEach(function (k) { A[k] = { title: a.templates[k].title, role: a.templates[k].role, freq: a.templates[k].freq }; });
      Object.keys(b.templates).forEach(function (k) { B[k] = { title: b.templates[k].title, role: b.templates[k].role, freq: b.templates[k].freq }; });
      return S.diffRecords("TA", "Mẫu công việc", A, B, ["title", "role", "freq"], origin);
    }
  });
  S.tplTitle = function (t) { return String(t).replace(/\s*\((hôm nay)\)/gi, "").trim(); };
  S.tplId = function (role, title) {
    var k = U.normName(title).replace(/\(.*?\)/g, "").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
    return "TA-" + U.hash(role + "|" + k);
  };
  S.groupFromLink = function (l) { if (/^https?:/.test(l || "")) return "Link ngoài"; return { admin: "Việc Admin", chief: "Việc Admin Chief", sc: "Việc SC", svBox: "Chấm điểm dịch vụ" }[l] || "Khác"; };
  S.freqOf = function (dates, range) {
    if (dates.length === range.length) return "Hằng ngày";
    var wd = {}, dm = {}; dates.forEach(function (d) { var x = U.dateOf(d); wd[x.getDay()] = (wd[x.getDay()] || 0) + 1; dm[x.getDate()] = (dm[x.getDate()] || 0) + 1; });
    var wds = Object.keys(wd), dms = Object.keys(dm).map(Number).sort(function (a, b) { return a - b; });
    var totalWd = {}; range.forEach(function (d) { var x = U.dateOf(d).getDay(); totalWd[x] = (totalWd[x] || 0) + 1; });
    if (wds.every(function (w) { return wd[w] >= totalWd[w] * 0.9; })) return "Hằng tuần: " + wds.sort().map(function (w) { return U.WD[w]; }).join(", ");
    if (dms.length <= 3) return "Hằng tháng: ngày " + dms.join(", ");
    if (dms[dms.length - 1] - dms[0] === dms.length - 1) return "Hằng tháng: ngày " + dms[0] + "-" + dms[dms.length - 1];
    if (wds.length <= 2) return "Theo tuần (" + wds.sort().map(function (w) { return U.WD[w]; }).join(", ") + ", có điều kiện)";
    return "Theo quy tắc riêng (" + dates.length + " lần/" + range.length + " ngày)";
  };

  /* ================= 7. BUDGET 2026 (nhúng trong công cụ Lịch) ================= */
  S.registerSource({
    id: "BUDGET", name: "Budget 2026 theo ngày (nhúng trong công cụ Lịch)", group: "Doanh số", tool: "LICH", entity: "Target doanh số ngày, chưa thuế",
    keys: [], mode: "bundled", how: "Chạy lại tools/extract_sources.py khi Budget trong công cụ Lịch thay đổi.",
    read: function () {
      var b = window.S1016_BUDGET_2026; if (!b || !b.byDate) return { missing: true };
      var by = {}; Object.keys(b.byDate).forEach(function (k) { by[k] = b.byDate[k] * 1000; });
      return { data: { byDate: by, unit: "đ, chưa thuế" }, count: Object.keys(by).length, origin: "bundled", sourceAt: b.extractedAt, unverified: true,
        message: "Bản trích tĩnh từ mã nguồn công cụ Lịch lúc " + U.hm(b.extractedAt) + " (đơn vị gốc: nghìn đồng, chưa thuế)." };
    }
  });

  /* ================= 8. NGUỒN CHỈ MỞ LINK / CHỈ NHẬP FILE ================= */
  S.registerSource({ id: "CHECK_TON", name: "CHECK TỒN (Netlify)", group: "Kho - Đặt hàng", mode: "link", entity: "Tra tồn, giá, KM", keys: [], how: "Khác origin (Netlify) - trình duyệt không cho đọc dữ liệu. Mở link để tra cứu.", read: function () { return null; } });
  S.registerSource({ id: "XIN_HANG", name: "Xin hàng các cửa hàng (Netlify)", group: "Kho - Đặt hàng", mode: "link", entity: "Tồn liên cửa hàng", keys: [], how: "Khác origin (Netlify) - chỉ mở link.", read: function () { return null; } });
  S.registerSource({ id: "CHAM_CONG", name: "Check ca & chấm công", group: "Vận hành", mode: "link", entity: "Đối chiếu ca - chấm công", keys: [], how: "Công cụ không lưu dữ liệu (chỉ xử lý file tạm) - chỉ mở link.", read: function () { return null; } });
})();
