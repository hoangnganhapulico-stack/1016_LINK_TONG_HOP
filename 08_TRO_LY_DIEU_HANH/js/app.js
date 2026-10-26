/* =====================================================================
   S1016 APP - giao diện 10 module. Chỉ đọc qua S1016.model / S1016.sync.
   ===================================================================== */
(function () {
  "use strict";
  var S = window.S1016, U = S.util, M = S.model, E = U.esc;
  var $ = function (id) { return document.getElementById(id); };
  var UI = S.ui = { tab: "ov", date: U.todayIso(), calView: "month", tf: { status: "", role: "", who: "", q: "" }, taskView: "list", open: {}, pushMonth: "", pushScope: "mtd", saleMonth: "", khoTab: "action", khoQ: "", khoSt: "", histQ: "", histSrc: "", srcOpen: {} };
  try { var saved = JSON.parse(localStorage.getItem("S1016_A_UI") || "{}"); if (saved.tab) UI.tab = saved.tab; if (saved.calView) UI.calView = saved.calView; } catch (e) {}
  function saveUI() { try { localStorage.setItem("S1016_A_UI", JSON.stringify({ tab: UI.tab, calView: UI.calView })); } catch (e) {} }

  /* ---------- tiện ích giao diện ---------- */
  function toast(msg, kind) { var t = $("toast"); t.className = "toast " + (kind || ""); t.textContent = msg; t.style.display = "block"; clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = "none"; }, kind === "bad" ? 6000 : 3200); }
  UI.toast = toast;
  function srcTag(id, extra) {
    var i = M.srcInfo(id);
    if (i.demo) return '<span class="src demo">DEMO - dữ liệu minh họa</span>';
    var st = S.sync[id] || {};
    if (i.stale) return '<span class="src stale">⚠ Nguồn lỗi - đang hiện dữ liệu cũ từ ' + U.hm(st.staleFrom) + ' · ' + E(i.label) + '</span>';
    return '<span class="src">Nguồn: ' + E(i.label) + (i.at ? " · " + U.hm(i.at) : "") + (i.origin === "import" ? " · gói nhập" : i.origin === "bundled" ? " · bản trích tĩnh" : "") + (extra ? " · " + extra : "") + "</span>";
  }
  function none(msg) { return '<div class="empty">' + E(msg || "Chưa có dữ liệu") + "</div>"; }
  function kpi(label, val, desc, src, isNone) { return '<div class="card kpi"><div class="l">' + E(label) + '</div><div class="v' + (isNone ? " none" : "") + '">' + val + '</div><div class="d">' + (desc || "") + "</div>" + (src || "") + "</div>"; }
  function bar(p) { if (p == null) return ""; var c = p >= 100 ? "ok" : p >= 70 ? "" : p >= 40 ? "warn" : "bad"; return '<div class="bar"><i class="' + c + '" style="width:' + Math.min(100, Math.max(0, p)) + '%"></i></div>'; }
  function head(n, title, lead) { return '<div class="sec-head"><span class="num">' + n + '</span><h2>' + E(title) + "</h2></div>" + (lead ? '<p class="lead">' + lead + "</p>" : ""); }
  function statusTag(st) { var m = { ok: "ok", unverified: "warn", fail: "bad", syncing: "grey", notConfigured: "grey", fileOnly: "grey", linkOnly: "grey", connected: "ok" }; return '<span class="tag ' + (m[st] || "grey") + '">' + E(S.STATUS[st] || st || "Chưa xác minh") + "</span>"; }
  function sel(id, opts, cur, attrs) { return '<select id="' + id + '" ' + (attrs || "") + ">" + opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + E(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + E(l) + "</option>"; }).join("") + "</select>"; }
  function ymLabel(ym) { return "Tháng " + (+ym.slice(5)) + "/" + ym.slice(0, 4); }
  function ymd8(k) { return k && k.length >= 8 ? k.slice(0, 4) + "-" + k.slice(4, 6) + "-" + k.slice(6, 8) : ""; }
  function fileStamp() { var d = U.now(); return U.pad(d.getDate()) + "-" + U.pad(d.getMonth() + 1) + "-" + d.getFullYear(); }
  function nowStamp() { var d = U.now(); return U.pad(d.getHours()) + ":" + U.pad(d.getMinutes()) + " " + fileStamp().replace(/-/g, "/"); }

  /* ---------- HERO + THANH TRẠNG THÁI ---------- */
  function renderHero() {
    document.body.classList.toggle("demo", M.isDemo());
    var cnt = { ok: 0, fail: 0, notConfigured: 0, unverified: 0 };
    S.sources.forEach(function (s) { var st = (S.sync[s.id] || {}).status; if (cnt[st] != null) cnt[st]++; });
    var d = U.dateOf(UI.date);
    $("heroChips").innerHTML = '<span class="chip">' + U.WDF[d.getDay()] + ", " + U.dmy(UI.date) + "</span>" +
      (UI.date === U.todayIso() ? '<span class="chip">' + M.BUCKET[M.currentBucket()] + " đang diễn ra</span>" : "") +
      '<span class="chip ok">' + cnt.ok + " nguồn đồng bộ</span>" + (cnt.fail ? '<span class="chip bad">' + cnt.fail + " nguồn lỗi</span>" : "") +
      (cnt.unverified ? '<span class="chip warn">' + cnt.unverified + " nguồn chưa xác minh</span>" : "") + (cnt.notConfigured ? '<span class="chip">' + cnt.notConfigured + " chưa có dữ liệu</span>" : "") +
      (M.isDemo() ? '<span class="chip bad">DEMO</span>' : "");
    var syncing = S.sources.some(function (s) { return (S.sync[s.id] || {}).status === "syncing"; });
    $("syncPill").className = "tag " + (syncing ? "grey" : cnt.fail ? "bad" : "ok");
    $("syncPill").textContent = syncing ? "Đang đồng bộ..." : (cnt.fail ? cnt.fail + " nguồn lỗi" : "Đã đọc nguồn lúc " + U.hm(U.nowIso()).slice(0, 5));
    $("selDate").value = UI.date;
    var ow = $("originWarn"), ONLINE = "https://hoangnganhapulico-stack.github.io/1016_LINK_TONG_HOP/08_TRO_LY_DIEU_HANH/";
    if (location.protocol === "file:" && ow) {
      ow.style.display = "block";
      ow.innerHTML = "<b>Đang mở Trợ lý từ file trên máy.</b> Trang chủ mở Lịch làm việc, OrderIQ, Team Admin bằng link GitHub nên dữ liệu được lưu ở trang online - Trợ lý mở từ file không đọc được dữ liệu đó. " +
        '<a class="btn sm" style="text-decoration:none;display:inline-block;margin-top:4px" href="' + ONLINE + '">Mở Trợ lý bản online</a>';
    }
  }

  /* =================== 1. TỔNG QUAN =================== */
  function renderOv() {
    var iso = UI.date, o = M.overview(iso), h = head(1, "Tổng quan điều hành", "Ngày " + U.dmy(iso) + (o.note ? ' · <b style="color:var(--kred)">📌 ' + E(o.note) + "</b>" : "") + " - mỗi số liệu ghi rõ nguồn.");
    var k = [];
    // nhân sự
    if (o.shifts) {
      var on = o.shifts.filter(function (s) { return s.kind === "shift"; }), act = on.filter(function (s) { return M.isActive(s, iso); });
      k.push(kpi("Nhân sự trong ngày", on.length + " người", (iso === U.todayIso() ? act.length + " người đang trong ca · " : "") + o.shifts.filter(function (s) { return s.kind !== "shift"; }).length + " nghỉ", srcTag("LICH")));
    } else k.push(kpi("Nhân sự trong ngày", "Chưa có dữ liệu", "Mở công cụ Lịch làm việc (bản có cầu nối)", srcTag("LICH"), true));
    var ts = o.taskStats;
    k.push(kpi("Công việc", ts.done + "/" + ts.total, ts.doing + " đang làm · <b style='color:var(--bad)'>" + ts.overdue + " quá hạn</b> · " + ts.unassigned + " chưa phân công", srcTag("TA")));
    // push
    var pp = Object.keys(o.push.pm.products);
    if (pp.length) {
      var pd = pp.map(function (pid) { var p = o.push.pm.products[pid], d = o.push.day.team[pid], m = o.push.mtd.team[pid]; return "<b>" + E(p.label) + "</b>: hôm nay " + U.fmt1(d.actual) + "/" + U.fmt1(d.dayTarget) + " · lũy kế " + U.fmt1(m.actual) + "/" + U.fmtInt(m.target) + " (" + U.fmtPct(U.pct(m.actual, m.target)) + ")"; }).join("<br>");
      var p0 = o.push.mtd.team[pp[0]];
      k.push(kpi("Push Sale " + ymLabel(iso.slice(0, 7)), U.fmtPct(U.pct(p0.actual, p0.target)), pd, o.push.pm.sources.map(function (s) { return srcTag(s.id); }).join("<br>")));
    } else k.push(kpi("Push Sale", "Chưa có dữ liệu", "Chưa có tracker nào của tháng này trong trình duyệt", "", true));
    // sale
    if (o.saleDay) k.push(kpi("Doanh số ngày (chưa thuế)", U.fmtM(o.saleDay.revenue), (o.sale.budgetByDate[iso] ? "Budget " + U.fmtM(o.sale.budgetByDate[iso]) + " · đạt " + U.fmtPct(U.pct(o.saleDay.revenue, o.sale.budgetByDate[iso])) : "") + (o.sale.attainment ? "<br>Lũy kế tháng " + U.fmtPct(o.sale.attainment.attainmentPct) + " Budget đến " + U.dmy(o.sale.attainment.dateMax || o.sale.totals.dateMax) : ""), srcTag("SALE")));
    else k.push(kpi("Doanh số ngày", "Chưa có dữ liệu", (o.budgetDay != null ? "Budget ngày (chưa thuế): <b>" + U.fmtVnd(o.budgetDay) + "</b><br>" + srcTag("BUDGET") : "") + (o.sale ? "<br>Dashboard Sale đã có số đến " + U.dmy(o.sale.totals.dateMax) : ""), o.sale ? srcTag("SALE") : "", true));
    // kho
    if (o.kho) k.push(kpi("Kho & đặt hàng", o.kho.counts.oos + " hết · " + o.kho.counts.low + " sắp hết", o.kho.counts.recPositive + " mã đề xuất đặt · tồn tháng " + E(o.kho.latestMonth) + (o.kho.forgot ? " · " + Object.keys(o.kho.forgotRows).length + " SKU quên đặt cần giải trình" : ""), srcTag("KHO")));
    else k.push(kpi("Kho & đặt hàng", "Chưa có dữ liệu", "Mở OrderIQ (bản có cầu nối)", srcTag("KHO"), true));
    h += '<div class="grid">' + k.join("") + "</div>";
    // nhân sự đang làm
    var staffHtml = none("Chưa có lịch ca cho ngày này.");
    if (o.shifts && o.shifts.length) {
      var groups = { day: [], evening: [], night: [], off: [] };
      o.shifts.forEach(function (s) { (s.kind === "shift" ? groups[s.bucket] : groups.off).push(s); });
      staffHtml = ["day", "evening", "night", "off"].filter(function (b) { return groups[b].length; }).map(function (b) {
        return '<div style="margin-bottom:8px"><b class="small" style="color:var(--navy)">' + (b === "off" ? "Nghỉ" : M.BUCKET[b]) + " · " + groups[b].length + "</b><br>" + groups[b].map(function (s) { return '<span class="tag ' + (b === "off" ? "grey" : "") + '" style="margin:2px 3px 0 0">' + E(s.name) + " · " + E(s.raw) + (M.isActive(s, iso) ? " ●" : "") + "</span>"; }).join("") + "</div>";
      }).join("");
    }
    // cảnh báo
    var al = [];
    S.sources.forEach(function (s) { var st = S.sync[s.id] || {}; if (st.status === "fail") al.push('<div class="badbox">Nguồn <b>' + E(s.name) + "</b> đồng bộ thất bại: " + E(st.lastError || "") + (S.data[s.id] ? " - đang hiện dữ liệu cũ." : "") + "</div>"); });
    o.tasks.filter(function (t) { return t.overdue; }).slice(0, 8).forEach(function (t) { al.push('<div class="badbox">Quá hạn: <b>' + E(t.title) + "</b>" + (t.assignee ? " - " + E(t.assignee) : " - chưa phân công") + "</div>"); });
    var offSet = {}; (o.shifts || []).forEach(function (s) { if (s.kind !== "shift") offSet[U.normName(s.name)] = s.raw; });
    o.tasks.forEach(function (t) { if (t.assignee && offSet[U.normName(t.assignee)] && t.status !== "done") al.push('<div class="warnbox">Phân công chồng chéo: <b>' + E(t.title) + "</b> giao cho " + E(t.assignee) + " nhưng người này " + E(offSet[U.normName(t.assignee)]) + " ngày " + U.dm(iso) + ".</div>"); });
    if (ts.unassigned) al.push('<div class="warnbox">' + ts.unassigned + ' công việc chưa phân công. <button class="btn sm" data-act="goto" data-tab="task">Phân công</button></div>');
    if (o.push.pm.conflicts.length) al.push('<div class="warnbox">' + o.push.pm.conflicts.length + " kết quả Push Sale lệch giữa các tracker - xem mục Push Sale.</div>");
    if (o.kho && o.kho.forgot) { var nr = Object.keys(o.kho.forgotRows).filter(function (x) { var r = o.kho.forgotRows[x]; return !r.reason && !r.reasonCode; }).length; if (nr) al.push('<div class="warnbox">' + nr + " SKU quên đặt chưa có lý do giải trình (OrderIQ).</div>"); }
    var hand = o.tasks.filter(function (t) { return ["done", "moved", "cancelled"].indexOf(t.status) < 0; });
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h3 style="margin-top:0">Nhân sự theo ca</h3>' + staffHtml + srcTag("LICH") + '</div><div class="card"><h3 style="margin-top:0">Cảnh báo & việc cần xử lý</h3>' + (al.join("") || '<div class="empty">Không có cảnh báo.</div>') + "</div></div>";
    h += '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Vấn đề chưa giải quyết & nội dung cần bàn giao (' + hand.length + ')</h3>' + (hand.length ? '<div class="tbl"><table><thead><tr><th>Công việc</th><th>Phụ trách</th><th>Trạng thái</th><th>Lý do</th></tr></thead><tbody>' +
      hand.map(function (t) { return "<tr><td>" + E(t.title) + "</td><td>" + (t.assignee ? E(t.assignee) : '<span class="tag warn">Chưa phân công</span>') + "</td><td>" + (t.overdue ? '<span class="tag bad">Quá hạn</span> ' : "") + E(M.STATUS[t.status]) + "</td><td>" + E(t.reason || "-") + "</td></tr>"; }).join("") + "</tbody></table></div>" : none("Không có việc tồn.")) + "</div>";
    $("m-ov").innerHTML = h;
  }

  /* =================== 2. LỊCH & NHÂN SỰ =================== */
  function shiftCls(s) { return s.kind === "shift" ? (s.bucket === "evening" ? "bad" : s.bucket === "night" ? "" : "ok") : "grey"; }
  function renderCal() {
    var h = head(2, "Lịch tháng & nhân sự trong ca", "Lịch ca đọc từ công cụ Lịch làm việc; sự kiện ngày lấy từ dòng ghi chú trong file lịch.");
    h += '<div class="tabs">' + [["month", "Tháng"], ["week", "Tuần"], ["day", "Ngày"]].map(function (v) { return '<button class="tab' + (UI.calView === v[0] ? " on" : "") + '" data-act="calview" data-v="' + v[0] + '">' + v[1] + "</button>"; }).join("") + "</div>";
    var l = M.ds("LICH");
    if (!l) { $("m-cal").innerHTML = h + '<div class="card">' + none((S.sync.LICH || {}).message || "Chưa có dữ liệu lịch ca.") + srcTag("LICH") + "</div>"; return; }
    var emps = M.employees(), iso = UI.date;
    if (UI.calView === "month") {
      var d0 = U.dateOf(iso.slice(0, 7) + "-01"), start = U.addDays(U.isoOf(d0), -((d0.getDay() + 6) % 7)), cells = [];
      var ta = M.ds("TA");
      for (var i = 0; i < 42; i++) {
        var di = U.addDays(start, i), sh = M.shiftsOn(di) || [], on = sh.filter(function (s) { return s.kind === "shift"; });
        var ad = on.filter(function (s) { return s.team === "ADMIN"; }).length, sa = on.filter(function (s) { return s.team === "SALES"; }).length;
        var tn = ta && ta.occ[di] ? ta.occ[di].length : 0, note = M.dayNote(di);
        cells.push('<div class="d' + (di.slice(0, 7) !== iso.slice(0, 7) ? " out" : "") + (di === iso ? " sel" : "") + (di === U.todayIso() ? " today" : "") + '" data-act="pickday" data-d="' + di + '"><b>' + (+di.slice(8)) + "</b> <span class='muted'>" + U.WD[U.dateOf(di).getDay()] + "</span>" + (note ? '<span class="ev" title="' + E(note) + '">' + E(note) + "</span>" : "") +
          (sh.length ? '<span class="x">Admin ' + ad + " · Sale " + sa + "</span><br>" : "") + (tn ? '<span class="x muted">' + tn + " việc định kỳ</span>" : "") + "</div>");
      }
      h += '<div class="card"><div class="cal">' + ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(function (x) { return '<div class="h">' + x + "</div>"; }).join("") + cells.join("") + "</div>" + srcTag("LICH") + "</div>";
    } else if (UI.calView === "week") {
      var dw = U.dateOf(iso), ws = U.addDays(iso, -((dw.getDay() + 6) % 7)), days = []; for (var j = 0; j < 7; j++) days.push(U.addDays(ws, j));
      var rows = Object.keys(emps).map(function (k) { return emps[k]; }).filter(function (e) { return !e.onlyPush; }).sort(function (a, b) { return a.team.localeCompare(b.team) || a.name.localeCompare(b.name); });
      h += '<div class="tbl"><table><thead><tr><th>Nhân viên</th><th>Vị trí</th>' + days.map(function (x) { return '<th class="n">' + U.WD[U.dateOf(x).getDay()] + " " + U.dm(x) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        rows.map(function (e) { return "<tr><td><b>" + E(e.name) + "</b></td><td class='small'>" + E(e.pos) + "</td>" + days.map(function (x) { var s = l.shifts["SH:" + x + ":" + e.id]; return "<td class='n'>" + (s ? '<span class="tag ' + shiftCls(s) + '">' + E(s.raw) + "</span>" : '<span class="muted small">-</span>') + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>" + srcTag("LICH");
    } else {
      var sh2 = M.shiftsOn(iso) || [], tasks = M.tasksOn(iso);
      var known = Object.keys(emps).filter(function (k) { return !emps[k].onlyPush; }), have = {}; sh2.forEach(function (s) { have[s.emp] = 1; });
      var noShift = known.filter(function (k) { return !have[k]; }).map(function (k) { return emps[k].name; });
      var resp = {}; tasks.forEach(function (t) { if (t.assignee) (resp[U.normName(t.assignee)] = resp[U.normName(t.assignee)] || []).push(t.title); });
      var teams = { SM: "Quản lý cửa hàng", ADMIN: "Team Admin", SALES: "Team Sale" };
      h += '<div class="grid g2">' + Object.keys(teams).map(function (tm) {
        var list = sh2.filter(function (s) { return s.team === tm; }); if (!list.length) return "";
        return '<div class="card"><h3 style="margin-top:0">' + teams[tm] + " · " + list.length + '</h3><div class="tbl"><table><thead><tr><th>Ca</th><th>Nhân viên</th><th>Nhiệm vụ phụ trách</th></tr></thead><tbody>' +
          list.map(function (s) { var r = resp[U.normName(s.name)] || []; return "<tr><td><span class='tag " + shiftCls(s) + "'>" + E(s.raw) + "</span>" + (M.isActive(s, iso) ? '<br><span class="pill-now">Đang làm</span>' : "") + "</td><td><b>" + E(s.name) + "</b><br><span class='small muted'>" + E(s.pos) + "</span></td><td class='small'>" + (r.length ? r.map(E).join("<br>") : "<span class='muted'>-</span>") + "</td></tr>"; }).join("") + "</tbody></table></div></div>";
      }).join("") + "</div>";
      var warn = [];
      if (noShift.length) warn.push('<div class="warnbox"><b>Chưa được phân ca ngày ' + U.dm(iso) + ":</b> " + noShift.map(E).join(", ") + "</div>");
      (l.duplicates || []).filter(function (x) { return x.date === iso; }).forEach(function (x) { warn.push('<div class="badbox">Ca trùng: ' + E(x.name) + " có 2 dòng (" + E(x.a) + " / " + E(x.b) + ")</div>"); });
      var off = {}; sh2.forEach(function (s) { if (s.kind !== "shift") off[U.normName(s.name)] = s.raw; });
      tasks.forEach(function (t) { if (t.assignee && off[U.normName(t.assignee)]) warn.push('<div class="warnbox">Giao việc "' + E(t.title) + '" cho ' + E(t.assignee) + " nhưng người này " + E(off[U.normName(t.assignee)]) + ".</div>"); });
      h += warn.join("") + srcTag("LICH");
    }
    // sự kiện tháng
    var notes = Object.keys(l.notes || {}).filter(function (k) { return k.slice(0, 7) === iso.slice(0, 7); }).sort();
    h += '<h3>Sự kiện, chương trình bán hàng & việc đặc biệt ' + ymLabel(iso.slice(0, 7)) + "</h3>" + (notes.length ? '<div class="tbl"><table><thead><tr><th>Ngày</th><th>Nội dung (ghi chú lịch)</th></tr></thead><tbody>' + notes.map(function (k) { return "<tr><td>" + U.WD[U.dateOf(k).getDay()] + " " + U.dmy(k) + "</td><td>" + E(l.notes[k]) + "</td></tr>"; }).join("") + "</tbody></table></div>" : none("Không có ghi chú sự kiện trong tháng."));
    $("m-cal").innerHTML = h;
  }

  /* =================== 3. CÔNG VIỆC =================== */
  function renderTask() {
    var iso = UI.date, h = head(3, "Công việc định kỳ, phát sinh & phân công", "Mẫu định kỳ lấy từ Bảng Điều Khiển Team Admin (không bị sửa khi cập nhật từng lần thực hiện). Việc phát sinh từ công cụ Lịch và việc tạo đột xuất tại đây.");
    h += '<div class="tabs"><button class="tab' + (UI.taskView === "list" ? " on" : "") + '" data-act="taskview" data-v="list">Việc ngày ' + U.dm(iso) + '</button><button class="tab' + (UI.taskView === "lib" ? " on" : "") + '" data-act="taskview" data-v="lib">Thư viện mẫu định kỳ</button></div>';
    if (UI.taskView === "lib") { $("m-task").innerHTML = h + renderTaskLib(); return; }
    var all = M.tasksOn(iso), st = M.taskStats(all), emps = M.employees(), sh = M.shiftsOn(iso) || [];
    var onNames = sh.filter(function (s) { return s.kind === "shift"; }).map(function (s) { return s.name; });
    h += '<div class="grid">' + kpi("Tổng việc", st.total, "") + kpi("Hoàn thành", st.done, U.fmtPct(U.pct(st.done, st.total))) + kpi("Đang làm", st.doing, st.blocked + " tồn đọng") + kpi("Quá hạn", st.overdue, "") + kpi("Chưa phân công", st.unassigned, '<button class="btn sm" data-act="auto-assign">Phân công theo ca</button>') + "</div>";
    var f = UI.tf;
    var list = all.filter(function (t) {
      if (f.status === "overdue" && !t.overdue) return false;
      if (f.status === "unassigned" && !(t.unassigned && t.status !== "done")) return false;
      if (f.status && f.status !== "overdue" && f.status !== "unassigned" && t.status !== f.status) return false;
      if (f.role && t.role !== f.role) return false;
      if (f.who && U.normName(t.assignee) !== U.normName(f.who)) return false;
      if (f.q && U.normName(t.title).indexOf(U.normName(f.q)) < 0) return false;
      return true;
    }).sort(function (a, b) { var o = function (t) { return t.status === "done" || t.status === "moved" ? 3 : t.overdue ? 0 : t.status === "doing" ? 1 : 2; }; return o(a) - o(b); });
    h += '<div class="row" style="margin:14px 0 8px">' + sel("tfStatus", [["", "Mọi trạng thái"], ["overdue", "Quá hạn"], ["unassigned", "Chưa phân công"], ["todo", "Chưa làm"], ["doing", "Đang làm"], ["blocked", "Tồn đọng"], ["done", "Hoàn thành"], ["moved", "Đã chuyển"]], f.status, 'data-chg="tf" data-k="status"') +
      sel("tfRole", [["", "Mọi vị trí"], ["c", "Admin Chief"], ["a", "Admin"], ["s", "SC"], ["all", "Toàn team"]], f.role, 'data-chg="tf" data-k="role"') +
      sel("tfWho", [["", "Mọi người"]].concat(Object.keys(emps).map(function (k) { return [emps[k].name, emps[k].name]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); })), f.who, 'data-chg="tf" data-k="who"') +
      '<input type="text" placeholder="Tìm công việc..." value="' + E(f.q) + '" data-chg="tf" data-k="q"><span class="sp" style="flex:1"></span><span class="small muted">' + list.length + "/" + all.length + " việc</span></div>";
    h += '<div class="card" style="padding:0">' + (list.length ? list.map(function (t) { return taskRow(t, emps, onNames); }).join("") : none(M.ds("TA") ? "Không có công việc phù hợp." : "Chưa có mẫu công việc (nguồn Team Admin).")) + "</div>";
    h += '<div style="margin-top:6px">' + srcTag("TA") + " " + srcTag("LICH_TASKS") + "</div>";
    // thêm việc đột xuất
    var allNames = Object.keys(emps).map(function (k) { return emps[k].name; }).sort();
    var who = [["", "- Chưa phân công -"]].concat(onNames.map(function (n) { return [n, n + " (trong ca)"]; })).concat(allNames.filter(function (n) { return onNames.indexOf(n) < 0; }).map(function (n) { return [n, n]; }));
    h += '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">+ Tạo công việc đột xuất ngày ' + U.dmy(iso) + '</h3><div class="row"><input type="text" id="ahTitle" placeholder="Tên công việc" style="flex:2;min-width:220px">' + sel("ahWho", who, "") + sel("ahPri", ["Bình thường", "Cao", "Khẩn"], "Bình thường") + '<input type="time" id="ahDue" value="22:30"><input type="text" id="ahDesc" placeholder="Mô tả (tùy chọn)" style="flex:1;min-width:160px"><button class="btn" data-act="ah-add">Thêm</button></div></div>';
    $("m-task").innerHTML = h;
  }
  function taskRow(t, emps, onNames) {
    var d = t.status === "done", allNames = Object.keys(emps).map(function (k) { return emps[k].name; }).sort();
    var sugg = M.suggestAssignees(t.role, t.date);
    var opt = function (cur) { return [["", "- Chưa phân công -"]].concat(onNames.map(function (n) { return [n, n + " (trong ca)"]; })).concat(allNames.filter(function (n) { return onNames.indexOf(n) < 0; }).map(function (n) { return [n, n]; })).concat(cur && allNames.indexOf(cur) < 0 && onNames.indexOf(cur) < 0 ? [[cur, cur]] : []); };
    var tid = U.hash(t.id), canEdit = !M.isDemo();
    var tdLink = t.link ? (/^https?:/.test(t.link) ? t.link : "../01_VAN_HANH_TEAM/VH_Bang_Dieu_Khien_Team_Admin/index.html#" + t.link) : "";
    return '<div class="task' + (d ? " done" : "") + (UI.open[t.id] ? " open" : "") + '" data-id="' + E(t.id) + '"><button class="chk' + (d ? " on" : "") + '" data-act="t-toggle" data-id="' + E(t.id) + '" title="Đánh dấu hoàn thành"' + (canEdit ? "" : " disabled") + ">" + (d ? "✓" : "") + "</button>" +
      '<div><div class="t">' + E(t.title) + '</div><div class="meta">' + (t.overdue ? '<span class="tag bad">Quá hạn</span>' : "") + '<span class="tag ' + (d ? "ok" : t.status === "doing" ? "" : t.status === "blocked" ? "warn" : "grey") + '">' + E(M.STATUS[t.status] || t.status) + "</span>" +
      (t.role ? '<span class="tag">' + E(M.ROLE[t.role] || t.role) + "</span>" : "") + '<span class="tag grey">' + E(t.group || "") + "</span>" + (t.priority !== "Bình thường" ? '<span class="tag bad">' + E(t.priority) + "</span>" : "") +
      (t.assignee ? "<span>👤 <b>" + E(t.assignee) + "</b></span>" : '<span class="tag warn">Chưa phân công</span>' + (sugg.length ? '<span class="muted">gợi ý: ' + sugg.map(E).join(" / ") + "</span>" : "")) +
      "<span>⏰ " + E(t.due) + "</span><span class='muted'>" + E(t.freq) + " · " + E(t.origin) + "</span>" + (tdLink ? '<a href="' + E(tdLink) + '" target="_blank" rel="noopener">quy trình ↗</a>' : "") + (t.carriedFrom ? '<span class="muted">chuyển từ ngày trước</span>' : "") + "</div>" +
      (t.reason && !d ? '<div class="small" style="color:var(--bad)">Lý do: ' + E(t.reason) + "</div>" : "") + (t.result ? '<div class="small" style="color:var(--ok)">Kết quả: ' + E(t.result) + "</div>" : "") + "</div>" +
      '<button class="btn sub sm" data-act="t-open" data-id="' + E(t.id) + '">' + (UI.open[t.id] ? "Đóng" : "Cập nhật") + "</button>" +
      '<div class="edit"><div class="fg"><label>Người phụ trách chính' + sel("ta_" + tid, opt(t.assignee), t.assignee) + "</label><label>Người hỗ trợ" + sel("th_" + tid, opt(t.helper), t.helper) + "</label><label>Người kiểm tra" + sel("tc_" + tid, opt(t.checker), t.checker) + "</label>" +
      "<label>Trạng thái" + sel("ts_" + tid, [["todo", "Chưa làm"], ["doing", "Đang làm"], ["blocked", "Tồn đọng"], ["done", "Hoàn thành"], ["cancelled", "Hủy"]], t.status) + "</label><label>Ưu tiên" + sel("tp_" + tid, ["Bình thường", "Cao", "Khẩn"], t.priority) + '</label><label>Thời hạn<input type="time" id="tdu_' + tid + '" value="' + E(t.due) + '"></label></div>' +
      '<div class="fg" style="margin-top:8px"><label>Kết quả thực hiện<input type="text" id="tr_' + tid + '" value="' + E(t.result) + '"></label><label>Lý do chưa hoàn thành<input type="text" id="tl_' + tid + '" value="' + E(t.reason) + '"></label></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" data-act="t-save" data-id="' + E(t.id) + '"' + (canEdit ? "" : " disabled") + '>Lưu</button><button class="btn sub sm" data-act="t-carry" data-id="' + E(t.id) + '"' + (canEdit && !d && t.status !== "moved" ? "" : " disabled") + '>Chuyển sang ngày mai</button>' +
      (t.kind === "lich" ? '<span class="small muted">Việc của công cụ Lịch: ' + (S.state.settings.writeBackLich ? "tick hoàn thành sẽ ghi ngược vào công cụ Lịch." : "chỉ lưu tại Trợ lý (chưa bật ghi ngược).") + "</span>" : "") +
      (t.updatedAt ? '<span class="small muted">Cập nhật ' + U.hm(t.updatedAt) + (t.updatedBy ? " bởi " + E(t.updatedBy) : "") + "</span>" : "") + "</div></div></div>";
  }
  function renderTaskLib() {
    var tp = M.templates(), ks = Object.keys(tp);
    if (!ks.length) return none("Chưa có mẫu công việc.") + srcTag("TA");
    var rows = ks.map(function (k) { return tp[k]; }).sort(function (a, b) { return (a.group || "").localeCompare(b.group || "") || a.title.localeCompare(b.title); });
    return '<div class="action">' + rows.length + " mẫu công việc định kỳ. Mã mẫu cố định theo vị trí + nội dung; mỗi lần thực hiện có mã riêng <code>TI:ngày:mã mẫu</code>. Sửa mẫu tại Bảng Điều Khiển Team Admin.</div>" +
      '<div class="tbl"><table><thead><tr><th>Mã mẫu</th><th>Công việc</th><th>Vị trí</th><th>Nhóm nghiệp vụ</th><th>Tần suất</th><th class="n">Số lần trong khung</th></tr></thead><tbody>' +
      rows.map(function (t) { return "<tr><td><code>" + E(t.id) + "</code></td><td>" + E(t.title) + "</td><td>" + E(M.ROLE[t.role] || t.role) + "</td><td>" + E(t.group) + "</td><td>" + E(t.freq) + "</td><td class='n'>" + t.dates.length + "</td></tr>"; }).join("") + "</tbody></table></div>" + srcTag("TA");
  }

  /* =================== 4. PUSH SALE =================== */
  function renderPush() {
    var h = head(4, "Push Sale theo nhân viên", "Tỷ lệ hoàn thành = Số lượng thực hiện / Chỉ tiêu × 100%. Chỉ cộng bản ghi có hóa đơn (Slip No.) đi kèm; trùng giữa các tracker chỉ tính 1 lần theo tracker ưu tiên.");
    var months = M.pushMonths();
    if (!months.length) { $("m-push").innerHTML = h + '<div class="card">' + none("Chưa có dữ liệu tracker Push Sale trong trình duyệt này.") + S.PUSH_SOURCES.map(function (c) { return "<div>" + srcTag(c.id) + " " + statusTag((S.sync[c.id] || {}).status) + "</div>"; }).join("") + "</div>"; return; }
    if (months.indexOf(UI.pushMonth) < 0) UI.pushMonth = months.indexOf(UI.date.slice(0, 7)) >= 0 ? UI.date.slice(0, 7) : months[0];
    var pm = M.pushMerged(UI.pushMonth), iso = UI.date, inMonth = iso.slice(0, 7) === UI.pushMonth;
    var scope = UI.pushScope; if (!inMonth && scope !== "all") scope = "all";
    var sum = scope === "day" ? M.pushSummary(pm, null, iso) : scope === "mtd" ? M.pushSummary(pm, iso) : M.pushSummary(pm);
    var sumAll = M.pushSummary(pm);
    var scopeLbl = scope === "day" ? "ngày " + U.dmy(iso) : scope === "mtd" ? "lũy kế đến " + U.dmy(iso) : "cả tháng";
    h += '<div class="row">' + sel("pushMonth", months.map(function (m) { return [m, ymLabel(m)]; }), UI.pushMonth, 'data-chg="pushMonth"') +
      '<div class="tabs" style="margin:0">' + [["day", "Ngày đang chọn"], ["mtd", "Lũy kế đến ngày"], ["all", "Cả tháng"]].map(function (v) { return '<button class="tab' + (scope === v[0] ? " on" : "") + '" data-act="pushscope" data-v="' + v[0] + '"' + (!inMonth && v[0] !== "all" ? " disabled" : "") + ">" + v[1] + "</button>"; }).join("") + '</div><span style="flex:1"></span><button class="btn sub sm" data-act="push-xlsx">Xuất Excel</button></div>';
    var pids = Object.keys(pm.products);
    h += '<div class="grid" style="margin-top:12px">' + pids.map(function (pid) {
      var p = pm.products[pid], t = sum.team[pid], ta = sumAll.team[pid];
      var tgt = scope === "day" ? t.dayTarget : scope === "mtd" ? t.dayTarget : ta.target;
      var pc = U.pct(t.actual, tgt);
      return kpi(p.label, U.fmt1(t.actual) + " <span style='font-size:14px;color:var(--ink2)'>/ " + U.fmt1(tgt) + " " + E(p.unit) + "</span>", (tgt > 0 ? "Đạt " + U.fmtPct(pc) + " · còn thiếu " + U.fmt1(Math.max(0, tgt - t.actual)) : "Chưa giao chỉ tiêu") + bar(pc) + "<span class='small'>Chỉ tiêu tháng " + U.fmtInt(ta.target) + " · đã bán cả tháng " + U.fmt1(ta.actual) + " · doanh thu " + U.fmtVnd(t.revenue) + " (" + scopeLbl + ")</span>", srcTag(p.src));
    }).join("") + "</div>";
    // bảng theo nhân viên
    var shMap = {}; (M.shiftsOn(iso) || []).forEach(function (s) { shMap[s.emp] = s; });
    var rows = Object.keys(sum.rows).map(function (k) { return sum.rows[k]; });
    var rowsAll = sumAll.rows;
    rows.sort(function (a, b) { var x = function (r) { return pids.reduce(function (s, pid) { return s + (r.p[pid] ? r.p[pid].actual : 0); }, 0); }; return x(b) - x(a); });
    h += '<h3>Theo nhân viên (' + scopeLbl + ')</h3><div class="tbl"><table><thead><tr><th>Nhân viên</th><th>Ca ' + U.dm(iso) + "</th>" + pids.map(function (pid) { return '<th class="n">' + E(pm.products[pid].label) + "<br><span style='font-weight:400'>TH / chỉ tiêu tháng · %</span></th><th class='n'>Còn thiếu</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { var s = shMap[r.emp]; return "<tr><td><b>" + E(r.name) + "</b><br><span class='small muted'>" + E(r.role) + "</span></td><td>" + (s ? '<span class="tag ' + shiftCls(s) + '">' + E(s.raw) + "</span>" : "<span class='muted small'>-</span>") + "</td>" +
        pids.map(function (pid) { var c = r.p[pid] || { target: null, actual: 0 }, ca = rowsAll[r.emp] && rowsAll[r.emp].p[pid] ? rowsAll[r.emp].p[pid] : c, tg = c.target;
          if (tg == null || tg === 0) return "<td class='n'>" + U.fmt1(c.actual) + " <span class='tag grey'>Chưa giao chỉ tiêu</span></td><td class='n'>-</td>";
          var pc = U.pct(scope === "all" ? ca.actual : c.actual, tg); return "<td class='n'>" + U.fmt1(c.actual) + " / " + U.fmtInt(tg) + " · <b>" + U.fmtPct(U.pct(ca.actual, tg)) + "</b>" + bar(U.pct(ca.actual, tg)) + "</td><td class='n'>" + U.fmt1(Math.max(0, tg - ca.actual)) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody><tfoot><tr><th>TOÀN ĐỘI</th><th></th>" + pids.map(function (pid) { var t = sum.team[pid], ta = sumAll.team[pid]; return "<th class='n'>" + U.fmt1(t.actual) + " / " + U.fmtInt(ta.target) + " · " + U.fmtPct(U.pct(ta.actual, ta.target)) + "</th><th class='n'>" + U.fmt1(Math.max(0, ta.target - ta.actual)) + "</th>"; }).join("") + "</tr></tfoot></table></div>";
    h += '<p class="small muted">Cột "TH" theo phạm vi đang chọn; % và "Còn thiếu" tính trên số đã bán cả tháng so với chỉ tiêu tháng của từng nhân viên. Tracker ghi kết quả theo ngày - cột Ca lấy từ lịch làm việc.</p>';
    // biểu đồ ngày
    h += '<h3>Kết quả theo ngày</h3><div class="grid g2">' + pids.map(function (pid) {
      var by = M.pushByDate(pm, pid), dt = pm.dayTargets[pid] || {}, ds = Object.keys(dt).sort(); if (!ds.length) ds = Object.keys(by).sort();
      var mx = Math.max.apply(null, ds.map(function (d) { return Math.max(by[d] || 0, dt[d] || 0); }).concat([1]));
      return '<div class="card"><b>' + E(pm.products[pid].label) + '</b><div class="spark" title="Cột xanh: thực hiện · khung đỏ: chỉ tiêu ngày">' + ds.map(function (d) { return '<span class="' + (d === iso ? "today" : "") + '" style="height:' + ((by[d] || 0) / mx * 100) + '%" title="' + U.dm(d) + ": " + U.fmt1(by[d] || 0) + " / " + U.fmt1(dt[d] || 0) + '"></span>'; }).join("") + '</div><div class="small muted">' + (ds.length ? U.dm(ds[0]) + " → " + U.dm(ds[ds.length - 1]) : "") + " · cột đỏ = ngày đang chọn</div></div>";
    }).join("") + "</div>";
    if (pm.conflicts.length) h += '<h3>Kết quả lệch giữa các tracker (' + pm.conflicts.length + ')</h3><div class="warnbox">Cùng nhân viên - sản phẩm - ngày nhưng số lượng khác nhau giữa 2 tracker. Đã tính theo tracker ưu tiên cao hơn, không cộng dồn.</div><div class="tbl"><table><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Sản phẩm</th><th>Đang tính</th><th>Bản khác</th></tr></thead><tbody>' + pm.conflicts.slice(0, 200).map(function (c) { return "<tr><td>" + U.dmy(c.date) + "</td><td>" + E(c.name) + "</td><td>" + E(pm.products[c.pid] ? pm.products[c.pid].label : c.pid) + "</td><td>" + c.keptQty + " (" + E(c.kept) + ")</td><td>" + c.otherQty + " (" + E(c.other) + ")</td></tr>"; }).join("") + "</tbody></table></div>";
    if (pm.unverified.length) h += '<details style="margin-top:12px"><summary>' + pm.unverified.length + " bản ghi chưa xác minh (không có hóa đơn đi kèm) - không tính vào tổng</summary><div class='tbl'><table><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Sản phẩm</th><th class='n'>SL</th><th>Tracker</th></tr></thead><tbody>" + pm.unverified.map(function (r) { return "<tr><td>" + U.dmy(r.date) + "</td><td>" + E(r.name) + "</td><td>" + E(r.pid) + "</td><td class='n'>" + r.qty + "</td><td>" + E(r.src) + "</td></tr>"; }).join("") + "</tbody></table></div></details>";
    h += '<h3>Nguồn đang dùng</h3><div class="tbl"><table><thead><tr><th>Tracker</th><th>Ưu tiên</th><th>Trạng thái</th></tr></thead><tbody>' + S.PUSH_SOURCES.filter(function (c) { return c.month === UI.pushMonth; }).map(function (c) { return "<tr><td>" + E(c.name) + "<br>" + srcTag(c.id) + "</td><td>" + c.priority + "</td><td>" + statusTag((S.sync[c.id] || {}).status) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    $("m-push").innerHTML = h;
  }

  /* =================== 5. DOANH SỐ =================== */
  function renderSale() {
    var h = head(5, "Kết quả Sale & kế hoạch doanh số", "Giữ đúng định nghĩa của Dashboard Sale: doanh thu chưa thuế = Sales - Return, đơn vị đồng.");
    var months = M.saleMonths(), cur = UI.saleMonth || UI.date.slice(0, 7);
    if (months.indexOf(cur) < 0 && months.length) cur = months[0];
    UI.saleMonth = cur;
    var s = M.sale(cur);
    h += '<div class="row">' + (months.length ? sel("saleMonth", months.map(function (m) { return [m, ymLabel(m)]; }), cur, 'data-chg="saleMonth"') : "") + "</div>";
    if (!s) {
      h += '<div class="card" style="margin-top:12px">' + none("Chưa có số liệu Sale thực tế: mở Dashboard Sale tháng (bản có cầu nối) và nạp file bán hàng POS.") + srcTag("SALE") + "</div>";
      var bm = M.budgetMonth(UI.date.slice(0, 7));
      if (bm != null) { var b = M.ds("BUDGET"), ks = Object.keys(b.byDate).filter(function (k) { return k.slice(0, 7) === UI.date.slice(0, 7); }).sort();
        h += "<h3>Kế hoạch (Budget) " + ymLabel(UI.date.slice(0, 7)) + " - chưa thuế</h3><div class='grid'>" + kpi("Budget tháng", U.fmtM(bm), "chưa thuế · có thuế ×1,1: " + U.fmtM(bm * 1.1), srcTag("BUDGET")) + "</div><div class='tbl' style='margin-top:10px'><table><thead><tr><th>Ngày</th><th class='n'>Budget (đ)</th><th class='n'>Lũy kế</th></tr></thead><tbody>" +
          (function () { var acc = 0; return ks.map(function (k) { acc += b.byDate[k]; return "<tr><td>" + U.WD[U.dateOf(k).getDay()] + " " + U.dmy(k) + "</td><td class='n'>" + U.fmtInt(b.byDate[k]) + "</td><td class='n'>" + U.fmtInt(acc) + "</td></tr>"; }).join(""); })() + "</tbody></table></div>"; }
      $("m-sale").innerHTML = h; return;
    }
    var a = s.attainment, ms = M.saleMilestones(s);
    h += '<div class="grid" style="margin-top:12px">' +
      kpi("Doanh số lũy kế", U.fmtM(s.totals.revenue), U.dmy(s.totals.dateMin) + " → " + U.dmy(s.totals.dateMax) + " · " + U.fmtInt(s.totals.slipCount) + " bill", srcTag("SALE")) +
      (a ? kpi("Hoàn thành Budget lũy kế", U.fmtPct(a.attainmentPct), "Budget lũy kế " + U.fmtM(a.mtdTarget) + bar(a.attainmentPct), srcTag("SALE")) + kpi("Kế hoạch tháng", U.fmtM(a.monthTarget), "Dự báo cuối tháng " + U.fmtM(a.forecastTotal) + " (" + U.fmtPct(a.forecastPct) + ")", srcTag("SALE", s.budgetSource)) +
        kpi("Chênh lệch kế hoạch", U.fmtM(a.monthTarget - a.mtdActual), ms && ms.perDay != null ? "Cần bình quân <b>" + U.fmtM(ms.perDay) + "/ngày</b> trong " + ms.daysRemaining + " ngày còn lại" : "", srcTag("SALE")) : kpi("Budget", "Chưa có dữ liệu", "Dashboard Sale chưa có Budget cho tháng này", "", true)) + "</div>";
    // theo ngày
    var acc = 0, accB = 0;
    h += "<h3>Theo ngày</h3><div class='tbl'><table><thead><tr><th>Ngày</th><th class='n'>Doanh số (đ)</th><th class='n'>Budget ngày (đ)</th><th class='n'>% ngày</th><th class='n'>Bill</th><th class='n'>Lũy kế</th><th class='n'>% lũy kế</th></tr></thead><tbody>" +
      s.byDate.map(function (d) { var bd = s.budgetByDate[d.iso]; acc += d.revenue; if (bd) accB += bd; return "<tr" + (d.iso === UI.date ? " style='background:#e8f0fa'" : "") + "><td>" + U.WD[U.dateOf(d.iso).getDay()] + " " + U.dmy(d.iso) + "</td><td class='n'>" + U.fmtInt(d.revenue) + "</td><td class='n'>" + (bd ? U.fmtInt(bd) : "-") + "</td><td class='n'>" + U.fmtPct(U.pct(d.revenue, bd)) + "</td><td class='n'>" + U.fmtInt(d.bills) + "</td><td class='n'>" + U.fmtInt(acc) + "</td><td class='n'>" + U.fmtPct(U.pct(acc, accB)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    // theo tuần
    var wk = {}; s.byDate.forEach(function (d) { var x = U.dateOf(d.iso), mon = U.addDays(d.iso, -((x.getDay() + 6) % 7)); var w = wk[mon] = wk[mon] || { rev: 0, bud: 0, n: 0 }; w.rev += d.revenue; w.bud += s.budgetByDate[d.iso] || 0; w.n++; });
    h += "<h3>Theo tuần</h3><div class='tbl'><table><thead><tr><th>Tuần bắt đầu</th><th class='n'>Số ngày có số</th><th class='n'>Doanh số</th><th class='n'>Budget</th><th class='n'>%</th></tr></thead><tbody>" + Object.keys(wk).sort().map(function (k) { var w = wk[k]; return "<tr><td>" + U.dmy(k) + "</td><td class='n'>" + w.n + "</td><td class='n'>" + U.fmtInt(w.rev) + "</td><td class='n'>" + U.fmtInt(w.bud) + "</td><td class='n'>" + U.fmtPct(U.pct(w.rev, w.bud)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    if (s.byCategory.length) h += "<h3>Theo ngành hàng (Layer 1)</h3><div class='tbl'><table><thead><tr><th>Mã</th><th>Ngành</th><th class='n'>Doanh số</th><th class='n'>Budget lũy kế</th><th class='n'>%</th><th class='n'>Budget tháng</th></tr></thead><tbody>" + s.byCategory.slice().sort(function (x, y) { return y.revenue - x.revenue; }).map(function (c) { return "<tr><td>" + E(c.code) + "</td><td>" + E(c.name) + "</td><td class='n'>" + U.fmtInt(c.revenue) + "</td><td class='n'>" + (c.mtdTarget == null ? "-" : U.fmtInt(c.mtdTarget)) + "</td><td class='n'>" + U.fmtPct(c.attainmentPct) + "</td><td class='n'>" + (c.monthTarget == null ? "-" : U.fmtInt(c.monthTarget)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    h += '<div class="action small"><b>Định nghĩa:</b> ' + E(s.revenueDef) + "<br><b>File bán hàng:</b> " + E(s.sourceFile || "-") + " · <b>Budget:</b> " + E(s.budgetSource || "-") + "</div>";
    $("m-sale").innerHTML = h;
  }

  /* =================== 6. KHO =================== */
  function renderKho() {
    var h = head(6, "Giám sát tồn kho & đặt hàng", "Số liệu do OrderIQ tính (tồn theo file tồn tháng đã nạp, đề xuất đặt theo công thức OrderIQ). Trợ lý không tự kết luận cần đặt.");
    var k = M.kho();
    if (!k) { $("m-kho").innerHTML = h + '<div class="card">' + none((S.sync.KHO || {}).message || "Chưa có dữ liệu.") + srcTag("KHO") + "</div>"; return; }
    var fg = Object.keys(k.forgotRows).map(function (x) { return k.forgotRows[x]; }), items = Object.keys(k.items).map(function (x) { return k.items[x]; });
    h += '<div class="grid">' + kpi("Hết hàng", k.counts.oos, "mã có sức bán", srcTag("KHO")) + kpi("Sắp hết", k.counts.low, "dưới ngưỡng an toàn") + kpi("Đề xuất đặt", k.counts.recPositive, "mã có SL đề xuất > 0 · " + k.counts.onOrder + " mã đang chờ giao") +
      kpi("SKU quên đặt", fg.length, k.forgot ? "kỳ " + U.dmy(ymd8(k.forgot.ref)) + " · " + fg.filter(function (r) { return !r.reason && !r.reasonCode; }).length + " chưa có lý do" : "chưa lập kỳ giải trình", "", !k.forgot) + "</div>";
    h += '<div class="action small">Ngày đối chiếu: <b>' + U.dmy(ymd8(k.refDate)) + "</b> · Tồn kho tháng: <b>" + E(k.latestMonth) + "</b> (" + k.counts.total + " SKU) - đây là <b>tồn thực tế theo file tồn đã nạp vào OrderIQ</b>, không phải số nhập tay.</div>";
    h += '<div class="tabs"><button class="tab' + (UI.khoTab === "action" ? " on" : "") + '" data-act="khotab" data-v="action">Mã cần xử lý (' + items.length + ')</button><button class="tab' + (UI.khoTab === "forgot" ? " on" : "") + '" data-act="khotab" data-v="forgot">SKU quên đặt (' + fg.length + ')</button><span style="flex:1"></span><button class="btn sub sm" data-act="kho-xlsx">Xuất Excel báo cáo</button></div>';
    var q = U.normName(UI.khoQ);
    h += '<div class="row" style="margin-bottom:8px"><input type="text" placeholder="Tìm barcode / tên / NCC" value="' + E(UI.khoQ) + '" data-chg="khoQ">' +
      (UI.khoTab === "action" ? sel("khoSt", [["", "Mọi trạng thái"], ["oos", "Hết hàng"], ["low", "Sắp hết"], ["rec", "Có đề xuất đặt"]], UI.khoSt, 'data-chg="khoSt"') : sel("khoSt", [["", "Mọi trạng thái"], ["noreason", "Chưa có lý do"]].concat(Object.keys(fg.reduce(function (m, r) { m[r.statusText] = 1; return m; }, {})).map(function (x) { return [x, x]; })), UI.khoSt, 'data-chg="khoSt"')) + "</div>";
    if (UI.khoTab === "action") {
      var list = items.filter(function (r) { return (!q || U.normName(r.bc + " " + r.name + " " + r.supName).indexOf(q) >= 0) && (!UI.khoSt || (UI.khoSt === "rec" ? r.rec > 0 : r.status === UI.khoSt)); });
      h += '<div class="tbl"><table><thead><tr><th>Barcode</th><th>Tên hàng</th><th>CAT</th><th>NCC</th><th class="n">Tồn</th><th class="n">Bán TB/ngày</th><th class="n">Đủ bán (ngày)</th><th class="n">Đang chờ giao</th><th class="n">Đề xuất đặt</th><th>Trạng thái</th></tr></thead><tbody>' +
        (list.length ? list.slice(0, 300).map(function (r) { return "<tr><td><code>" + E(r.bc) + "</code></td><td>" + E(r.name) + "</td><td>" + E(r.catName || r.cat) + "</td><td class='small'>" + E(r.supName || r.sup) + "</td><td class='n'>" + U.fmtInt(r.stock) + "</td><td class='n'>" + U.fmt1(r.rate) + "</td><td class='n'>" + (r.daysLeft == null ? "-" : U.fmt1(r.daysLeft)) + "</td><td class='n'>" + U.fmtInt(r.onOrder) + "</td><td class='n'><b>" + U.fmtInt(r.rec) + "</b></td><td><span class='tag " + (r.status === "oos" ? "bad" : r.status === "low" ? "warn" : "grey") + "'>" + E(r.statusText) + "</span></td></tr>"; }).join("") : "<tr><td colspan='10'>" + none("Không có mã phù hợp.") + "</td></tr>") + "</tbody></table></div>";
    } else {
      var list2 = fg.filter(function (r) { return (!q || U.normName(r.bc + " " + r.name + " " + r.supName + " " + r.owner).indexOf(q) >= 0) && (!UI.khoSt || (UI.khoSt === "noreason" ? !(r.reason || r.reasonCode) : r.statusText === UI.khoSt)); });
      h += k.forgot ? "" : none("OrderIQ chưa lập kỳ báo cáo SKU quên đặt (mục 'SKU quên đặt' trong OrderIQ).");
      h += '<div class="tbl"><table><thead><tr><th>Barcode</th><th>Tên hàng</th><th>NCC</th><th>SUP phụ trách</th><th class="n">Tồn khi lập</th><th>Dấu hiệu</th><th>Trạng thái</th><th>Lý do</th><th>Hướng xử lý tiếp theo</th><th>Cập nhật</th></tr></thead><tbody>' +
        (list2.length ? list2.map(function (r) { var nx = r.poNew && r.poNew.length ? "Đã có PO mới: " + r.poNew.join(", ") : (r.status === "unchecked" || r.status === "waiting") ? "SUP ghi lý do trong OrderIQ" : r.status === "confirm" ? "Tạo PO" : r.status === "ncc" ? "Chờ NCC xác nhận" : "-";
          return "<tr><td><code>" + E(r.bc) + "</code></td><td>" + E(r.name) + "</td><td class='small'>" + E(r.supName || r.sup) + "</td><td>" + (r.owner ? E(r.owner) : "<span class='tag warn'>Chưa có</span>") + "</td><td class='n'>" + U.fmtInt(r.stock) + "</td><td class='small'>" + r.types.map(E).join("<br>") + "</td><td><span class='tag " + (r.status === "po" || r.status === "closed" ? "ok" : r.status === "unchecked" ? "bad" : "warn") + "'>" + E(r.statusText) + "</span></td><td class='small'>" + E([r.reasonCode, r.reason].filter(Boolean).join(" - ") || "") + (r.reason || r.reasonCode ? "" : "<span class='tag bad'>Chưa có lý do</span>") + "</td><td class='small'>" + E(nx) + "</td><td class='small'>" + (r.at ? U.hm(r.at) + (r.by ? " · " + E(r.by) : "") : "-") + "</td></tr>"; }).join("") : "<tr><td colspan='10'>" + none("Không có dòng phù hợp.") + "</td></tr>") + "</tbody></table></div>";
      h += '<p class="small muted">Cập nhật lý do / SUP phụ trách tại OrderIQ (nguồn chuẩn) - Trợ lý tự nhận thay đổi.</p>';
    }
    h += srcTag("KHO");
    $("m-kho").innerHTML = h;
  }

  /* =================== 7. NHẬT KÝ =================== */
  var draftBuf = {};
  function renderJournal() {
    var iso = UI.date, id = "J:" + iso, j = M.isDemo() ? null : S.state.journals[id];
    var h = head(7, "Nhật ký cuối ngày & bàn giao", "Tạo BẢN NHÁP từ dữ liệu đã đồng bộ → kiểm tra, chỉnh sửa → bấm xác nhận để lưu bản chính thức. Không tự lưu bản chính thức.");
    if (j && j.status === "confirmed") {
      h += '<div class="action">✅ Nhật ký ngày <b>' + U.dmy(iso) + "</b> đã xác nhận bởi <b>" + E(j.confirmedBy) + "</b> lúc " + U.hm(j.confirmedAt) + ' · tạo lúc ' + U.hm(j.createdAt) + '. <button class="btn sub sm" data-act="j-print">In</button> <button class="btn sub sm" data-act="j-xlsx">Xuất Excel</button></div>';
      h += M.JOURNAL_SECTIONS.map(function (s) { return '<div class="card jsec"><label>' + s[1] + '</label><div style="white-space:pre-wrap">' + E(j.sections[s[0]] || "") + "</div></div>"; }).join("");
      h += '<details><summary>Số liệu & nguồn dùng trong báo cáo</summary><div class="tbl"><table><tbody>' + Object.keys(j.sources || {}).map(function (k) { var x = j.sources[k]; return "<tr><td>" + E(x.label) + "</td><td>" + U.hm(x.at) + "</td><td>" + E(S.STATUS[x.status] || "") + "</td></tr>"; }).join("") + "</tbody></table></div><pre class='small' style='white-space:pre-wrap'>" + E(JSON.stringify(j.metrics, null, 1)) + "</pre></details>";
    } else {
      var cur = draftBuf[iso] || (j ? { sections: U.clone(j.sections), base: { metrics: j.metrics, sources: j.sources } } : null);
      h += '<div class="row"><button class="btn" data-act="j-gen">' + (cur ? "Tạo lại bản nháp từ dữ liệu" : "Tạo bản nháp từ dữ liệu") + "</button>" + (j ? '<span class="tag warn">BẢN NHÁP đã lưu ' + U.hm(j.updatedAt) + "</span>" : cur ? '<span class="tag warn">BẢN NHÁP chưa lưu</span>' : "") + "</div>";
      if (cur) {
        h += '<div class="warnbox">BẢN NHÁP - kiểm tra từng mục, sửa trực tiếp. Mục 7 (vấn đề phát sinh) cần tự ghi.</div>' + M.JOURNAL_SECTIONS.map(function (s) { return '<div class="jsec"><label for="js_' + s[0] + '">' + s[1] + '</label><textarea id="js_' + s[0] + '" data-chg="jsec" data-k="' + s[0] + '">' + E(cur.sections[s[0]] || "") + "</textarea></div>"; }).join("");
        h += '<div class="card row"><button class="btn sub" data-act="j-save"' + (M.isDemo() ? " disabled" : "") + '>Lưu bản nháp</button><label class="small">Người xác nhận <input type="text" id="jWho" value="' + E(S.state.settings.user || "") + '" placeholder="Họ tên"></label><button class="btn red" data-act="j-confirm"' + (M.isDemo() ? " disabled" : "") + ">Xác nhận & lưu chính thức</button>" + (M.isDemo() ? '<span class="tag demo">DEMO - không lưu</span>' : "") + "</div>";
      }
    }
    var js = Object.keys(S.state.journals).map(function (k) { return S.state.journals[k]; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    h += "<h3>Nhật ký đã lưu</h3>" + (js.length ? '<div class="tbl"><table><thead><tr><th>Ngày</th><th>Trạng thái</th><th>Tạo lúc</th><th>Xác nhận</th><th></th></tr></thead><tbody>' + js.map(function (x) { return "<tr><td>" + U.dmy(x.date) + "</td><td>" + (x.status === "confirmed" ? '<span class="tag ok">Chính thức</span>' : '<span class="tag warn">Bản nháp</span>') + "</td><td>" + U.hm(x.createdAt) + "</td><td>" + (x.confirmedAt ? U.hm(x.confirmedAt) + " · " + E(x.confirmedBy) : "-") + '</td><td><button class="btn sub sm" data-act="pickday" data-d="' + x.date + '" data-tab2="journal">Mở</button></td></tr>'; }).join("") + "</tbody></table></div>" : none("Chưa có nhật ký."));
    $("m-journal").innerHTML = h;
  }

  /* =================== 8. CÔNG CỤ =================== */
  var TOOL_MAP = [[/VH_Lich_Lam_Viec|LICH_LAM_VIEC_1016/i, ["LICH", "LICH_TASKS", "BUDGET"], "localStorage khn16-sched / khn16-tasks + ảnh chụp S1016_SNAP_LICH"], [/Team_Admin|SO_TAY_TEAM_ADMIN/i, ["TA"], "Hàm lịch việc + ảnh chụp S1016_SNAP_TA_TASKS"],
    [/OrderIQ|ORDERIQ_STOCK/i, ["KHO"], "IndexedDB orderiq_kho_1016_v2 → ảnh chụp S1016_SNAP_KHO"], [/DS_2026-1[01]_Dashboard_Sale/i, ["SALE"], "Bộ nhớ trang (không lưu) → ảnh chụp S1016_SNAP_SALE_<tháng>"],
    [/Tracker_Team_1[58]10_AVATAR/i, ["PS_T10_AVATAR"], "localStorage TEAM_ADMIN_POS_PUSH_SALE_OCT_2026_AVATAR_V2"], [/Tracker_Team_0210/i, ["PS_T10_ONBODY"], "localStorage TEAM_ADMIN_POS_PUSH_SALE_OCT_2026_V1"], [/Tracker_Nhan_Vien/i, ["PS_T10_NV"], "localStorage TEAM_ADMIN_PUSH_SALE_OCT_2026_NHANVIEN_AVATAR_V2"],
    [/2026-09_GD2_Tracker/i, ["PS_T9_GD2"], "localStorage TEAM_ADMIN_POS_PUSH_SALE_SEPT_2026_GD2_V1"], [/2026-09_GD1_Tracker/i, ["PS_T9_GD1"], "localStorage TEAM_ADMIN_POS_PUSH_SALE_SEPT_2026_V1"],
    [/sweet-gumption|Check_Ton_Gia_KM/i, ["CHECK_TON"], "localStorage trên origin Netlify (khác origin)"], [/xinhangmiennam|Xin_Hang_Lien/i, ["XIN_HANG"], "Origin Netlify (khác origin)"], [/Check_Ca_Cham_Cong/i, ["CHAM_CONG"], "Không lưu - xử lý file tạm"]];
  function toolSources(t) { var s = (t.href || "") + " " + (t.local || ""); for (var i = 0; i < TOOL_MAP.length; i++) if (TOOL_MAP[i][0].test(s)) return TOOL_MAP[i]; return null; }
  function renderTools() {
    var reg = window.S1016_TOOLS || { tools: [] }, h = head(8, "Trung tâm link công cụ", reg.tools.length + " công cụ lấy từ Trang chủ link tổng hợp (trích " + U.hm(reg.extractedAt) + "). <b>Mở được link ≠ đọc/ghi được dữ liệu</b> - cột trạng thái cho biết công cụ nào thực sự đã kết nối.");
    var groups = {}; reg.tools.forEach(function (t) { (groups[t.group] = groups[t.group] || []).push(t); });
    h += Object.keys(groups).map(function (g) {
      return "<h3>" + E(g) + '</h3><div class="grid">' + groups[g].map(function (t) {
        var m = toolSources(t), sts = m ? m[1].map(function (id) { return S.sync[id] || {}; }) : [];
        var st = m ? statusTag(sts[0].status) : '<span class="tag grey">Chỉ mở link</span>';
        var last = m ? sts.map(function (x) { return x.lastOk; }).filter(Boolean).sort().pop() : null;
        var local = t.local ? "../" + t.local : "";
        var srcObj = m ? S.sourceById(m[1][0]) : null;
        return '<div class="card toolcard"><div class="nm">' + E(t.name) + '</div><div class="small muted">' + E(t.desc) + '</div><div class="links">' + (t.href ? '<a class="btn sm" target="_blank" rel="noopener" href="' + E(/^https?:/.test(t.href) ? t.href : "../" + t.href) + '">Mở ' + E(t.host || "") + "</a>" : "") + (local && local !== "../" + t.href ? '<a class="btn sub sm" target="_blank" href="' + E(local) + '">📁 Bản thư mục</a>' : "") + "</div>" +
          '<div class="small"><b>Trạng thái dữ liệu:</b> ' + st + (last ? " · đồng bộ " + U.hm(last) : "") + "</div>" + (m ? '<div class="small"><b>Nguồn dữ liệu:</b> ' + E(m[2]) + "</div>" : '<div class="small muted">Tài liệu/báo cáo tĩnh - không có dữ liệu cần tổng hợp.</div>') +
          (srcObj && srcObj.how ? '<div class="small"><b>Cách cập nhật:</b> ' + E(srcObj.how) + "</div>" : "") + '<div class="small muted">Cập nhật file: ' + E(t.updated || "-") + "</div></div>";
      }).join("") + "</div>";
    }).join("");
    $("m-tools").innerHTML = h;
  }

  /* =================== 9. NGUỒN DỮ LIỆU =================== */
  function modeLabel(st, src) { var m = st.mode || src.mode; return { local: "Trực tiếp (cùng origin)", "import": "Gói nhập (file JSON)", bundled: "Bản trích tĩnh", link: "Chỉ mở link", cloud: "Đám mây", fileOnly: "Chỉ nhập file", "local+import": "Trực tiếp + gói nhập" }[m] || (m || "-"); }
  function renderSrc() {
    var h = head(9, "Quản lý nguồn dữ liệu & trạng thái đồng bộ", "Trạng thái chỉ là 'Đồng bộ thành công' khi đã đọc và kiểm tra được cấu trúc dữ liệu thật. Trình duyệt: " + (S.lsOk ? "lưu trữ hoạt động" : "<b style='color:var(--bad)'>chặn lưu trữ</b>") + " · origin: <code>" + E(location.origin) + "</code>");
    var wb = S.log.filter(function (l) { return l.origin === "Ghi ngược"; }).length;
    h += '<div class="tbl"><table><thead><tr><th>Nguồn</th><th>Trạng thái</th><th>Chế độ</th><th>Thành công gần nhất</th><th>Thời điểm dữ liệu nguồn</th><th class="n">Đọc</th><th class="n">Ghi</th><th class="n">Cần đối chiếu</th><th></th></tr></thead><tbody>' +
      S.sources.map(function (src) { var st = S.sync[src.id] || {}, open = UI.srcOpen[src.id];
        return "<tr><td><b>" + E(src.name) + "</b><br><span class='small muted'>" + E(src.entity || "") + "</span></td><td>" + statusTag(st.status) + (st.status === "fail" && st.retry ? "<br><span class='small'>thử lại " + Math.min(st.retry, 3) + "/3</span>" : "") + "</td><td class='small'>" + E(modeLabel(st, src)) + "</td><td class='small'>" + U.hm(st.lastOk) + "</td><td class='small'>" + U.hm(st.sourceAt) + "</td><td class='n'>" + (st.read == null ? "-" : U.fmtInt(st.read)) + "</td><td class='n'>" + (src.id === "LICH_TASKS" ? (S.state.settings.writeBackLich ? wb : "tắt") : "-") + "</td><td class='n'>" + (st.reconcile || 0) + (st.errors && st.errors.length ? " / " + st.errors.length + " lỗi" : "") + "</td>" +
          '<td style="white-space:nowrap">' + (src.mode === "link" ? "" : '<button class="btn sm" data-act="src-sync" data-id="' + src.id + '">Đồng bộ lại</button> ') + '<button class="btn sub sm" data-act="src-open" data-id="' + src.id + '">' + (open ? "Ẩn" : "Chi tiết") + "</button></td></tr>" +
          (open ? "<tr><td colspan='9' class='small'><b>Khóa / kênh:</b> " + (src.keys && src.keys.length ? src.keys.map(function (k) { return "<code>" + E(String(k)) + "</code>"; }).join(" ") : "-") + "<br><b>Cách cập nhật:</b> " + E(src.how || "-") + (st.message ? "<br><b>Ghi chú:</b> " + E(st.message) : "") + (st.lastError ? "<br><b style='color:var(--bad)'>Lỗi:</b> " + E(st.lastError) : "") + (st.errors && st.errors.length ? "<br><b>Cảnh báo:</b> " + st.errors.map(E).join("<br>") : "") + (st.staleFrom ? "<br>Đang dùng dữ liệu tốt gần nhất lúc " + U.hm(st.staleFrom) : "") + "<br><b>Lần thử gần nhất:</b> " + U.hm(st.lastAttempt) + "</td></tr>" : "");
      }).join("") + "</tbody></table></div>";
    // nhập / xuất
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h3 style="margin-top:0">Nhập / xuất (đồng bộ bán tự động)</h3><p class="small">Dùng khi công cụ chạy trên máy/trình duyệt khác: bấm <b>Tải gói</b> ở chip "🔗 Trợ lý 1016" góc dưới công cụ nguồn, rồi nhập file vào đây. Nhập lại cùng file không cộng trùng.</p><div class="row"><button class="btn" data-act="imp">Nhập gói đồng bộ / bản sao lưu</button><button class="btn sub" data-act="backup">Sao lưu toàn bộ (JSON)</button></div>' +
      (S.state.importLog.length ? '<div class="tbl" style="margin-top:10px"><table><thead><tr><th>Lúc nhập</th><th>File</th><th>Kết quả</th></tr></thead><tbody>' + S.state.importLog.slice(0, 15).map(function (l) { return "<tr><td class='small'>" + U.hm(l.at) + "</td><td class='small'>" + E(l.file) + "<br><span class='muted'>" + E(l.kind || "") + "</span></td><td class='small'>" + l.newKeys + " mới · " + l.sameKeys + " trùng (bỏ qua) · " + (l.olderKeys || 0) + " cũ hơn" + (l.duplicate ? " · <b>file đã từng nhập</b>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") + "</div>";
    var se = S.state.settings;
    h += '<div class="card"><h3 style="margin-top:0">Cài đặt</h3><label class="small">Tên người dùng (ghi vào lịch sử, nhật ký) <input type="text" id="setUser" value="' + E(se.user) + '"></label><br><label class="small"><input type="checkbox" id="setWB"' + (se.writeBackLich ? " checked" : "") + '> Cho phép ghi ngược trạng thái hoàn thành vào công cụ Lịch (chỉ khi cùng trình duyệt, kiểm tra xung đột trước khi ghi)</label><div class="row" style="margin-top:8px"><button class="btn sm" data-act="set-save">Lưu cài đặt</button></div>' +
      '<h3>Dữ liệu DEMO</h3><p class="small">DEMO lưu riêng (khóa <code>S1016_A_DEMO</code>), có nhãn rõ, không cộng vào báo cáo thật, không xác nhận được nhật ký.</p><div class="row"><button class="btn sub sm" data-act="demo-create">' + (S.demo.exists() ? "Tạo lại DEMO" : "Tạo bộ DEMO") + '</button><button class="btn sm' + (M.isDemo() ? " red" : "") + '" data-act="demo-toggle"' + (S.demo.exists() ? "" : " disabled") + ">" + (M.isDemo() ? "Tắt chế độ DEMO" : "Bật chế độ DEMO") + '</button><button class="btn sub sm" data-act="demo-purge"' + (S.demo.exists() ? "" : " disabled") + ">Xóa toàn bộ DEMO</button></div></div></div>";
    var cc = se.cloud || {}, cs = S.cloud.status;
    h += '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Đồng bộ đám mây nhiều máy (tùy chọn - Supabase)</h3><p class="small">Trạng thái: ' + statusTag(cs.status) + " · đẩy gần nhất " + U.hm(cs.lastPush) + " · kéo gần nhất " + U.hm(cs.lastPull) + (cs.errors && cs.errors.length ? "<br><span style='color:var(--bad)'>" + cs.errors.map(E).join("<br>") + "</span>" : "") + '</p><div class="row"><input type="url" id="cUrl" placeholder="https://xxxx.supabase.co" value="' + E(cc.url) + '" style="min-width:240px"><input type="password" id="cKey" placeholder="anon public key" value="' + E(cc.key) + '"><input type="password" id="cStore" placeholder="Mã cửa hàng (bí mật)" value="' + E(cc.storeKey) + '"><label class="small"><input type="checkbox" id="cOn"' + (cc.enabled ? " checked" : "") + '> Bật</label></div><div class="row" style="margin-top:8px"><button class="btn sm" data-act="cloud-save">Lưu & kiểm tra kết nối</button><button class="btn sub sm" data-act="cloud-push">Đẩy lên</button><button class="btn sub sm" data-act="cloud-pull">Kéo về</button></div><p class="small muted">Thông tin cấu hình chỉ lưu trên máy này, không nằm trong file HTML. Hướng dẫn tạo bảng: supabase/schema.sql.</p></div>';
    h += '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Bảo trì</h3><div class="row"><button class="btn sub sm" data-act="clear-cache">Xóa bộ nhớ đệm của Trợ lý (đọc lại từ nguồn)</button><button class="btn sub sm" data-act="clear-import">Xóa dữ liệu gói nhập</button></div><p class="small muted">Không thao tác nào ở đây xóa dữ liệu của công cụ nguồn.</p></div>';
    $("m-src").innerHTML = h;
  }

  /* =================== 10. LỊCH SỬ =================== */
  function renderHist() {
    var h = head(10, "Lịch sử thay đổi", "Mỗi thay đổi ghi: thời điểm, nguồn, kênh (đồng bộ / nhập gói / người dùng / ghi ngược), bản ghi, trường, giá trị cũ → mới.");
    var srcs = {}; S.log.forEach(function (l) { srcs[l.source] = 1; });
    var q = U.normName(UI.histQ);
    var list = S.log.filter(function (l) { return (!UI.histSrc || l.source === UI.histSrc) && (!q || U.normName([l.entity, l.id, l.field, l.note, JSON.stringify(l.old), JSON.stringify(l.new)].join(" ")).indexOf(q) >= 0); }).slice().reverse();
    h += '<div class="row">' + sel("histSrc", [["", "Mọi nguồn"]].concat(Object.keys(srcs).sort().map(function (s) { return [s, s]; })), UI.histSrc, 'data-chg="histSrc"') + '<input type="text" placeholder="Tìm (mã, tên, trường...)" value="' + E(UI.histQ) + '" data-chg="histQ"><span style="flex:1"></span><span class="small muted">' + list.length + ' dòng</span><button class="btn sub sm" data-act="hist-xlsx">Xuất Excel</button></div>';
    var v = function (x) { return x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x); };
    h += '<div class="tbl" style="margin-top:8px"><table><thead><tr><th>Thời điểm</th><th>Kênh</th><th>Nguồn</th><th>Đối tượng</th><th>Mã bản ghi</th><th>Trường</th><th>Cũ</th><th>Mới</th></tr></thead><tbody>' +
      (list.length ? list.slice(0, 500).map(function (l) { return "<tr><td class='small' style='white-space:nowrap'>" + U.hm(l.at) + "</td><td class='small'>" + E(l.origin) + (l.by ? "<br>" + E(l.by) : "") + "</td><td class='small'>" + E(l.source) + "</td><td class='small'>" + E(l.entity) + "</td><td class='small'><code>" + E(l.id) + "</code>" + (l.note ? "<br>" + E(l.note) : "") + "</td><td class='small'>" + E(l.field) + "</td><td class='small'>" + E(v(l.old)).slice(0, 160) + "</td><td class='small'>" + E(v(l.new)).slice(0, 160) + "</td></tr>"; }).join("") : "<tr><td colspan='8'>" + none("Chưa có thay đổi.") + "</td></tr>") + "</tbody></table></div>";
    $("m-hist").innerHTML = h;
  }

  /* ---------- ĐIỀU PHỐI RENDER ---------- */
  var R = { ov: renderOv, cal: renderCal, task: renderTask, push: renderPush, sale: renderSale, kho: renderKho, journal: renderJournal, tools: renderTools, src: renderSrc, hist: renderHist };
  function render() {
    renderHero();
    document.querySelectorAll("#navTabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === UI.tab); });
    document.querySelectorAll("section.mod").forEach(function (s) { s.classList.toggle("on", s.id === "m-" + UI.tab); });
    try { R[UI.tab](); } catch (e) { console.error(e); $("m-" + UI.tab).innerHTML = '<div class="badbox">Lỗi hiển thị: ' + E(e.message) + "</div>"; }
  }
  UI.render = render;
  var rt = null; function soon() { clearTimeout(rt); rt = setTimeout(function () { var a = document.activeElement; if (a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type === "text") || a.tagName === "SELECT") && a.closest("section.mod")) { renderHero(); return; } render(); }, 120); }
  S.on("sync", soon); S.on("data", soon); S.on("state", soon);
  S.on("error", function (e) { toast(e.where + ": " + e.message, "bad"); });

  /* ---------- XUẤT EXCEL ---------- */
  function xKho() {
    var k = M.kho(); if (!k) return toast("Chưa có dữ liệu kho", "bad");
    var B = XW.Book(), sub = "OrderIQ → Trợ lý Điều hành · Ngày đối chiếu " + U.dmy(ymd8(k.refDate)) + " · Tồn tháng " + k.latestMonth + " · Xuất lúc " + nowStamp();
    var fg = Object.keys(k.forgotRows).map(function (x) { return k.forgotRows[x]; });
    var sh = B.addSheet("SKU quên đặt", { title: "BÁO CÁO SKU QUÊN ĐẶT / KHÔNG ĐẶT (" + fg.length + " MÃ)", subtitle: sub + (k.forgot ? " · Kỳ " + U.dmy(ymd8(k.forgot.ref)) : ""), cols: [6, 16, 32, 22, 16, 9, 9, 10, 28, 18, 34, 26, 16] });
    B.table(sh, [{ h: "STT", t: "stt" }, { h: "Barcode", t: "code" }, { h: "Tên hàng", t: "wrap" }, { h: "NCC", t: "wrap" }, { h: "SUP phụ trách", t: "textB" }, { h: "Tồn khi lập", t: "int" }, { h: "Bán TB/ngày", t: "dec" }, { h: "Đề xuất đặt", t: "int" }, { h: "Dấu hiệu", t: "wrap" }, { h: "Trạng thái", t: "center" }, { h: "Lý do", t: "wrap" }, { h: "Hướng xử lý / PO mới", t: "wrap" }, { h: "Cập nhật", t: "center" }],
      fg.map(function (r, i) { return [i + 1, r.bc, r.name, r.supName || r.sup, r.owner || "", r.stock, r.rate, r.rec, r.types.join("\n"), r.statusText, [r.reasonCode, r.reason].filter(Boolean).join(" - "), r.poNew && r.poNew.length ? "PO mới: " + r.poNew.join(", ") : "", r.at ? U.hm(r.at) + (r.by ? " · " + r.by : "") : ""]; }), { main: true, freezeCol: 3, emptyText: "OrderIQ chưa lập kỳ giải trình" });
    B.note(sh, "Lý do và SUP phụ trách cập nhật tại OrderIQ (nguồn chuẩn). Dòng chưa có lý do cần SUP giải trình.");
    var it = Object.keys(k.items).map(function (x) { return k.items[x]; });
    var s2 = B.addSheet("Mã cần xử lý", { title: "MÃ HÀNG CẦN XỬ LÝ (" + it.length + " MÃ)", subtitle: sub, cols: [6, 16, 32, 14, 22, 9, 9, 10, 10, 10, 14] });
    B.table(s2, [{ h: "STT", t: "stt" }, { h: "Barcode", t: "code" }, { h: "Tên hàng", t: "wrap" }, { h: "CAT", t: "text" }, { h: "NCC", t: "wrap" }, { h: "Tồn", t: "int" }, { h: "Bán TB/ngày", t: "dec" }, { h: "Đủ bán (ngày)", t: "dec" }, { h: "Đang chờ giao", t: "int" }, { h: "Đề xuất đặt", t: "int" }, { h: "Trạng thái", t: "center" }],
      it.map(function (r, i) { return [i + 1, r.bc, r.name, r.catName || r.cat, r.supName || r.sup, r.stock, r.rate, r.daysLeft, r.onOrder, r.rec, r.statusText]; }), { main: true, freezeCol: 3 });
    B.save("Kohnan_TroLy1016_SKUQuenDat_" + fileStamp() + ".xlsx");
  }
  function xPush() {
    var pm = M.pushMerged(UI.pushMonth), sum = M.pushSummary(pm), pids = Object.keys(pm.products); if (!pids.length) return toast("Chưa có dữ liệu", "bad");
    var B = XW.Book(), cols = [{ h: "STT", t: "stt" }, { h: "Nhân viên", t: "textB" }, { h: "Vị trí", t: "text" }], widths = [6, 26, 16];
    pids.forEach(function (pid) { var l = pm.products[pid].label; cols.push({ h: l + " - Chỉ tiêu", t: "int" }, { h: l + " - Thực hiện", t: "dec" }, { h: l + " - Tỷ lệ", t: "pct" }); widths.push(12, 12, 10); });
    var sh = B.addSheet("Theo nhân viên", { title: "PUSH SALE " + ymLabel(UI.pushMonth).toUpperCase() + " THEO NHÂN VIÊN", subtitle: "Trợ lý Điều hành · Nguồn: " + pm.sources.map(function (s) { return s.name; }).join("; ") + " · Xuất lúc " + nowStamp(), cols: widths });
    var rows = Object.keys(sum.rows).map(function (k, i) { var r = sum.rows[k], a = [i + 1, r.name, r.role]; pids.forEach(function (pid) { var c = r.p[pid] || {}; a.push(c.target == null ? "" : c.target, c.actual || 0, c.target ? (c.actual || 0) / c.target : ""); }); return a; });
    var tot = ["", "TOÀN ĐỘI", ""]; pids.forEach(function (pid) { var t = sum.team[pid]; tot.push(t.target, t.actual, t.target ? t.actual / t.target : ""); });
    B.table(sh, cols, rows, { main: true, freezeCol: 2, total: tot });
    B.note(sh, "Chỉ tính bản ghi có hóa đơn đi kèm; trùng giữa các tracker tính 1 lần theo tracker ưu tiên. Ô chỉ tiêu trống = chưa giao chỉ tiêu.");
    B.save("Kohnan_TroLy1016_PushSale_" + UI.pushMonth + "_" + fileStamp() + ".xlsx");
  }
  function xHist() {
    var B = XW.Book(), list = S.log.slice().reverse().slice(0, 3000);
    var sh = B.addSheet("Lịch sử", { title: "LỊCH SỬ THAY ĐỔI (" + list.length + " DÒNG)", subtitle: "Trợ lý Điều hành · Xuất lúc " + nowStamp(), cols: [17, 14, 14, 14, 30, 16, 30, 30] });
    var v = function (x) { return x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x); };
    B.table(sh, [{ h: "Thời điểm", t: "center" }, { h: "Kênh", t: "text" }, { h: "Nguồn", t: "text" }, { h: "Đối tượng", t: "text" }, { h: "Mã bản ghi", t: "wrap" }, { h: "Trường", t: "text" }, { h: "Cũ", t: "wrap" }, { h: "Mới", t: "wrap" }], list.map(function (l) { return [U.hm(l.at), l.origin, l.source, l.entity, l.id, l.field, v(l.old).slice(0, 300), v(l.new).slice(0, 300)]; }), { main: true });
    B.save("Kohnan_TroLy1016_LichSu_" + fileStamp() + ".xlsx");
  }
  function xJournal() {
    var j = S.state.journals["J:" + UI.date]; if (!j) return;
    var B = XW.Book(), sh = B.addSheet("Nhật ký", { title: "NHẬT KÝ CUỐI NGÀY " + U.dmy(j.date), subtitle: "Trợ lý Điều hành · " + (j.status === "confirmed" ? "Xác nhận bởi " + j.confirmedBy + " lúc " + U.hm(j.confirmedAt) : "BẢN NHÁP") + " · Xuất lúc " + nowStamp(), cols: [34, 90], landscape: false });
    B.table(sh, [{ h: "Mục", t: "textB" }, { h: "Nội dung", t: "wrap" }], M.JOURNAL_SECTIONS.map(function (s) { return [s[1], j.sections[s[0]] || ""]; }), {});
    B.save("Kohnan_TroLy1016_NhatKy_" + j.date.split("-").reverse().join("-") + ".xlsx");
  }

  /* ---------- SỰ KIỆN ---------- */
  function findTask(id) { return M.tasksOn(UI.date).filter(function (t) { return t.id === id; })[0]; }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act],[data-tab]"); if (!b) return;
    if (b.closest("#navTabs") && b.dataset.tab) { UI.tab = b.dataset.tab; saveUI(); render(); window.scrollTo(0, 0); return; }
    var a = b.dataset.act, id = b.dataset.id, r;
    switch (a) {
      case "day-prev": UI.date = U.addDays(UI.date, -1); render(); break;
      case "day-next": UI.date = U.addDays(UI.date, 1); render(); break;
      case "day-today": UI.date = U.todayIso(); render(); break;
      case "sync-all": S.syncAll().then(function () { toast("Đã đồng bộ lại tất cả nguồn"); }); render(); break;
      case "goto": UI.tab = b.dataset.tab; render(); break;
      case "calview": UI.calView = b.dataset.v; saveUI(); render(); break;
      case "pickday": UI.date = b.dataset.d; if (b.dataset.tab2) UI.tab = b.dataset.tab2; else if (UI.tab === "cal") UI.calView = "day"; render(); break;
      case "taskview": UI.taskView = b.dataset.v; render(); break;
      case "t-open": UI.open[id] = !UI.open[id]; render(); break;
      case "t-toggle": { var t = findTask(id); if (!t) break; r = M.updateTask(t, { status: t.status === "done" ? "todo" : "done" }); if (!r.ok) toast(r.error, "bad"); render(); break; }
      case "t-save": { var t2 = findTask(id); if (!t2) break; var k = U.hash(id), g = function (p) { var el = $(p + k); return el ? el.value : undefined; };
        r = M.updateTask(t2, { assignee: g("ta_"), helper: g("th_"), checker: g("tc_"), status: g("ts_"), priority: g("tp_"), due: g("tdu_"), result: g("tr_").trim(), reason: g("tl_").trim() });
        if (r.ok) { UI.open[id] = false; toast("Đã lưu công việc", "ok"); } else toast(r.error, "bad"); render(); break; }
      case "t-carry": { var t3 = findTask(id); if (!t3) break; r = M.carryOver(t3); toast(r.ok ? "Đã chuyển sang " + U.dmy(U.addDays(t3.date, 1)) : r.error, r.ok ? "ok" : "bad"); render(); break; }
      case "ah-add": r = M.addAdhoc({ date: UI.date, title: $("ahTitle").value, assignee: $("ahWho").value, priority: $("ahPri").value, due: $("ahDue").value, desc: $("ahDesc").value }); toast(r.ok ? "Đã thêm công việc" : r.error, r.ok ? "ok" : "bad"); if (r.ok) render(); break;
      case "auto-assign": { if (M.isDemo()) { toast("Chế độ DEMO", "bad"); break; } var n = 0, multi = 0; M.tasksOn(UI.date).forEach(function (t) { if (t.assignee || t.status === "done" || t.kind !== "template") return; var s = M.suggestAssignees(t.role, UI.date); if (s.length === 1) { M.updateTask(t, { assignee: s[0] }); n++; } else if (s.length > 1) multi++; });
        toast("Đã phân công " + n + " việc theo ca (vị trí có 1 người trong ca)." + (multi ? " " + multi + " việc có nhiều người cùng vị trí - chọn tay." : ""), "ok"); render(); break; }
      case "pushscope": UI.pushScope = b.dataset.v; render(); break;
      case "push-xlsx": xPush(); break;
      case "khotab": UI.khoTab = b.dataset.v; UI.khoSt = ""; render(); break;
      case "kho-xlsx": xKho(); break;
      case "hist-xlsx": xHist(); break;
      case "j-gen": { var ex = draftBuf[UI.date] || S.state.journals["J:" + UI.date]; if (ex && !confirm("Tạo lại sẽ thay nội dung bản nháp hiện tại bằng số liệu mới nhất. Tiếp tục?")) break; var dr = M.journalDraft(UI.date); draftBuf[UI.date] = { sections: dr.sections, base: dr }; render(); break; }
      case "j-save": { var cur = draftBuf[UI.date] || { sections: S.state.journals["J:" + UI.date].sections, base: S.state.journals["J:" + UI.date] }; r = M.saveJournalDraft(UI.date, cur.sections, cur.base); toast(r.ok ? "Đã lưu BẢN NHÁP" : r.error, r.ok ? "ok" : "bad"); if (r.ok) delete draftBuf[UI.date]; render(); break; }
      case "j-confirm": { var c2 = draftBuf[UI.date]; if (c2) { r = M.saveJournalDraft(UI.date, c2.sections, c2.base); if (!r.ok) { toast(r.error, "bad"); break; } delete draftBuf[UI.date]; }
        if (!confirm("Xác nhận lưu nhật ký chính thức ngày " + U.dmy(UI.date) + "? Sau khi xác nhận không sửa được.")) break;
        r = M.confirmJournal(UI.date, $("jWho").value); toast(r.ok ? "Đã lưu nhật ký chính thức" : r.error, r.ok ? "ok" : "bad"); render(); break; }
      case "j-print": window.print(); break;
      case "j-xlsx": xJournal(); break;
      case "src-sync": S.syncSource(id, { origin: "Đồng bộ (thủ công)" }).then(function (st) { toast(b.closest("tr").querySelector("b").textContent + ": " + (S.STATUS[st.status] || st.status), st.status === "fail" ? "bad" : "ok"); }); break;
      case "src-open": UI.srcOpen[id] = !UI.srcOpen[id]; render(); break;
      case "imp": $("fileImport").click(); break;
      case "backup": { var blob = new Blob([JSON.stringify(S.backup())], { type: "application/json" }), el = document.createElement("a"); el.href = URL.createObjectURL(blob); el.download = "S1016_TroLy_SaoLuu_" + fileStamp() + ".json"; document.body.appendChild(el); el.click(); setTimeout(function () { URL.revokeObjectURL(el.href); el.remove(); }, 1500); break; }
      case "set-save": S.state.settings.user = $("setUser").value.trim(); var wbOld = S.state.settings.writeBackLich; S.state.settings.writeBackLich = $("setWB").checked; if (wbOld !== S.state.settings.writeBackLich) S.userAction("Cài đặt", "writeBackLich", "ghi ngược", wbOld, S.state.settings.writeBackLich); S.saveState("settings"); toast("Đã lưu cài đặt", "ok"); break;
      case "demo-create": S.demo.create(); toast("Đã tạo bộ DEMO (lưu riêng)", "ok"); render(); break;
      case "demo-toggle": S.state.settings.demoMode = !S.state.settings.demoMode; S.userAction("Cài đặt", "demoMode", "chế độ DEMO", !S.state.settings.demoMode, S.state.settings.demoMode); S.saveState("demo"); render(); break;
      case "demo-purge": if (confirm("Xóa toàn bộ dữ liệu DEMO? Dữ liệu thật không bị ảnh hưởng.")) { S.demo.purge(); toast("Đã xóa DEMO", "ok"); render(); } break;
      case "cloud-save": S.state.settings.cloud = { url: $("cUrl").value.trim(), key: $("cKey").value.trim(), storeKey: $("cStore").value.trim(), enabled: $("cOn").checked }; S.saveState("cloud");
        S.cloud.test().then(function (x) { toast(x.ok ? "Kết nối đám mây thành công" : "Kết nối thất bại: " + x.error, x.ok ? "ok" : "bad"); S.syncSource("CLOUD"); render(); }); break;
      case "cloud-push": S.cloud.push().then(function (x) { toast(x.ok ? "Đã đẩy " + x.pushed + " khóa" + (x.conflicts ? ", " + x.conflicts + " xung đột đã gộp" : "") : "Đẩy thất bại: " + (x.error || x.errors.join("; ")), x.ok ? "ok" : "bad"); render(); }); break;
      case "cloud-pull": S.cloud.pull().then(function (x) { toast(x.ok ? "Đã kéo, áp dụng " + x.applied + " khóa" : "Kéo thất bại: " + x.error, x.ok ? "ok" : "bad"); render(); }); break;
      case "clear-cache": if (confirm("Xóa bộ nhớ đệm của Trợ lý và đọc lại từ nguồn?")) { S.cache = {}; S.raw.del(S.KEYS.CACHE); S.syncAll(); } break;
      case "clear-import": if (confirm("Xóa toàn bộ dữ liệu đã nhập từ gói (không ảnh hưởng công cụ nguồn trên máy này)?")) { S.imports = { items: {}, at: {} }; S.writeJ(S.KEYS.IMPORT, S.imports); S.addLog([{ origin: "Người dùng", source: "IMPORT", entity: "gói nhập", id: "*", field: "xóa", old: null, new: "đã xóa" }]); S.syncAll(); } break;
    }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "selDate" && el.value) { UI.date = el.value; render(); return; }
    var c = el.dataset.chg; if (!c) return;
    if (c === "tf") { UI.tf[el.dataset.k] = el.value; render(); }
    else if (c === "pushMonth") { UI.pushMonth = el.value; render(); }
    else if (c === "saleMonth") { UI.saleMonth = el.value; render(); }
    else if (c === "khoQ") { UI.khoQ = el.value; render(); }
    else if (c === "khoSt") { UI.khoSt = el.value; render(); }
    else if (c === "histQ") { UI.histQ = el.value; render(); }
    else if (c === "histSrc") { UI.histSrc = el.value; render(); }
  });
  document.addEventListener("input", function (e) {
    var el = e.target; if (el.dataset.chg !== "jsec") return;
    var d = draftBuf[UI.date]; if (!d) { var j = S.state.journals["J:" + UI.date]; d = draftBuf[UI.date] = { sections: U.clone(j.sections), base: { metrics: j.metrics, sources: j.sources } }; }
    d.sections[el.dataset.k] = el.value;
  });
  $("fileImport").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files || []); e.target.value = "";
    files.reduce(function (p, f) { return p.then(function () { return f.text().then(function (txt) { var r = S.importPackage(txt, f.name);
      toast(r.ok ? (r.restored ? "Đã khôi phục bản sao lưu" : f.name + ": " + r.newKeys + " mới · " + r.sameKeys + " trùng (bỏ qua)" + (r.duplicateFile ? " - file này đã từng nhập" : "")) : f.name + ": " + r.error, r.ok ? "ok" : "bad"); }); }); }, Promise.resolve())
      .then(function () { return S.syncAll(); }).then(render);
  });

  /* ---------- KHỞI ĐỘNG ---------- */
  render();
  S.syncAll().then(function () { render(); if (S.cloud.enabled()) S.cloud.pull(); });
  S.watch();
  setInterval(function () { if (UI.tab === "ov" && !document.hidden) renderHero(); }, 30000);
})();
