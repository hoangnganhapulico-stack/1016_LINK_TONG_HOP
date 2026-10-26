/* =====================================================================
   S1016 MODEL - nghiệp vụ tổng hợp từ dữ liệu chuẩn hóa (không truy cập DOM)
   Mọi con số trả về kèm thông tin nguồn {src, at}.
   ===================================================================== */
(function () {
  "use strict";
  var S = window.S1016, U = S.util, M = S.model = {};
  var ROLE = M.ROLE = { c: "Admin Chief", a: "Admin", s: "SC", all: "Toàn team" };

  /* ---------- Bộ dữ liệu hiện hành: THẬT hoặc DEMO (tách hẳn, không trộn) ---------- */
  M.isDemo = function () { return !!S.state.settings.demoMode; };
  M.ds = function (id) {
    if (M.isDemo()) { var d = S.readJ(S.KEYS.DEMO, null); return d && d.data ? d.data[id] || null : null; }
    return S.data[id] || null;
  };
  M.srcInfo = function (id) {
    if (M.isDemo()) return { id: id, label: "DEMO", at: (S.readJ(S.KEYS.DEMO, {}) || {}).createdAt, demo: true };
    var src = S.sourceById(id), st = S.sync[id] || {}, c = S.cache[id] || {};
    return { id: id, label: src ? src.name : id, at: st.sourceAt || c.sourceAt || st.lastOk, status: st.status, stale: S.isStale(id), origin: st.mode };
  };

  /* ---------- NHÂN SỰ & CA ---------- */
  M.employees = function () {
    var out = {}, l = M.ds("LICH");
    if (l) Object.keys(l.employees).forEach(function (k) { out[k] = U.clone(l.employees[k]); });
    S.PUSH_SOURCES.forEach(function (c) { var p = M.ds(c.id); if (!p) return; Object.keys(p.staff).forEach(function (sid) { var s = p.staff[sid]; if (!out[s.emp]) out[s.emp] = { id: s.emp, name: s.name, pos: s.role, team: "ADMIN", phone: "", onlyPush: true }; }); });
    return out;
  };
  M.shiftsOn = function (iso) {
    var l = M.ds("LICH"); if (!l) return null;
    return Object.keys(l.shifts).filter(function (k) { return l.shifts[k].date === iso; }).map(function (k) { return l.shifts[k]; })
      .sort(function (a, b) { return (a.start == null ? 99 : a.start) - (b.start == null ? 99 : b.start); });
  };
  M.hourNow = function () { var d = U.now(); return d.getHours() + d.getMinutes() / 60; };
  M.isActive = function (sh, iso) {
    if (sh.kind !== "shift" || iso !== U.todayIso()) return false;
    var h = M.hourNow(); return sh.end > 24 ? (h >= sh.start || h < sh.end - 24) : (h >= sh.start && h < sh.end);
  };
  M.currentBucket = function () { var h = M.hourNow(); return h < 6.5 ? "night" : h < 13.5 ? "day" : h < 22.5 ? "evening" : "night"; };
  M.BUCKET = { day: "Ca sáng", evening: "Ca chiều/tối", night: "Ca đêm" };
  M.dayNote = function (iso) { var l = M.ds("LICH"); return l && l.notes ? l.notes[iso] || "" : ""; };
  M.datesWithShifts = function () { var l = M.ds("LICH"); if (!l) return []; var s = {}; Object.keys(l.shifts).forEach(function (k) { s[l.shifts[k].date] = 1; }); return Object.keys(s).sort(); };

  /* ---------- CÔNG VIỆC ---------- */
  M.templates = function () { var t = M.ds("TA"); return t ? t.templates : {}; };
  M.suggestAssignees = function (role, iso) {
    var sh = M.shiftsOn(iso) || [], re = role === "c" ? /chief/i : role === "a" ? /^admin$/i : role === "s" ? /^(sc|cs)\b/i : null;
    if (!re) return [];
    return sh.filter(function (x) { return x.kind === "shift" && re.test(x.pos); }).map(function (x) { return x.name; });
  };
  M.tasksOn = function (iso) {
    var out = [], ov = S.state.taskOverrides, ta = M.ds("TA"), today = U.todayIso();
    if (ta && ta.occ[iso]) ta.occ[iso].forEach(function (o) {
      var t = ta.templates[o.tid], id = "TI:" + iso + ":" + o.tid, x = ov[id] || {};
      out.push(fin({ id: id, date: iso, kind: "template", templateId: o.tid, title: o.title, role: t.role, group: t.group, freq: t.freq, link: t.link, origin: "Team Admin (định kỳ)" }, x));
    });
    var lt = M.ds("LICH_TASKS");
    if (lt) Object.keys(lt.tasks).forEach(function (k) { var t = lt.tasks[k]; if (t.date !== iso) return; var x = ov[t.id] || {};
      out.push(fin({ id: t.id, date: iso, kind: "lich", srcId: t.srcId, title: t.title, role: "", group: "Phát sinh", freq: "Phát sinh", origin: "Công cụ Lịch" + (t.source ? " · " + t.source : ""), assignee: t.assignee, status: t.done ? "done" : "todo", srcDone: t.done }, x, true)); });
    if (!M.isDemo()) Object.keys(S.state.adhocTasks).forEach(function (k) { var t = S.state.adhocTasks[k]; if (t.date !== iso || t.deleted) return; out.push(fin(U.clone(t), {})); });
    else { var dd = M.ds("ADHOC"); if (dd) Object.keys(dd).forEach(function (k) { if (dd[k].date === iso) out.push(fin(U.clone(dd[k]), {})); }); }
    function fin(base, x, lichMode) {
      var t = Object.assign({ priority: "Bình thường", status: "todo", assignee: "", helper: "", checker: "", due: "22:30", result: "", reason: "", desc: "" }, base);
      Object.keys(x).forEach(function (k) { if (["status", "assignee", "helper", "checker", "priority", "due", "result", "reason", "desc", "movedTo", "updatedAt", "updatedBy"].indexOf(k) >= 0) {
        if (lichMode && k === "status" && x.status !== "done" && base.srcDone) return; // nguồn đã tick xong thì ưu tiên nguồn
        t[k] = x[k]; } });
      if (lichMode && base.srcDone) t.status = "done";
      var dueAt = iso + "T" + (t.due || "23:59");
      t.overdue = ["done", "moved", "cancelled"].indexOf(t.status) < 0 && (iso < today || (iso === today && U.now() > new Date(dueAt)));
      t.unassigned = !t.assignee;
      return t;
    }
    return out;
  };
  M.STATUS = { todo: "Chưa làm", doing: "Đang làm", done: "Hoàn thành", blocked: "Tồn đọng", moved: "Đã chuyển", cancelled: "Hủy" };
  M.taskStats = function (list) {
    var s = { total: 0, done: 0, doing: 0, overdue: 0, unassigned: 0, blocked: 0 };
    list.forEach(function (t) { if (t.status === "moved" || t.status === "cancelled") return; s.total++; if (t.status === "done") s.done++; if (t.status === "doing") s.doing++; if (t.status === "blocked") s.blocked++; if (t.overdue) s.overdue++; if (t.unassigned && t.status !== "done") s.unassigned++; });
    return s;
  };
  /* Cập nhật 1 công việc - mẫu định kỳ không bao giờ bị sửa, chỉ lưu theo từng lần thực hiện */
  M.updateTask = function (task, patch) {
    if (M.isDemo()) return { ok: false, error: "Đang ở chế độ DEMO - thao tác không lưu vào dữ liệu thật." };
    var target, isAdhoc = task.kind === "adhoc";
    if (isAdhoc) target = S.state.adhocTasks[task.id]; else target = S.state.taskOverrides[task.id] = S.state.taskOverrides[task.id] || {};
    if (!target) return { ok: false, error: "Không tìm thấy công việc." };
    if (task.kind === "lich" && patch.status !== undefined && S.state.settings.writeBackLich && (patch.status === "done" || task.status === "done")) {
      var wb = S.writeBackLichTask({ id: task.id, srcId: task.srcId, date: task.date, title: task.title, done: task.srcDone }, patch.status === "done");
      if (!wb.ok) return wb;
    }
    Object.keys(patch).forEach(function (k) { var old = isAdhoc ? target[k] : (target[k] !== undefined ? target[k] : task[k]); if (U.stable(old) !== U.stable(patch[k])) { S.userAction("Công việc", task.id, k, old == null ? "" : old, patch[k], task.title); target[k] = patch[k]; } });
    target.updatedAt = U.nowIso(); target.updatedBy = S.state.settings.user || "";
    S.saveState("task"); return { ok: true };
  };
  M.addAdhoc = function (o) {
    if (M.isDemo()) return { ok: false, error: "Đang ở chế độ DEMO." };
    if (!o.title || !o.title.trim()) return { ok: false, error: "Nhập tên công việc." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || "")) return { ok: false, error: "Ngày không hợp lệ." };
    var id = U.uid("AH");
    S.state.adhocTasks[id] = { id: id, kind: "adhoc", date: o.date, title: o.title.trim(), desc: o.desc || "", role: o.role || "", group: o.group || "Phát sinh", freq: "Phát sinh", origin: "Trợ lý (đột xuất)",
      assignee: o.assignee || "", helper: o.helper || "", checker: o.checker || "", priority: o.priority || "Bình thường", due: o.due || "22:30", status: "todo", result: "", reason: "", carriedFrom: o.carriedFrom || "", createdAt: U.nowIso(), createdBy: S.state.settings.user || "" };
    S.userAction("Công việc", id, "(tạo mới)", "", o.title.trim(), o.carriedFrom ? "chuyển từ " + o.carriedFrom : "đột xuất");
    S.saveState("task"); return { ok: true, id: id };
  };
  M.carryOver = function (task) {
    if (task.status === "done") return { ok: false, error: "Công việc đã hoàn thành." };
    var next = U.addDays(task.date, 1);
    var r = M.addAdhoc({ date: next, title: task.title, desc: task.desc, role: task.role, group: task.group, assignee: task.assignee, helper: task.helper, checker: task.checker, priority: task.priority, due: task.due, carriedFrom: task.id });
    if (!r.ok) return r;
    M.updateTask(task, { status: "moved", movedTo: r.id, reason: task.reason || "Chuyển sang " + U.dmy(next) });
    return r;
  };

  /* ---------- PUSH SALE: gộp các tracker, chống cộng trùng ---------- */
  M.pushMonths = function () { var s = {}; S.PUSH_SOURCES.forEach(function (c) { if (M.ds(c.id)) s[c.month] = 1; }); return Object.keys(s).sort().reverse(); };
  M.pushMerged = function (month) {
    var srcs = S.PUSH_SOURCES.filter(function (c) { return c.month === month && M.ds(c.id); }).sort(function (a, b) { return b.priority - a.priority; });
    var products = {}, staff = {}, targets = {}, dayTargets = {}, recs = {}, conflicts = [], unverified = [], used = [];
    srcs.forEach(function (c) {
      var d = M.ds(c.id); used.push({ id: c.id, name: c.name, info: M.srcInfo(c.id) });
      Object.keys(d.products).forEach(function (pid) {
        if (!products[pid]) { products[pid] = U.clone(d.products[pid]); products[pid].src = c.id; targets[pid] = U.clone(d.targets[pid] || {}); dayTargets[pid] = U.clone(d.dayTargets[pid] || {}); }
      });
      Object.keys(d.staff).forEach(function (sid) { var s = d.staff[sid]; if (!staff[s.emp]) staff[s.emp] = { emp: s.emp, name: s.name, role: s.role }; });
      Object.keys(d.recs).forEach(function (id) {
        var r = d.recs[id]; if (r.date.slice(0, 7) !== month) return;
        if (!r.verified) { unverified.push(r); return; }
        var ex = recs[id];
        if (!ex) recs[id] = r;
        else if (ex.qty !== r.qty) conflicts.push({ id: id, pid: r.pid, name: r.name, date: r.date, kept: ex.src, keptQty: ex.qty, other: r.src, otherQty: r.qty });
      });
    });
    return { month: month, products: products, staff: staff, targets: targets, dayTargets: dayTargets, recs: recs, conflicts: conflicts, unverified: unverified, sources: used };
  };
  M.pushSummary = function (pm, upto, onlyDay) {
    var rows = {}, team = {};
    Object.keys(pm.products).forEach(function (pid) { team[pid] = { target: 0, actual: 0, revenue: 0, dayTarget: 0 };
      Object.keys(pm.targets[pid] || {}).forEach(function (emp) { team[pid].target += pm.targets[pid][emp] || 0; });
      Object.keys(pm.dayTargets[pid] || {}).forEach(function (iso) { if (onlyDay ? iso === onlyDay : (!upto || iso <= upto)) team[pid].dayTarget += pm.dayTargets[pid][iso] || 0; });
    });
    Object.keys(pm.staff).forEach(function (emp) { rows[emp] = { emp: emp, name: pm.staff[emp].name, role: pm.staff[emp].role, p: {} };
      Object.keys(pm.products).forEach(function (pid) { var t = pm.targets[pid] ? pm.targets[pid][emp] : undefined; rows[emp].p[pid] = { target: t == null ? null : t, actual: 0, revenue: 0 }; }); });
    Object.keys(pm.recs).forEach(function (id) { var r = pm.recs[id];
      if (onlyDay ? r.date !== onlyDay : (upto && r.date > upto)) return;
      if (!rows[r.emp]) rows[r.emp] = { emp: r.emp, name: r.name, role: "", p: {} };
      var c = rows[r.emp].p[r.pid] = rows[r.emp].p[r.pid] || { target: null, actual: 0, revenue: 0 };
      c.actual += r.qty; c.revenue += r.revenue; if (team[r.pid]) { team[r.pid].actual += r.qty; team[r.pid].revenue += r.revenue; } });
    return { rows: rows, team: team };
  };
  M.pushByDate = function (pm, pid) { var out = {}; Object.keys(pm.recs).forEach(function (id) { var r = pm.recs[id]; if (r.pid !== pid) return; out[r.date] = (out[r.date] || 0) + r.qty; }); return out; };

  /* ---------- DOANH SỐ ---------- */
  M.saleMonths = function () { var s = M.ds("SALE"); return s ? Object.keys(s.months).sort().reverse() : []; };
  M.sale = function (month) { var s = M.ds("SALE"); return s && s.months[month] ? s.months[month] : null; };
  M.budgetDay = function (iso) { var b = M.ds("BUDGET"); return b && b.byDate[iso] != null ? b.byDate[iso] : null; };
  M.budgetMonth = function (ym) { var b = M.ds("BUDGET"); if (!b) return null; var t = 0, n = 0; Object.keys(b.byDate).forEach(function (k) { if (k.slice(0, 7) === ym) { t += b.byDate[k]; n++; } }); return n ? t : null; };
  M.saleDay = function (iso) { var s = M.sale(iso.slice(0, 7)); if (!s) return null; return s.byDate.filter(function (d) { return d.iso === iso; })[0] || null; };
  M.saleMilestones = function (s) {
    if (!s || !s.attainment || s.attainment.monthTarget == null) return null;
    var a = s.attainment, remain = a.monthTarget - a.mtdActual;
    return { remain: remain, perDay: a.daysRemaining > 0 ? remain / a.daysRemaining : null, daysRemaining: a.daysRemaining };
  };

  /* ---------- KHO ---------- */
  M.kho = function () { return M.ds("KHO"); };

  /* ---------- TỔNG QUAN ---------- */
  M.overview = function (iso) {
    var sh = M.shiftsOn(iso), tasks = M.tasksOn(iso), ts = M.taskStats(tasks), month = iso.slice(0, 7);
    var pm = M.pushMerged(month), pday = M.pushSummary(pm, null, iso), pmtd = M.pushSummary(pm, iso);
    return { shifts: sh, tasks: tasks, taskStats: ts, push: { pm: pm, day: pday, mtd: pmtd }, sale: M.sale(month), saleDay: M.saleDay(iso), budgetDay: M.budgetDay(iso), kho: M.kho(), note: M.dayNote(iso) };
  };

  /* ---------- NHẬT KÝ CUỐI NGÀY ---------- */
  M.journalDraft = function (iso) {
    var o = M.overview(iso), L = [], src = {};
    function S_(id) { var i = M.srcInfo(id); src[id] = i; return "[" + (i.demo ? "DEMO" : i.label) + (i.at ? " · " + U.hm(i.at) : "") + "]"; }
    var sec = {};
    // 1 nhân sự
    if (o.shifts) {
      var on = o.shifts.filter(function (s) { return s.kind === "shift"; }), off = o.shifts.filter(function (s) { return s.kind !== "shift"; });
      var by = {}; on.forEach(function (s) { (by[s.bucket] = by[s.bucket] || []).push(s.name + " (" + s.raw + ")"); });
      sec.staff = Object.keys(by).map(function (b) { return M.BUCKET[b] + ": " + by[b].join(", "); }).join("\n") + (off.length ? "\nNghỉ: " + off.map(function (s) { return s.name + " (" + s.raw + ")"; }).join(", ") : "") + "\n" + S_("LICH");
    } else sec.staff = "Chưa có dữ liệu lịch ca.";
    // 2-3 công việc
    var done = o.tasks.filter(function (t) { return t.status === "done"; }), notDone = o.tasks.filter(function (t) { return ["done", "moved", "cancelled"].indexOf(t.status) < 0; });
    sec.done = done.length ? done.map(function (t) { return "- " + t.title + (t.assignee ? " (" + t.assignee + ")" : "") + (t.result ? ": " + t.result : ""); }).join("\n") : "Chưa ghi nhận công việc hoàn thành.";
    sec.notDone = notDone.length ? notDone.map(function (t) { return "- " + t.title + (t.assignee ? " (" + t.assignee + ")" : " (chưa phân công)") + " - Lý do: " + (t.reason || "chưa ghi"); }).join("\n") : "Không có công việc tồn.";
    // 4 push
    var pl = [];
    Object.keys(o.push.pm.products).forEach(function (pid) { var p = o.push.pm.products[pid], d = o.push.day.team[pid], m = o.push.mtd.team[pid];
      pl.push("- " + p.label + ": hôm nay " + U.fmt1(d.actual) + "/" + U.fmt1(d.dayTarget) + " " + p.unit + " · lũy kế " + U.fmt1(m.actual) + "/" + U.fmt1(m.target) + " (" + U.fmtPct(U.pct(m.actual, m.target)) + ")"); });
    sec.push = pl.length ? pl.join("\n") + "\n" + o.push.pm.sources.map(function (s) { return S_(s.id); }).join(" ") : "Chưa có dữ liệu Push Sale cho tháng này.";
    if (o.push.pm.unverified.length) sec.push += "\n(" + o.push.pm.unverified.length + " bản ghi chưa xác minh - không tính)";
    // 5 sale
    if (o.saleDay) sec.sale = "Doanh số ngày (chưa thuế): " + U.fmtVnd(o.saleDay.revenue) + " · " + o.saleDay.bills + " bill" + (o.sale.budgetByDate[iso] ? " · Budget ngày " + U.fmtVnd(o.sale.budgetByDate[iso]) + " (" + U.fmtPct(U.pct(o.saleDay.revenue, o.sale.budgetByDate[iso])) + ")" : "") +
      (o.sale.attainment ? "\nLũy kế tháng: " + U.fmtVnd(o.sale.attainment.mtdActual) + " / " + U.fmtVnd(o.sale.attainment.mtdTarget) + " (" + U.fmtPct(o.sale.attainment.attainmentPct) + ")" : "") + "\n" + S_("SALE");
    else sec.sale = "Chưa có doanh số ngày " + U.dmy(iso) + " từ Dashboard Sale." + (o.budgetDay ? " Budget ngày: " + U.fmtVnd(o.budgetDay) + " " + S_("BUDGET") : "");
    // 6 kho
    if (o.kho) { var k = o.kho, fgRows = Object.keys(k.forgotRows).map(function (x) { return k.forgotRows[x]; }), noReason = fgRows.filter(function (r) { return !r.reason && !r.reasonCode; });
      sec.kho = "Hết hàng: " + k.counts.oos + " · Sắp hết: " + k.counts.low + " · Đề xuất đặt: " + k.counts.recPositive + " mã" + (k.forgot ? "\nSKU quên đặt kỳ " + U.dmy(k.forgot.ref.slice(0, 4) + "-" + k.forgot.ref.slice(4, 6) + "-" + k.forgot.ref.slice(6, 8)) + ": " + fgRows.length + " mã, " + noReason.length + " mã chưa có lý do" : "") + "\n" + S_("KHO"); }
    else sec.kho = "Chưa có dữ liệu OrderIQ.";
    sec.issues = ""; sec.handover = notDone.filter(function (t) { return t.status !== "moved"; }).map(function (t) { return "- " + t.title; }).join("\n");
    // 9 ngày mai
    var next = U.addDays(iso, 1), nt = M.tasksOn(next), nsh = M.shiftsOn(next);
    sec.tomorrow = (nsh ? "Ca ngày " + U.dmy(next) + ": " + nsh.filter(function (s) { return s.kind === "shift"; }).map(function (s) { return s.name + " " + s.raw; }).join(", ") + "\n" : "") +
      (nt.length ? nt.map(function (t) { return "- " + t.title + (t.assignee ? " → " + t.assignee : (M.suggestAssignees(t.role, next).length ? " → gợi ý: " + M.suggestAssignees(t.role, next).join("/") : "")); }).join("\n") : "Không có công việc định kỳ.");
    var metrics = { taskStats: o.taskStats, push: o.push.mtd.team, saleDay: o.saleDay, saleAtt: o.sale ? o.sale.attainment : null, kho: o.kho ? o.kho.counts : null };
    return { date: iso, sections: sec, metrics: metrics, sources: src };
  };
  M.JOURNAL_SECTIONS = [["staff", "1. Nhân sự & ca làm"], ["done", "2. Công việc đã hoàn thành"], ["notDone", "3. Công việc chưa hoàn thành & lý do"], ["push", "4. Kết quả Push Sale"], ["sale", "5. Kết quả Sale"], ["kho", "6. Cảnh báo tồn kho & đặt hàng"], ["issues", "7. Vấn đề phát sinh"], ["handover", "8. Nội dung cần bàn giao"], ["tomorrow", "9. Kế hoạch & người phụ trách ngày tiếp theo"]];
  M.saveJournalDraft = function (iso, sections, base) {
    if (M.isDemo()) return { ok: false, error: "Chế độ DEMO - không lưu nhật ký." };
    var id = "J:" + iso, cur = S.state.journals[id];
    if (cur && cur.status === "confirmed") return { ok: false, error: "Nhật ký ngày này đã xác nhận chính thức. Tạo bản chỉnh sửa mới nếu cần." };
    S.state.journals[id] = { id: id, date: iso, status: "draft", sections: sections, metrics: base.metrics, sources: base.sources, createdAt: (cur && cur.createdAt) || U.nowIso(), updatedAt: U.nowIso(), by: S.state.settings.user || "" };
    S.saveState("journal"); S.userAction("Nhật ký", id, "bản nháp", "", "lưu bản nháp"); return { ok: true };
  };
  M.confirmJournal = function (iso, who) {
    if (M.isDemo()) return { ok: false, error: "Chế độ DEMO - không xác nhận nhật ký chính thức." };
    var id = "J:" + iso, j = S.state.journals[id];
    if (!j) return { ok: false, error: "Chưa có bản nháp." };
    if (!who || !who.trim()) return { ok: false, error: "Nhập tên người xác nhận." };
    var demoSrc = Object.keys(j.sources || {}).some(function (k) { return j.sources[k].demo; });
    if (demoSrc) return { ok: false, error: "Bản nháp có số liệu DEMO - không thể xác nhận." };
    j.status = "confirmed"; j.confirmedAt = U.nowIso(); j.confirmedBy = who.trim();
    S.saveState("journal"); S.userAction("Nhật ký", id, "trạng thái", "Bản nháp", "Đã xác nhận bởi " + who.trim()); return { ok: true };
  };
})();
