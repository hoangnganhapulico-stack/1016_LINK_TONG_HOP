/* =====================================================================
   S1016 HOME - Bảng điều hành "Hôm nay" + Trung tâm công cụ (gọn, ẩn tháng cũ)
   Chỉ ĐỌC dữ liệu qua S1016.model. Dữ liệu riêng của trang (ghim, checklist,
   ghi chú nhanh) lưu trong localStorage của trình duyệt này.
   ===================================================================== */
(function () {
  "use strict";
  var S = window.S1016, U = S.util, M = S.model, E = U.esc;
  var H = S.home = { open: {} };
  var K = { PIN: "S1016_A_PINS_V1", NOTE: "S1016_A_QNOTE_V1", CHK: "S1016_A_CHECK_V1", TPL: "S1016_A_CHECK_TPL_V1" };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function money(n) { if (n == null || !isFinite(n)) return "-"; return Math.abs(n) >= 1e9 ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n / 1e9) + " tỷ" : U.fmtM(n); }
  function ui() { return S.ui || {}; }
  function h() { return (S.ui && S.ui.h) || {}; }
  function src(id) { return h().srcTag ? h().srcTag(id) : ""; }

  /* ---------------- DANH MỤC CÔNG CỤ ---------------- */
  var GROUPS = [
    ["van-hanh", "Vận hành team"], ["kho", "Kho · Đặt hàng · Trưng bày"], ["doanh-so", "Doanh số"],
    ["push-sale", "Push Sale"], ["ke-hoach", "Kế hoạch & báo cáo"], ["doi-tac", "Khách hàng & đối tác"], ["tai-lieu", "Tài liệu học tập"]
  ];
  var MON_EN = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  var DEFAULT_PINS = [/Check_Ton_Gia_KM/i, /OrderIQ_Dat_Hang_Ton_Kho/i, /LICH_LAM_VIEC_1016/i, /SO_TAY_TEAM_ADMIN/i, /xinhangmiennam/i, /KHO_KIEM_DATE/i];
  var SRC_TOOL = { LICH: /LICH_LAM_VIEC_1016/i, LICH_TASKS: /LICH_LAM_VIEC_1016/i, BUDGET: /LICH_LAM_VIEC_1016/i, TA: /SO_TAY_TEAM_ADMIN/i, KHO: /OrderIQ_Dat_Hang_Ton_Kho/i };

  function curYm() { return U.todayIso().slice(0, 7); }
  function ymOf(y, m) { return y + "-" + U.pad(m); }
  function toolMonth(t) {
    var s = (t.name || "") + " " + (t.href || ""), y = +curYm().slice(0, 4), m;
    if ((m = s.match(/[\/_](20\d\d)-(\d\d)[\/_]/))) return ymOf(m[1], +m[2]);
    if ((m = (t.name || "").match(/(?:^|\s)T(1[0-2]|[1-9])\b/))) return ymOf(y, +m[1]);
    if ((m = (t.name || "").match(/Tháng\s*(1[0-2]|[1-9])\b/i))) return ymOf(y, +m[1]);
    if ((m = (t.href || "").match(/_T(1[0-2]|[1-9])(?:_|\/|$)/))) return ymOf(y, +m[1]);
    if ((m = (t.href || "").match(/_(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)_/i))) return ymOf(y, MON_EN[m[1].toUpperCase()]);
    return null;
  }
  H.catalog = function () {
    var reg = window.S1016_TOOLS || { tools: [] }, seen = {}, out = [];
    reg.tools.forEach(function (t) {
      if (/08_TRO_LY_DIEU_HANH\/?$/.test(t.href || "")) return;
      var key = (t.href || t.name).replace(/\/index\.html$/, "/");
      var c = seen[key];
      if (c) { if (c.groupId === "hay-dung" && t.groupId !== "hay-dung") { c.groupId = t.groupId; c.group = t.group; } return; }
      c = {}; for (var k in t) c[k] = t[k];
      c.key = key; c.month = toolMonth(t); c.old = !!(c.month && c.month < curYm());
      seen[key] = c; out.push(c);
    });
    return out;
  };
  function pins() {
    var p = lsGet(K.PIN, null);
    if (p) return p;
    return H.catalog().filter(function (t) { return DEFAULT_PINS.some(function (r) { return r.test(t.href || ""); }); }).map(function (t) { return t.key; });
  }
  function isPinned(key) { return pins().indexOf(key) >= 0; }
  function togglePin(key) { var p = pins(), i = p.indexOf(key); if (i >= 0) p.splice(i, 1); else p.push(key); lsSet(K.PIN, p); }
  function toolFor(re) { return H.catalog().filter(function (t) { return re.test(t.href || ""); })[0]; }
  function saleTool() { var c = H.catalog().filter(function (t) { return t.groupId === "doanh-so" && /Dashboard_Sale|Dashboard Sale|Sale Plan/i.test(t.name + t.href) && t.month === curYm(); }); return c[0] || toolFor(/DS_Dashboard_Sale_1016_T10/i); }
  function linkBtn(t, label, cls) {
    if (!t) return "";
    if (!/^https?:/.test(t.href || "")) return '<span class="tag grey" title="Chỉ có trên máy">Chỉ trên máy</span>';
    return '<a class="btn sm ' + (cls || "") + '" target="_blank" rel="noopener" href="' + E(t.href) + '">' + E(label || "Mở") + " ↗</a>";
  }

  /* ---------------- BUDGET & DOANH SỐ THÁNG ---------------- */
  function daysOfMonth(ym) { var d = U.dateOf(ym + "-01"), out = []; while (U.isoOf(d).slice(0, 7) === ym) { out.push(U.isoOf(d)); d.setDate(d.getDate() + 1); } return out; }
  function budgetOf(iso) {
    var v = M.budgetDay(iso); if (v != null && isFinite(v)) return v;
    var b = window.S1016_BUDGET_2026 && window.S1016_BUDGET_2026.byDate; return b && b[iso] != null ? b[iso] * 1000 : null;
  }
  H.month = function (iso) {
    var ym = iso.slice(0, 7), days = daysOfMonth(ym), sale = M.sale(ym), act = {}, lastSale = null;
    if (sale && sale.byDate) sale.byDate.forEach(function (d) { if (d && d.iso && isFinite(d.revenue)) { act[d.iso] = d.revenue; if (!lastSale || d.iso > lastSale) lastSale = d.iso; } });
    var bud = {}, bMonth = 0, avg; days.forEach(function (d) { var b = (sale && sale.budgetByDate && isFinite(sale.budgetByDate[d]) && sale.budgetByDate[d] > 0) ? sale.budgetByDate[d] : budgetOf(d); bud[d] = b; bMonth += b || 0; });
    avg = bMonth / days.length;
    var cut = lastSale && lastSale < iso ? lastSale : (lastSale ? iso : U.addDays(iso, -1));
    var mtdA = 0, mtdB = 0; days.forEach(function (d) { if (d <= cut) { mtdB += bud[d] || 0; mtdA += act[d] || 0; } });
    var left = days.filter(function (d) { return d > cut; }), bLeft = 0; left.forEach(function (d) { bLeft += bud[d] || 0; });
    var remain = bMonth - mtdA;
    return { ym: ym, days: days, bud: bud, act: act, hasSale: !!lastSale, lastSale: lastSale, cut: cut, bMonth: bMonth, avg: avg, mtdA: mtdA, mtdB: mtdB, daysLeft: left.length, bLeft: bLeft, remain: remain, perDay: left.length ? remain / left.length : null, sale: sale };
  }

  function chartSvg(mo, iso) {
    var W = 720, Hh = 170, pad = 26, n = mo.days.length, bw = (W - pad) / n, mx = 0;
    mo.days.forEach(function (d) { mx = Math.max(mx, mo.bud[d] || 0, mo.act[d] || 0); });
    if (!mx) return '<div class="empty">Chưa có Budget tháng này.</div>';
    var y = function (v) { return Hh - 18 - (v / mx) * (Hh - 34); }, out = [];
    out.push('<line x1="' + pad + '" x2="' + W + '" y1="' + (Hh - 18) + '" y2="' + (Hh - 18) + '" class="ax"/>');
    mo.days.forEach(function (d, i) {
      var x = pad + i * bw, b = mo.bud[d] || 0, a = mo.act[d], we = [0, 6].indexOf(U.dateOf(d).getDay()) >= 0;
      out.push('<rect class="bb' + (we ? " we" : "") + '" x="' + (x + 1).toFixed(1) + '" y="' + y(b).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + (Hh - 18 - y(b)).toFixed(1) + '"><title>' + U.dm(d) + " Budget " + U.fmtM(b) + (a != null ? " · Thực đạt " + U.fmtM(a) : "") + "</title></rect>");
      if (a != null) out.push('<rect class="ab' + (a >= b ? " hit" : "") + '" x="' + (x + bw * 0.22).toFixed(1) + '" y="' + y(a).toFixed(1) + '" width="' + (bw * 0.56).toFixed(1) + '" height="' + (Hh - 18 - y(a)).toFixed(1) + '"><title>' + U.dm(d) + " Thực đạt " + U.fmtM(a) + " / Budget " + U.fmtM(b) + "</title></rect>");
      if (d === iso) out.push('<rect class="today" x="' + x.toFixed(1) + '" y="4" width="' + bw.toFixed(1) + '" height="' + (Hh - 22) + '"/>');
      if (i % (n > 20 ? 2 : 1) === 0 || d === iso) out.push('<text class="lb' + (d === iso ? " on" : "") + '" x="' + (x + bw / 2).toFixed(1) + '" y="' + (Hh - 4) + '">' + (+d.slice(8)) + "</text>");
    });
    out.push('<text class="lb yl" x="2" y="' + (y(mx) + 4).toFixed(1) + '">' + U.fmt1(mx / 1e6) + "tr</text>");
    return '<svg class="mchart" viewBox="0 0 ' + W + " " + Hh + '" preserveAspectRatio="none" role="img" aria-label="Budget và doanh số theo ngày">' + out.join("") + "</svg>" +
      '<div class="legend"><span><i class="lg-b"></i>Budget ngày</span><span><i class="lg-we"></i>Cuối tuần</span><span><i class="lg-a"></i>Thực đạt</span><span><i class="lg-hit"></i>Vượt Budget</span></div>';
  }

  /* ---------------- CHECKLIST & GHI CHÚ ---------------- */
  var DEFAULT_TPL = ["Xem lịch ca, phân công vị trí đầu ca", "Báo target ngày + sản phẩm Push Sale cho team", "Kiểm tra hàng hết / sắp hết (OrderIQ)", "Kiểm date & hàng cận hạn", "Đặt hàng / theo dõi PO, hàng về", "Kiểm tra quầy thu ngân, voucher, đổi trả", "Theo dõi doanh số giữa ca, nhắc team", "Nhật ký & bàn giao cuối ca"];
  function tpl() { var t = lsGet(K.TPL, null); return t && t.length ? t : DEFAULT_TPL; }
  function chkState(iso) { var all = lsGet(K.CHK, {}); return all[iso] || {}; }
  function setChk(iso, i, v) { var all = lsGet(K.CHK, {}); all[iso] = all[iso] || {}; if (v) all[iso][i] = 1; else delete all[iso][i]; var ks = Object.keys(all).sort(); while (ks.length > 60) delete all[ks.shift()]; lsSet(K.CHK, all); }

  /* ---------------- KHỐI HIỂN THỊ ---------------- */
  function tile(label, val, sub, tone, extra) { return '<div class="tile ' + (tone || "") + '"><div class="tl">' + label + '</div><div class="tv">' + val + '</div><div class="ts">' + (sub || "") + "</div>" + (extra || "") + "</div>"; }
  function pbar(p) { if (p == null || !isFinite(p)) return ""; var c = p >= 100 ? "ok" : p >= 85 ? "" : p >= 60 ? "warn" : "bad"; return '<div class="bar"><i class="' + c + '" style="width:' + Math.min(100, Math.max(0, p)) + '%"></i></div>'; }
  function det(k, summary, body, defOpen) { var op = H.open[k] != null ? H.open[k] : !!defOpen; return '<details class="hd" data-k="' + k + '"' + (op ? " open" : "") + "><summary>" + summary + "</summary>" + body + "</details>"; }
  function sec(title, right) { return '<div class="hsec"><h3>' + title + "</h3>" + (right || "") + "</div>"; }

  H.overview = function (iso) {
    var o = M.overview(iso), mo = H.month(iso), today = U.todayIso(), d = U.dateOf(iso), out = [];
    var bDay = mo.bud[iso], vsAvg = bDay && mo.avg ? (bDay / mo.avg - 1) * 100 : null;
    var note = o.note;
    // --- dòng chào ---
    var hr = U.now().getHours(), hi = hr < 11 ? "Chào buổi sáng" : hr < 14 ? "Chào buổi trưa" : hr < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    out.push('<div class="hello"><div><b>' + (iso === today ? hi + "!" : "Đang xem ngày khác") + "</b> " + U.WDF[d.getDay()] + ", " + U.dmy(iso) +
      " · còn <b>" + mo.days.filter(function (x) { return x > iso; }).length + " ngày</b> đến hết tháng" + (note ? ' · <span class="tag bad">📌 ' + E(note) + "</span>" : "") + "</div>" +
      '<div class="hello-r">' + (iso !== today ? '<button class="btn sm" data-act="day-today">Về hôm nay</button>' : '<span class="tag">' + E(M.BUCKET[M.currentBucket()]) + " đang diễn ra</span>") + "</div></div>");

    // --- ô số liệu chính ---
    var T = [];
    T.push(tile("Target hôm nay", bDay ? U.fmtM(bDay) : "Chưa có", (bDay ? U.fmtVnd(bDay) + " chưa thuế" : "") + (vsAvg != null ? '<br><span class="' + (vsAvg >= 0 ? "up" : "dn") + '">' + (vsAvg >= 0 ? "▲ " : "▼ ") + U.fmt1(Math.abs(vsAvg)) + "% so TB ngày tháng</span>" : ""), "navy"));
    if (mo.hasSale) {
      var la = mo.act[mo.lastSale], lb = mo.bud[mo.lastSale], lp = U.pct(la, lb);
      T.push(tile("Doanh số " + U.dm(mo.lastSale), U.fmtM(la), "Budget " + U.fmtM(lb) + " · đạt <b>" + U.fmtPct(lp) + "</b>", lp >= 100 ? "ok" : lp >= 85 ? "" : "bad", pbar(lp)));
      var mp = U.pct(mo.mtdA, mo.mtdB), mpm = U.pct(mo.mtdA, mo.bMonth);
      T.push(tile("Lũy kế tháng", U.fmtPct(mp), money(mo.mtdA) + " / " + money(mo.mtdB) + " Budget lũy kế<br>Đã đạt " + U.fmtPct(mpm) + " Budget cả tháng", mp >= 100 ? "ok" : mp >= 90 ? "" : "bad", pbar(mp)));
      T.push(tile("Cần bán mỗi ngày", mo.perDay != null ? U.fmtM(mo.perDay) : "-", "Còn thiếu " + money(Math.max(0, mo.remain)) + " / " + mo.daysLeft + " ngày<br>" + (mo.perDay != null && mo.bLeft ? "Cao hơn Budget còn lại " + U.fmtPct((mo.remain / mo.bLeft - 1) * 100) : ""), mo.bLeft && mo.remain > mo.bLeft ? "warn" : "ok"));
    } else {
      T.push(tile("Budget tháng " + (+mo.ym.slice(5)), money(mo.bMonth), "Lũy kế đến " + U.dm(mo.cut) + ": " + money(mo.mtdB) + "<br>TB " + U.fmtM(mo.avg) + "/ngày", ""));
      var st = saleTool();
      T.push(tile("Doanh số thực đạt", "Chưa có", "Nạp file POS vào Dashboard Sale tháng này để Trợ lý tự tính % đạt và cần bán/ngày.<br>" + linkBtn(st, "Mở Dashboard Sale"), "grey"));
    }
    if (o.shifts) {
      var on = o.shifts.filter(function (s) { return s.kind === "shift"; }), act = on.filter(function (s) { return M.isActive(s, iso); });
      T.push(tile("Nhân sự", on.length + " đi làm", (iso === today ? "<b>" + act.length + "</b> đang trong ca · " : "") + (o.shifts.length - on.length) + " nghỉ", ""));
    } else T.push(tile("Nhân sự", "Chưa có lịch", "Mở Lịch làm việc 1 lần để đồng bộ<br>" + linkBtn(toolFor(/LICH_LAM_VIEC_1016/i), "Mở Lịch"), "grey"));
    var ts = o.taskStats;
    T.push(tile("Công việc", ts.total ? ts.done + "/" + ts.total : "0", ts.total ? (ts.overdue ? '<b class="dn">' + ts.overdue + " quá hạn</b> · " : "") + ts.doing + " đang làm · " + ts.unassigned + " chưa giao" : "Chưa có việc ngày này", ts.overdue ? "bad" : ts.total && ts.done === ts.total ? "ok" : "", ts.total ? pbar(U.pct(ts.done, ts.total)) : ""));
    var pp = Object.keys(o.push.pm.products);
    if (pp.length) { var p0 = o.push.mtd.team[pp[0]], pr = U.pct(p0.actual, p0.target); T.push(tile("Push Sale", U.fmtPct(pr), pp.map(function (pid) { var p = o.push.pm.products[pid], m = o.push.mtd.team[pid], dd = o.push.day.team[pid]; return E(p.label) + ": " + U.fmt1(m.actual) + "/" + U.fmtInt(m.target) + " · hôm nay " + U.fmt1(dd.actual) + "/" + U.fmt1(dd.dayTarget); }).join("<br>"), pr >= 100 ? "ok" : "", pbar(pr))); }
    else T.push(tile("Push Sale", "Chưa có", "Chưa có tracker tháng " + (+iso.slice(5, 7)) + " trong trình duyệt", "grey"));
    if (o.kho) T.push(tile("Kho", o.kho.counts.oos + " hết · " + o.kho.counts.low + " sắp hết", o.kho.counts.recPositive + " mã đề xuất đặt" + (o.kho.forgot ? " · " + Object.keys(o.kho.forgotRows).length + " SKU quên đặt" : ""), o.kho.counts.oos ? "bad" : ""));
    else T.push(tile("Kho", "Chưa có", "Mở OrderIQ để đồng bộ<br>" + linkBtn(toolFor(/OrderIQ_Dat_Hang_Ton_Kho/i), "Mở OrderIQ"), "grey"));
    out.push('<div class="tiles">' + T.join("") + "</div>");

    // --- truy cập nhanh ---
    var cat = H.catalog(), pk = pins(), qk = cat.filter(function (t) { return pk.indexOf(t.key) >= 0; });
    var cm = cat.filter(function (t) { return t.month === curYm() && pk.indexOf(t.key) < 0; });
    out.push(sec("Truy cập nhanh", '<button class="btn sub sm" data-act="goto" data-tab="tools">Tất cả công cụ →</button>') +
      '<div class="quick">' + qk.map(function (t) { return '<a class="qk" target="_blank" rel="noopener" href="' + E(t.href) + '"><b>' + E(t.name) + "</b><span>" + E(groupName(t.groupId)) + "</span></a>"; }).join("") +
      cm.map(function (t) { return '<a class="qk cur" target="_blank" rel="noopener" href="' + E(t.href) + '"><b>' + E(t.name) + '</b><span>Tháng ' + (+t.month.slice(5)) + " · " + E(groupName(t.groupId)) + "</span></a>"; }).join("") +
      (qk.length + cm.length ? "" : '<div class="empty">Chưa ghim công cụ nào. Vào tab Công cụ, bấm ☆ để ghim.</div>') + "</div>");

    // --- việc + cảnh báo | nhân sự ---
    var tasks = o.tasks.slice().sort(function (a, b) { var r = function (t) { return t.status === "done" ? 3 : t.overdue ? 0 : t.priority && t.priority !== "Bình thường" ? 1 : 2; }; return r(a) - r(b); });
    var tl = tasks.slice(0, 10).map(function (t) { var dn = t.status === "done";
      return '<div class="trow' + (dn ? " done" : "") + '"><button class="chk' + (dn ? " on" : "") + '" data-act="t-toggle" data-id="' + E(t.id) + '" aria-label="Đánh dấu hoàn thành">' + (dn ? "✓" : "") + '</button><div class="tt"><b>' + E(t.title) + '</b><span>' + (t.assignee ? E(t.assignee) : '<em class="dn">Chưa giao</em>') + (t.due ? " · hạn " + E(t.due) : "") + "</span></div>" + (t.overdue ? '<span class="tag bad">Quá hạn</span>' : '<span class="tag ' + (dn ? "ok" : "grey") + '">' + E(M.STATUS[t.status] || "") + "</span>") + "</div>";
    }).join("");
    var al = [];
    S.sources.forEach(function (s) { var st = S.sync[s.id] || {}; if (st.status === "fail") al.push('<div class="al bad"><b>' + E(s.name) + "</b> đồng bộ lỗi" + (S.data[s.id] ? " - đang hiện dữ liệu cũ" : "") + "</div>"); });
    if (o.push.pm.conflicts.length) al.push('<div class="al warn">' + o.push.pm.conflicts.length + ' kết quả Push Sale lệch giữa các tracker <button class="btn sub sm" data-act="goto" data-tab="push">Xem</button></div>');
    var offSet = {}; (o.shifts || []).forEach(function (s) { if (s.kind !== "shift") offSet[U.normName(s.name)] = s.raw; });
    o.tasks.forEach(function (t) { if (t.assignee && offSet[U.normName(t.assignee)] && t.status !== "done") al.push('<div class="al warn">Giao <b>' + E(t.title) + "</b> cho " + E(t.assignee) + " nhưng người này nghỉ (" + E(offSet[U.normName(t.assignee)]) + ")</div>"); });
    if (o.kho && o.kho.forgot) { var nr = Object.keys(o.kho.forgotRows).filter(function (x) { var r = o.kho.forgotRows[x]; return !r.reason && !r.reasonCode; }).length; if (nr) al.push('<div class="al warn">' + nr + " SKU quên đặt chưa có lý do (OrderIQ)</div>"); }
    if (mo.hasSale && mo.mtdB && mo.mtdA / mo.mtdB < 0.9) al.push('<div class="al bad">Lũy kế tháng mới đạt ' + U.fmtPct(U.pct(mo.mtdA, mo.mtdB)) + " Budget - cần " + U.fmtM(mo.perDay) + "/ngày để về đích</div>");
    var miss = dataRows().filter(function (r) { return r.cls !== "ok"; }).length;
    if (miss) al.push('<div class="al info">' + miss + ' nguồn chưa cập nhật kỳ này - xem bảng "Tình trạng dữ liệu" bên dưới</div>');
    var staff = '<div class="empty">Chưa có lịch ca cho ngày này.</div>';
    if (o.shifts && o.shifts.length) {
      var g = { day: [], evening: [], night: [], off: [] };
      o.shifts.forEach(function (s) { (s.kind === "shift" ? g[s.bucket] || g.day : g.off).push(s); });
      staff = ["day", "evening", "night", "off"].filter(function (b) { return g[b].length; }).map(function (b) {
        return '<div class="shg"><div class="shh">' + (b === "off" ? "Nghỉ" : M.BUCKET[b]) + " <span>" + g[b].length + "</span></div>" + g[b].map(function (s) { var a = M.isActive(s, iso); return '<span class="pp' + (b === "off" ? " off" : "") + (a ? " act" : "") + '">' + (a ? "● " : "") + E(s.name) + ' <small>' + E(s.raw) + "</small></span>"; }).join("") + "</div>";
      }).join("");
    }
    out.push('<div class="g2c"><div class="card">' + sec("Việc cần làm hôm nay (" + ts.done + "/" + ts.total + ")", '<button class="btn sub sm" data-act="goto" data-tab="task">Mở Công việc →</button>') + (tl || '<div class="empty">Chưa có công việc cho ngày này.</div>') +
      (al.length ? '<h4 class="sub-h">Cảnh báo</h4>' + al.join("") : '<div class="al ok">Không có cảnh báo.</div>') + '</div><div class="card">' + sec("Nhân sự theo ca", '<button class="btn sub sm" data-act="goto" data-tab="cal">Lịch →</button>') + staff + src("LICH") + "</div></div>");

    // --- biểu đồ tháng + 7 ngày tới ---
    var nx = []; for (var i = 0; i < 7; i++) nx.push(U.addDays(iso, i));
    var rows = nx.map(function (x) { var dx = U.dateOf(x), hm = H.month(x), b = hm.bud[x], sh = M.shiftsOn(x), onN = sh ? sh.filter(function (s) { return s.kind === "shift"; }).length : null, nt = M.dayNote(x), we = [0, 6].indexOf(dx.getDay()) >= 0, mavg = hm.avg;
      return "<tr" + (x === iso ? ' class="cur"' : "") + "><td><b>" + U.dm(x) + "</b></td><td" + (we ? ' class="we"' : "") + ">" + U.WDF[dx.getDay()] + '</td><td class="n">' + (b != null ? U.fmtM(b) : "-") + '</td><td class="n">' + (b && mavg ? '<span class="' + (b >= mavg ? "up" : "dn") + '">' + (b >= mavg ? "+" : "") + U.fmt1((b / mavg - 1) * 100) + "%</span>" : "-") + '</td><td class="n">' + (onN != null ? onN : "-") + "</td><td>" + (nt ? E(nt) : "") + "</td></tr>"; }).join("");
    out.push('<div class="g2c wide"><div class="card">' + sec("Budget & doanh số tháng " + (+mo.ym.slice(5)) + "/" + mo.ym.slice(0, 4), '<span class="small muted">Budget tháng <b>' + money(mo.bMonth) + "</b>" + (mo.hasSale ? " · thực đạt " + money(mo.mtdA) : "") + "</span>") + chartSvg(mo, iso) + src(mo.hasSale ? "SALE" : "BUDGET") + "</div>" +
      '<div class="card">' + sec("7 ngày tới") + '<div class="tbl"><table class="t7"><thead><tr><th>Ngày</th><th>Thứ</th><th class="n">Target</th><th class="n">So TB</th><th class="n">Đi làm</th><th>Ghi chú</th></tr></thead><tbody>' + rows + "</tbody></table></div></div></div>");

    // --- checklist + ghi chú + tiện ích ---
    var cs = chkState(iso), tp = tpl(), nd = Object.keys(cs).filter(function (k) { return +k < tp.length; }).length;
    var chk = tp.map(function (t, i) { var v = !!cs[i]; return '<label class="ck' + (v ? " on" : "") + '"><input type="checkbox" data-h="chk" data-i="' + i + '"' + (v ? " checked" : "") + "> " + E(t) + "</label>"; }).join("");
    var editing = H.editTpl;
    out.push('<div class="g3c"><div class="card">' + sec("Checklist ca của tôi · " + nd + "/" + tp.length, '<button class="btn sub sm" data-h="tpl-edit">' + (editing ? "Đóng" : "Sửa") + "</button>") + pbar(U.pct(nd, tp.length)) +
      (editing ? '<p class="small muted">Mỗi dòng một việc. Danh sách dùng lại mỗi ngày, đánh dấu riêng theo ngày.</p><textarea id="tplTxt" rows="8">' + E(tp.join("\n")) + '</textarea><div class="row"><button class="btn sm" data-h="tpl-save">Lưu danh sách</button><button class="btn sub sm" data-h="tpl-reset">Mặc định</button></div>' : '<div class="cks">' + chk + "</div>") + "</div>" +
      '<div class="card">' + sec("Ghi chú nhanh", '<span class="small muted" id="noteSaved"></span>') + '<textarea id="qNote" data-h="note" rows="9" placeholder="Ghi nhanh việc cần nhớ, số điện thoại, khách hẹn... (tự lưu trên máy này)">' + E(lsGet(K.NOTE, "")) + '</textarea><div class="row"><button class="btn sub sm" data-h="note-copy">Sao chép</button><button class="btn sub sm" data-h="note-clear">Xóa</button></div></div>' +
      '<div class="card">' + sec("Tiện ích tính nhanh") + calcHtml(mo, bDay) + "</div></div>");

    // --- tình trạng dữ liệu ---
    var dr = dataRows();
    out.push('<div class="card">' + sec("Tình trạng dữ liệu", '<button class="btn sm" data-act="sync-all">⟳ Đồng bộ lại</button>') + '<div class="tbl"><table><thead><tr><th>Nguồn</th><th>Trạng thái</th><th>Cập nhật gần nhất</th><th>Cách cập nhật</th></tr></thead><tbody>' +
      dr.map(function (r) { return "<tr><td><b>" + E(r.name) + '</b></td><td><span class="dot ' + r.cls + '"></span>' + E(r.label) + '</td><td class="small">' + E(r.at) + '</td><td class="small">' + (r.tool ? linkBtn(r.tool, "Mở để cập nhật") + " " : "") + '<span class="muted">' + E(r.how) + "</span></td></tr>"; }).join("") + "</tbody></table></div>" +
      '<p class="small muted">Trợ lý tự đọc dữ liệu khi công cụ nguồn được mở trên cùng trình duyệt này (cùng địa chỉ github.io). Mở công cụ ↗, nạp file, rồi quay lại đây bấm Đồng bộ lại.</p></div>');

    // --- quy trình 5 bước (chi tiết, ẩn mặc định) ---
    var wf = ""; try { wf = S.workflow ? S.workflow.html(iso) : ""; } catch (e) { wf = '<div class="badbox">' + E(e.message) + "</div>"; }
    if (wf) out.push(det("wf", "Quy trình điều hành 5 bước & giao việc chi tiết (bấm để mở)", wf));
    return out.join("");
  };
  function groupName(id) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === id) return GROUPS[i][1]; return "Khác"; }

  function dataRows() {
    var ym = curYm(), rows = [];
    S.sources.forEach(function (s) {
      if (s.mode === "link" || s.id === "CLOUD") return;
      if (/^PS_/.test(s.id)) { var pc = (S.PUSH_SOURCES || []).filter(function (c) { return c.id === s.id; })[0]; if (pc && pc.month && pc.month < ym) return; }
      var st = S.sync[s.id] || {}, has = !!S.data[s.id], cls = st.status === "ok" && has ? "ok" : st.status === "fail" ? "bad" : has ? "warn" : "grey";
      var label = st.status === "ok" && has ? "Đã có dữ liệu" : st.status === "fail" ? "Lỗi đồng bộ" : has ? (S.STATUS[st.status] || "Chưa xác minh") : "Chưa có dữ liệu";
      var re = SRC_TOOL[s.id], tool = re ? toolFor(re) : s.id === "SALE" ? saleTool() : null;
      if (s.id === "BUDGET") { cls = has ? "ok" : "grey"; label = has ? "Bản trích sẵn" : label; }
      rows.push({ id: s.id, name: s.name, cls: cls, label: label, at: U.hm(st.sourceAt || st.lastOk), how: s.how || "", tool: s.id === "BUDGET" ? null : tool });
    });
    return rows;
  }

  function calcHtml(mo, bDay) {
    return '<div class="calc"><b class="small">1. Đổi giá có / chưa thuế</b><div class="row"><input type="text" inputmode="decimal" id="cVat" placeholder="Số tiền" data-h="calc"><select id="cVatR" data-h="calc"><option value="8">VAT 8%</option><option value="10">VAT 10%</option></select></div><div class="cres" id="rVat">Nhập số tiền để quy đổi</div></div>' +
      '<div class="calc"><b class="small">2. Còn thiếu & cần đạt mỗi ngày</b><div class="row"><input type="text" inputmode="decimal" id="cTg" placeholder="Chỉ tiêu" data-h="calc" value="' + (mo.bMonth ? U.fmtInt(mo.bMonth) : "") + '"><input type="text" inputmode="decimal" id="cAc" placeholder="Đã đạt" data-h="calc" value="' + (mo.hasSale ? U.fmtInt(mo.mtdA) : "") + '"><input type="text" inputmode="numeric" id="cDl" placeholder="Số ngày còn" data-h="calc" value="' + mo.daysLeft + '" style="max-width:90px"></div><div class="cres" id="rTg"></div><p class="small muted" style="margin:4px 0 0">Mặc định điền sẵn Budget tháng; dùng được cho Push Sale (số lượng) hoặc target cá nhân.</p></div>' +
      '<div class="calc"><b class="small">3. Chia target hôm nay theo giờ</b><div class="row"><input type="text" inputmode="numeric" id="cHr" placeholder="Số giờ mở cửa" data-h="calc" value="13" style="max-width:110px"><input type="text" inputmode="decimal" id="cTd" placeholder="Target ngày" data-h="calc" value="' + (bDay ? U.fmtInt(bDay) : "") + '"></div><div class="cres" id="rHr"></div></div>';
  }
  function num(id) { var el = document.getElementById(id); if (!el) return NaN; var v = String(el.value || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."); return parseFloat(v); }
  function runCalc() {
    var r, v = num("cVat"), rt = +(document.getElementById("cVatR") || {}).value || 8;
    if ((r = document.getElementById("rVat"))) r.innerHTML = isFinite(v) ? "Nếu là giá <b>chưa thuế</b> → có thuế: <b>" + U.fmtVnd(v * (1 + rt / 100)) + "</b><br>Nếu là giá <b>có thuế</b> → chưa thuế: <b>" + U.fmtVnd(v / (1 + rt / 100)) + "</b>" : "Nhập số tiền để quy đổi";
    var tg = num("cTg"), ac = num("cAc"), dl = num("cDl");
    if ((r = document.getElementById("rTg"))) r.innerHTML = isFinite(tg) && tg > 0 ? "Đạt <b>" + U.fmtPct(U.pct(isFinite(ac) ? ac : 0, tg)) + "</b> · còn thiếu <b>" + U.fmtInt(Math.max(0, tg - (ac || 0))) + "</b>" + (dl > 0 ? " · cần <b>" + U.fmtInt(Math.max(0, tg - (ac || 0)) / dl) + "/ngày</b>" : "") : "Nhập chỉ tiêu";
    var hr = num("cHr"), td = num("cTd");
    if ((r = document.getElementById("rHr"))) r.innerHTML = hr > 0 && td > 0 ? "Mỗi giờ cần <b>" + U.fmtVnd(td / hr) + "</b> · mỗi nửa ca (" + U.fmt1(hr / 2) + "h): <b>" + U.fmtVnd(td / 2) + "</b>" : "Nhập số giờ và target";
  }
  H.after = function () { runCalc(); };

  /* ---------------- TAB CÔNG CỤ ---------------- */
  H.tools = function () {
    var cat = H.catalog(), cur = cat.filter(function (t) { return !t.old; }), old = cat.filter(function (t) { return t.old; }), pk = pins(), q = H.toolQ || "";
    var out = ['<div class="sec-head"><span class="num">8</span><h2>Công cụ & link</h2></div><p class="lead">' + cur.length + " công cụ đang dùng · <b>" + old.length + " link tháng cũ đã ẩn</b> (bấm \"Tháng cũ\" ở từng nhóm để xem). Bấm ☆ để ghim lên Truy cập nhanh ở trang Hôm nay.</p>"];
    out.push('<div class="row tools-bar"><input type="search" id="toolQ" data-h="toolq" placeholder="Tìm công cụ (tên, mô tả)..." value="' + E(q) + '" autocomplete="off"><div class="gchips">' + GROUPS.map(function (g) { return '<a class="gchip" href="#g-' + g[0] + '">' + E(g[1]) + "</a>"; }).join("") + "</div></div>");
    var pinned = cat.filter(function (t) { return pk.indexOf(t.key) >= 0; });
    out.push('<div class="tgroup" id="g-pin"><h3>☆ Đã ghim (' + pinned.length + ")</h3>" + (pinned.length ? '<div class="tgrid">' + pinned.map(card).join("") + "</div>" : '<div class="empty">Chưa ghim công cụ nào.</div>') + "</div>");
    GROUPS.forEach(function (g) {
      var c = cur.filter(function (t) { return t.groupId === g[0]; }).sort(function (a, b) { return (b.month || "").localeCompare(a.month || "") || 0; });
      var od = old.filter(function (t) { return t.groupId === g[0]; }).sort(function (a, b) { return b.month.localeCompare(a.month); });
      if (!c.length && !od.length) return;
      var body = '<div class="tgroup" id="g-' + g[0] + '"><h3>' + E(g[1]) + ' <span class="cnt">' + c.length + "</span></h3>" + (c.length ? '<div class="tgrid">' + c.map(card).join("") + "</div>" : '<div class="empty small">Chưa có công cụ tháng này.</div>');
      if (od.length) {
        var byM = {}; od.forEach(function (t) { (byM[t.month] = byM[t.month] || []).push(t); });
        body += det("old-" + g[0], "Tháng cũ (" + od.length + " link) - bấm để xem", '<div class="tbl"><table><thead><tr><th>Tháng</th><th>Công cụ</th><th>Cập nhật</th><th></th></tr></thead><tbody>' +
          Object.keys(byM).sort().reverse().map(function (m) { return byM[m].map(function (t, i) { return '<tr class="trow-old" data-s="' + E(U.normName(t.name + " " + t.desc + " tháng " + (+m.slice(5)))) + '"' + (i === 0 ? ' style="border-top:2px solid #c9d3e3"' : "") + '><td><span class="tag' + (i === 0 ? "" : " grey") + '">T' + (+m.slice(5)) + "/" + m.slice(0, 4) + "</span></td><td>" + E(t.name) + '<br><span class="small muted">' + E(t.desc || "") + '</span></td><td class="small">' + E(t.updated || "-") + "</td><td>" + linkBtn(t, "Mở", "sub") + "</td></tr>"; }).join(""); }).join("") + "</tbody></table></div>");
      }
      out.push(body + "</div>");
    });
    out.push('<p class="small muted">Danh mục lấy từ Trang chủ link tổng hợp (trích ' + E(U.hm((window.S1016_TOOLS || {}).extractedAt)) + '). Link trùng giữa các nhóm đã được gộp. Tháng được nhận từ tên/đường dẫn (vd "T10", "2026-10").</p>');
    return out.join("");
  };
  function card(t) {
    var p = isPinned(t.key), cm = t.month === curYm();
    return '<div class="tcard" data-s="' + E(U.normName(t.name + " " + (t.desc || "") + " " + groupName(t.groupId))) + '"><div class="tc-top"><b>' + E(t.name) + '</b><button class="pin' + (p ? " on" : "") + '" data-h="pin" data-k="' + E(t.key) + '" title="' + (p ? "Bỏ ghim" : "Ghim lên Truy cập nhanh") + '">' + (p ? "★" : "☆") + '</button></div><div class="small muted">' + E(t.desc || "") + '</div><div class="tc-bot"><span class="small muted">' + (cm ? '<span class="tag ok">Tháng ' + (+t.month.slice(5)) + "</span> " : "") + "Cập nhật " + E(t.updated || "-") + "</span>" + linkBtn(t) + "</div></div>";
  }
  function filterTools() {
    var q = U.normName(H.toolQ || ""), sec = document.getElementById("m-tools"); if (!sec) return;
    sec.querySelectorAll(".tcard,.trow-old").forEach(function (el) { el.style.display = !q || (el.dataset.s || "").indexOf(q) >= 0 ? "" : "none"; });
    if (q) sec.querySelectorAll("details.hd").forEach(function (d) { d.open = true; });
  }
  H.afterTools = function () { filterTools(); };

  /* ---------------- SỰ KIỆN ---------------- */
  document.addEventListener("toggle", function (e) { var d = e.target; if (d && d.matches && d.matches("details.hd[data-k]")) H.open[d.dataset.k] = d.open; }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-h]"); if (!b || b.tagName === "INPUT" || b.tagName === "TEXTAREA" || b.tagName === "SELECT") return;
    var a = b.dataset.h, rr = function () { if (S.ui && S.ui.render) S.ui.render(); };
    if (a === "pin") { e.preventDefault(); togglePin(b.dataset.k); rr(); }
    else if (a === "tpl-edit") { H.editTpl = !H.editTpl; rr(); }
    else if (a === "tpl-save") { var lines = (document.getElementById("tplTxt").value || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean); lsSet(K.TPL, lines); H.editTpl = false; rr(); }
    else if (a === "tpl-reset") { if (confirm("Khôi phục danh sách checklist mặc định?")) { try { localStorage.removeItem(K.TPL); } catch (x) {} H.editTpl = false; rr(); } }
    else if (a === "note-copy") { var t = document.getElementById("qNote"); if (t) { t.select(); try { navigator.clipboard.writeText(t.value); } catch (x) { document.execCommand("copy"); } if (S.ui.toast) S.ui.toast("Đã sao chép ghi chú", "ok"); } }
    else if (a === "note-clear") { if (confirm("Xóa ghi chú nhanh?")) { lsSet(K.NOTE, ""); rr(); } }
  });
  document.addEventListener("change", function (e) {
    var el = e.target; if (!el.dataset || !el.dataset.h) return;
    if (el.dataset.h === "chk") { setChk(ui().date || U.todayIso(), el.dataset.i, el.checked); if (S.ui && S.ui.render) S.ui.render(); }
    if (el.dataset.h === "calc") runCalc();
  });
  var nt = null;
  document.addEventListener("input", function (e) {
    var el = e.target; if (!el.dataset || !el.dataset.h) return;
    if (el.dataset.h === "note") { clearTimeout(nt); nt = setTimeout(function () { lsSet(K.NOTE, el.value); var s = document.getElementById("noteSaved"); if (s) s.textContent = "Đã lưu " + U.pad(U.now().getHours()) + ":" + U.pad(U.now().getMinutes()); }, 400); }
    else if (el.dataset.h === "calc") runCalc();
    else if (el.dataset.h === "toolq") { H.toolQ = el.value; filterTools(); }
  });
})();
