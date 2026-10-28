/* Điều phối bổ sung; không đổi khóa/schema cũ, không tự giao việc/đặt PO. */
(function () {
  'use strict';
  var S = window.S1016, M = S.model, U = S.util, E = U.esc;
  var W = S.workflow = {}, KEY = 'S1016_A_WORKFLOW_V1';
  var defaults = { maxAgeHours: 24, basket: 330000, endMinutes: 60 };
  function store() { return S.readJ(KEY, { days: {}, config: defaults }); }
  W.config = function () { return Object.assign({}, defaults, store().config); };
  function day(iso) { return store().days[iso] || { steps: {}, alerts: {}, shift: null }; }
  function write(iso, change) {
    if (M.isDemo()) return false;
    var all = store(), d = all.days[iso] || { steps: {}, alerts: {}, shift: null };
    change(d); all.days[iso] = d;
    if (!S.writeJ(KEY, all)) return false;
    S.userAction('Điều hành 5 bước', iso, 'cập nhật', '', d); return true;
  }
  W.source = function (id, iso, covered) {
    var st = S.sync[id] || {}, cache = S.cache[id] || {}, src = S.sourceById(id);
    // Không dùng lastOk: đọc thành công không chứng minh nguồn vừa được cập nhật.
    var sale = id === 'SALE' && M.sale(iso.slice(0, 7));
    var at = sale ? sale.at : st.sourceAt || cache.sourceAt, age = (U.now().getTime() - Date.parse(at)) / 3600000;
    var label = M.isDemo() ? 'Demo' : !M.ds(id) || !covered ? 'Thiếu dữ liệu kỳ này' : st.status !== 'ok' ? 'Lỗi hoặc chưa xác minh' : !at || !isFinite(age) || age < -0.1 ? 'Chưa xác minh thời điểm' : age > W.config().maxAgeHours || S.isStale(id) ? 'Cần cập nhật' : 'Đã xác minh';
    return { id: id, name: src ? src.name : id, at: at, period: iso, label: label, ready: label === 'Đã xác minh', how: src && src.how || 'Mở Nguồn dữ liệu để nhập gói JSON từ công cụ nguồn.' };
  };
  function vnHour() {
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(U.now()).split(':');
    return +p[0] + +p[1] / 60;
  }
  W.phase = function (iso) {
    var sh = day(iso).shift;
    if (!sh) return { label: 'Chọn ca thực tế để điều hướng theo thời gian', step: 0 };
    var start = Date.parse(iso + 'T' + sh.start + ':00+07:00') / 3600000;
    var end = Date.parse(iso + 'T' + sh.end + ':00+07:00') / 3600000, h = U.now().getTime() / 3600000;
    if (end <= start) end += 24;
    if (h >= end) return { label: 'Ca đã kết thúc · Tổng kết và bàn giao', step: 4 };
    if (h < start) return { label: 'Trước ca · ' + sh.start + ' - ' + sh.end, step: 0 };
    if (h >= end - W.config().endMinutes / 60) return { label: 'Cuối ca · Tổng kết và bàn giao', step: 4 };
    if (h < start + 1) return { label: 'Đầu ca · Nhân sự và trọng tâm doanh số', step: 0 };
    return { label: 'Trong ca · Push Sale, công việc và kho', step: 2 };
  };
  W.inspect = function (iso) {
    var o = M.overview(iso), d = day(iso), sources = [], groups = [];
    groups[0] = [W.source('LICH', iso, !!(o.shifts && o.shifts.length)), W.source('TA', iso, !!(M.ds('TA') && M.ds('TA').occ[iso]))];
    groups[1] = [W.source('SALE', iso, !!o.saleDay)];
    var ids = S.PUSH_SOURCES.filter(function (x) { return x.month === iso.slice(0, 7) && M.ds(x.id); });
    groups[2] = ids.length ? ids.map(function (x) { return W.source(x.id, iso, Object.keys(M.ds(x.id).recs).some(function (k) { return M.ds(x.id).recs[k].date === iso; })); }) : [{ id: 'PUSH', name: 'Push Sale ' + iso.slice(0, 7), label: M.isDemo() ? 'Demo' : 'Thiếu dữ liệu kỳ này', ready: false, how: 'Mở tracker của đúng tháng, nạp POS rồi nhập gói JSON nếu khác nguồn lưu.' }];
    groups[3] = [W.source('KHO', iso, !!(o.kho && String(o.kho.refDate || '').replace(/-/g, '') === iso.replace(/-/g, '')))];
    groups.forEach(function (g) { sources = sources.concat(g); });
    var ready = groups.map(function (g) { return g.length > 0 && g.every(function (s) { return s.ready; }); });
    var alerts = [];
    function add(id, p, reason, step, task) { alerts.push({ id: iso + ':' + id, priority: p, reason: reason, step: step, task: task, source: task ? task.origin : groups[step].map(function (s) { return s.name; }).join(', '), at: task && (task.updatedAt || task.createdAt) || groups[step].map(function (s) { return s.at; }).filter(Boolean).sort().pop(), state: d.alerts[iso + ':' + id] || {} }); }
    if (!M.isDemo()) {
      o.tasks.filter(function (t) { return ['done', 'moved', 'cancelled'].indexOf(t.status) < 0; }).forEach(function (t) {
        if (Object.keys(d.alerts).some(function (key) { return d.alerts[key].taskId === t.id; })) return;
        if (t.priority === 'Khẩn' || t.priority === 'P1') add('task:' + t.id, 'P1', t.title, 0, t);
        else if (t.overdue || t.priority === 'Cao' || t.status === 'blocked') add('task:' + t.id, 'P2', t.title, 0, t);
      });
      sources.forEach(function (s) { if (!s.ready) add('data:' + s.id, 'P3', s.name + ': ' + s.label, groups.findIndex(function (g) { return g.indexOf(s) >= 0; })); });
      if (ready[1] && Number.isFinite(o.saleDay.revenue) && o.saleDay.bills > 0 && o.saleDay.revenue / o.saleDay.bills < W.config().basket) add('basket', 'P2', 'Basket Size ' + U.fmtVnd(o.saleDay.revenue / o.saleDay.bills) + ' dưới mục tiêu ' + U.fmtVnd(W.config().basket), 1);
      if (ready[2]) Object.keys(o.push.day.team).forEach(function (pid) { var p = o.push.day.team[pid]; if (p.dayTarget > 0 && p.actual < p.dayTarget) add('push:' + pid, 'P2', o.push.pm.products[pid].label + ': còn thiếu ' + U.fmt1(p.dayTarget - p.actual) + ' so với chỉ tiêu cả ngày (kiểm tra tiến độ tại tracker)', 2); });
      if (ready[3] && o.kho.counts.oos > 0) add('stock', 'P2', o.kho.counts.oos + ' mã hết hàng - kiểm tra tồn và PO tại OrderIQ', 3);
    }
    alerts.forEach(function (a) { var t = a.state.taskId && o.tasks.filter(function (v) { return v.id === a.state.taskId; })[0]; if (t) { a.task = t; if (t.status === 'done') a.state = Object.assign({}, a.state, { status: 'done', reason: t.result }); } });
    alerts.sort(function (a, b) { return a.priority.localeCompare(b.priority) || String(a.task && a.task.due || '23:59').localeCompare(String(b.task && b.task.due || '23:59')) || a.id.localeCompare(b.id); });
    var journal = S.state.journals['J:' + iso];
    var steps = ['Đầu ca · Nhân sự và công việc', 'Doanh số · Basket Size và CAT Layer1', 'Trong ca · Push Sale', 'Kho và đặt hàng · Tồn, PO', 'Cuối ca · Nhật ký và bàn giao'].map(function (title, i) {
      var fingerprint = U.hash(U.stable(i === 4 ? journal : { sources: groups[i], tasks: i === 0 ? o.tasks : null }));
      var done = !M.isDemo() && (i === 4 ? journal && journal.status === 'confirmed' : ready[i] && d.steps[i] === fingerprint);
      var issue = alerts.some(function (a) { return a.step === i && a.priority !== 'P3' && a.state.status !== 'done' && a.state.status !== 'deferred'; });
      return { title: title, fingerprint: fingerprint, done: !!done, state: done ? 'Hoàn thành' : i === 4 ? journal ? 'Chờ xác nhận' : 'Chưa bắt đầu' : !ready[i] ? 'Chờ dữ liệu' : issue ? 'Cần xử lý' : d.steps[i] ? 'Đang thực hiện' : 'Chưa bắt đầu' };
    });
    return { overview: o, sources: sources, groups: groups, ready: ready, alerts: alerts, steps: steps, phase: W.phase(iso), day: d };
  };
  var tabs = ['cal', 'sale', 'push', 'kho', 'journal'];
  function go(i, source) { S.ui.tab = source ? 'src' : tabs[i]; if (source) { var x = W.inspect(S.ui.date); S.ui.srcOpen = {}; (x.groups[i] || []).forEach(function (s) { S.ui.srcOpen[s.id] = true; }); } if (i === 0) S.ui.calView = 'day'; if (i === 1) S.ui.saleMonth = S.ui.date.slice(0, 7); if (i === 2) S.ui.pushMonth = S.ui.date.slice(0, 7); S.ui.render(); window.scrollTo(0, 0); }
  W.html = function (iso) {
    var x = W.inspect(iso), blocked = M.isDemo() ? ' disabled' : '', cfg = W.config();
    function button(label, action, extra) { return '<button class="btn sub sm" data-wf="' + action + '" ' + (extra || '') + '>' + label + '</button>'; }
    var h = '<div class="wf"><div class="sec-head"><span class="num">1</span><h2>Trung tâm điều hành hôm nay</h2></div><p class="lead">' + E(x.phase.label) + ' · ' + x.steps.filter(function (s) { return s.done; }).length + '/5 bước đã xác nhận</p>';
    h += '<details class="card"><summary>Ca thực tế và ngưỡng kiểm tra</summary><p>Chọn ca của bạn từ lịch hoặc nhập giờ thực tế. Ngưỡng dữ liệu mặc định 24 giờ; cuối ca trước giờ kết thúc 60 phút.</p><div class="row"><label>Ca từ lịch<select id="wfShift"><option value="">Chọn ca</option>' + (x.overview.shifts || []).filter(function (s) { return s.kind === 'shift' && Number.isFinite(s.start) && Number.isFinite(s.end); }).map(function (s) { function hh(v) { return U.pad(Math.floor(v) % 24) + ':' + U.pad(Math.round(v % 1 * 60)); } return '<option value="' + hh(s.start) + ',' + hh(s.end) + '">' + E(s.name + ' · ' + s.raw) + '</option>'; }).join('') + '</select></label><label>Bắt đầu<input id="wfStart" type="time" value="' + E(x.day.shift && x.day.shift.start || '') + '"></label><label>Kết thúc<input id="wfEnd" type="time" value="' + E(x.day.shift && x.day.shift.end || '') + '"></label><label>Dữ liệu mới trong (giờ)<input id="wfAge" type="number" min="1" max="720" value="' + cfg.maxAgeHours + '"></label><label>Basket Size mục tiêu (đ)<input id="wfBasket" type="number" min="1" value="' + cfg.basket + '"></label><label>Cuối ca trước (phút)<input id="wfEndMin" type="number" min="1" max="240" value="' + cfg.endMinutes + '"></label>' + button('Bắt đầu / lưu ca', 'start', blocked) + '</div></details>';
    var urgent = x.alerts.filter(function (a) { return a.priority === 'P1' && a.state.status !== 'done' && a.state.status !== 'deferred'; })[0];
    h += '<div class="action">Bước tiếp theo: ' + E(urgent ? urgent.reason : x.steps[x.phase.step].title) + ' ' + button('Mở việc ưu tiên', urgent ? 'tasks' : 'open', 'data-step="' + x.phase.step + '"') + '</div>';
    h += '<h3>Việc cần xử lý ngay</h3><p class="small">P1: việc được đánh dấu Khẩn · P2: công việc quan trọng và rủi ro kinh doanh có nguồn hợp lệ · P3: cập nhật dữ liệu. Mở Công việc để ghi nhận sự cố mới.</p>';
    var active = x.alerts.filter(function (a) { return a.state.status !== 'done' && a.state.status !== 'deferred'; });
    h += active.slice(0, 5).map(function (a) { var k = U.hash(a.id); return '<article class="card wf-alert"><span class="tag ' + (a.priority === 'P1' ? 'bad' : 'warn') + '">' + a.priority + '</span> <b>' + E(a.reason) + '</b><p class="small">Nguồn: ' + E(a.source) + ' · ' + E(a.at ? U.hm(a.at) : 'Chưa xác minh thời điểm') + '<br>Phụ trách: ' + E(a.task && a.task.assignee || a.state.owner || 'Chưa phân công') + ' · Hạn: ' + E(a.task && a.task.due || a.state.due || 'Chưa đặt') + ' · ' + E(a.state.status === 'assigned' ? 'Đã xác nhận giao việc' : 'Chờ xử lý') + '</p><div class="row">' + button('Xem / cập nhật đúng bước', 'open', 'data-step="' + a.step + '"') + '<label>Phụ trách<input id="wo' + k + '" value="' + E(a.task && a.task.assignee || a.state.owner || '') + '"></label><label>Hạn<input id="wd' + k + '" type="time" value="' + E(a.task && a.task.due || a.state.due || '') + '"></label><label>Kết quả / lý do<input id="wr' + k + '"></label>' + ['assign', 'done', 'defer'].map(function (act, i) { return button(['Xác nhận giao việc', 'Hoàn thành', 'Hoãn có lý do'][i], act, 'data-id="' + E(a.id) + '"' + blocked); }).join('') + '</div></article>'; }).join('') || '';
    if (!active.length) h += '<p>' + (M.isDemo() ? 'Demo đang bật: chuyển sang dữ liệu thật tại Nguồn dữ liệu để điều hành.' : 'Không có cảnh báo đang mở. Kiểm tra đầy đủ 5 bước trước khi bàn giao.') + '</p>';
    if (active.length > 5) h += '<p>Còn ' + (active.length - 5) + ' cảnh báo; xem từng bước và Công việc.</p>';
    h += '<h3>Quy trình 5 bước</h3><div class="wf-steps">' + x.steps.map(function (s, i) { return '<article class="card' + (x.phase.step === i ? ' wf-current' : '') + '"><h3><span class="num">' + (i + 1) + '</span> ' + E(s.title) + '</h3><span class="tag ' + (s.done ? 'ok' : 'warn') + '">' + E(s.state) + '</span>' + (i < 4 ? '<p class="small">' + x.groups[i].map(function (v) { return E(v.name + ': ' + v.label); }).join('<br>') + '</p>' : '<p>Bản nháp cần được kiểm tra và xác nhận tại Nhật ký.</p>') + '<div class="row">' + button(i === 4 ? 'Tạo / xem nhật ký nháp' : 'Mở bước này', 'open', 'data-step="' + i + '"') + (i === 0 ? button('Phân công công việc', 'tasks') : '') + (i < 4 ? button('Cập nhật dữ liệu', 'source', 'data-step="' + i + '"') + button('Xác nhận đã kiểm tra', 'complete', 'data-step="' + i + '"' + (blocked || !x.ready[i] ? ' disabled' : '')) : '') + '</div></article>'; }).join('') + '</div>';
    h += '<h3>Dữ liệu cần cập nhật</h3><div class="tbl"><table><thead><tr><th>Nguồn / kỳ</th><th>Độ mới / trạng thái</th><th>Cách cập nhật</th></tr></thead><tbody>' + x.sources.map(function (s) { return '<tr><td>' + E(s.name) + '<br>' + iso + '</td><td>' + E(s.label) + '<br>' + E(s.at ? U.hm(s.at) : 'Không có thời điểm nguồn') + '</td><td>' + E(s.how) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small">Mở công cụ và nạp dữ liệu tại nguồn. Gói JSON được nhập qua Nguồn dữ liệu nếu không dùng chung nơi lưu. Không tự coi mở link là đồng bộ.</p>';
    h += '<h3>Kết quả trong ngày</h3><div class="card">Công việc: ' + (M.isDemo() ? 'Demo - không dùng điều hành' : x.overview.taskStats.done + '/' + x.overview.taskStats.total + ' hoàn thành') + '<br>Doanh số: ' + (x.ready[1] ? U.fmtVnd(x.overview.saleDay.revenue) + ' · Basket Size ' + (x.overview.saleDay.bills > 0 ? U.fmtVnd(x.overview.saleDay.revenue / x.overview.saleDay.bills) : 'chưa đủ số bill') : 'Chờ dữ liệu hợp lệ') + '<br>Push Sale: ' + (x.ready[2] ? 'Đã có dữ liệu đúng ngày - xem bước 3' : 'Chờ dữ liệu hợp lệ') + '<br>Kho: ' + (x.ready[3] ? x.overview.kho.counts.oos + ' mã hết hàng' : 'Chờ dữ liệu hợp lệ') + '</div>';
    var handled = x.alerts.filter(function (a) { return a.state.status === 'done' || a.state.status === 'deferred'; });
    if (handled.length) h += '<details><summary>Đã xử lý / hoãn (' + handled.length + ')</summary>' + handled.map(function (a) { return '<p>' + E(a.priority + ' · ' + a.reason + ' · ' + a.state.status + ' · ' + (a.state.reason || '')) + ' ' + button('Mở lại', 'reopen', 'data-id="' + E(a.id) + '"' + blocked) + '</p>'; }).join('') + '</details>';
    return h + '</div>';
  };
  document.addEventListener('change', function (e) { if (e.target.id === 'wfShift' && e.target.value) { var p = e.target.value.split(','); document.getElementById('wfStart').value = p[0]; document.getElementById('wfEnd').value = p[1]; } });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wf]'); if (!b) return;
    var iso = S.ui.date, action = b.dataset.wf, i = +b.dataset.step, x = W.inspect(iso), val = function (id) { return document.getElementById(id).value.trim(); };
    if (action === 'open' || action === 'source') return go(i, action === 'source');
    if (action === 'tasks') { S.ui.tab = 'task'; S.ui.render(); return; }
    if (M.isDemo()) return S.ui.toast('Chế độ Demo - không lưu vào dữ liệu thật.', 'bad');
    if (action === 'start') {
      var start = val('wfStart'), end = val('wfEnd'), age = +val('wfAge'), basket = +val('wfBasket'), endMin = +val('wfEndMin');
      if (!/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end) || start === end || !(age >= 1 && age <= 720) || !(basket > 0) || !(endMin >= 1 && endMin <= 240)) return S.ui.toast('Kiểm tra giờ ca và ngưỡng hợp lệ.', 'bad');
      var all = store(); all.config = { maxAgeHours: age, basket: basket, endMinutes: endMin }; if (!S.writeJ(KEY, all)) return;
      write(iso, function (d) { d.shift = { start: start, end: end }; });
    } else if (action === 'complete') {
      if (i >= 4 || !x.ready[i]) return S.ui.toast('Cập nhật dữ liệu hợp lệ trước khi xác nhận.', 'bad');
      write(iso, function (d) { d.steps[i] = x.steps[i].fingerprint; });
    } else {
      var a = x.alerts.filter(function (v) { return v.id === b.dataset.id; })[0]; if (!a) return;
      var linked = a.state.taskId && M.tasksOn(iso).filter(function (t) { return t.id === a.state.taskId; })[0];
      if (linked) a.task = linked;
      var k = U.hash(a.id), owner = action === 'reopen' ? '' : val('wo' + k), due = action === 'reopen' ? '' : val('wd' + k), reason = action === 'reopen' ? '' : val('wr' + k);
      if (action === 'assign' && (!owner || !due)) return S.ui.toast('Nhập người phụ trách và hạn trước khi xác nhận giao việc.', 'bad');
      if ((action === 'done' || action === 'defer') && !reason) return S.ui.toast('Nhập kết quả hoặc lý do hoãn.', 'bad');
      if (action === 'done' && a.priority === 'P3') return S.ui.toast('Cập nhật dữ liệu tại nguồn; cảnh báo tự hết sau khi kiểm tra hợp lệ.', 'bad');
      var taskId = a.state.taskId || null;
      if (!a.task && action === 'assign') {
        var created = M.addAdhoc({ date: iso, title: a.reason, assignee: owner, due: due, priority: a.priority === 'P1' ? 'Khẩn' : a.priority === 'P2' ? 'Cao' : 'Bình thường', desc: 'Cảnh báo ' + a.id + ' · Nguồn: ' + a.source });
        if (!created.ok) return S.ui.toast(created.error, 'bad');
        taskId = created.id;
        a.task = M.tasksOn(iso).filter(function (t) { return t.id === taskId; })[0];
      }
      if (a.task && action !== 'reopen') { var patch = action === 'assign' ? { assignee: owner, due: due, status: 'doing' } : action === 'done' ? { status: 'done', result: reason } : { status: 'blocked', reason: reason }; var r = M.updateTask(a.task, patch); if (!r.ok) return S.ui.toast(r.error, 'bad'); }
      write(iso, function (d) { d.alerts[a.id] = { status: { assign: 'assigned', done: 'done', defer: 'deferred', reopen: 'todo' }[action], owner: owner, due: due, reason: reason, taskId: taskId, source: a.source, detectedAt: a.at || null, at: U.nowIso() }; });
    }
    S.ui.render();
  });
  // Bản nháp giữ nguyên cơ chế xác nhận cũ, bổ sung kết quả điều phối thực tế.
  var oldDraft = M.journalDraft;
  M.journalDraft = function (iso) {
    var j = oldDraft(iso); if (M.isDemo()) return j;
    var x = W.inspect(iso), ds = day(iso);
    j.sections.issues += '\n' + Object.keys(ds.alerts).map(function (id) { var a = ds.alerts[id]; return id + ': ' + a.status + ' · ' + (a.owner || 'chưa phân công') + ' · ' + (a.reason || ''); }).join('\n');
    x.groups.forEach(function (g, i) { if (x.ready[i]) return; var key = ['staff', 'sale', 'push', 'kho'][i]; j.sections[key] = 'Chờ dữ liệu hợp lệ: ' + g.map(function (s) { return s.name + ' - ' + s.label; }).join('; '); if (i === 1) { j.metrics.saleDay = null; j.metrics.saleAtt = null; } if (i === 2) j.metrics.push = {}; if (i === 3) j.metrics.kho = null; });
    j.sources = {}; x.sources.forEach(function (s) { j.sources[s.id] = { label: s.name, at: s.at, status: s.label, verified: s.ready }; });
    return j;
  };
  // Bản sao lưu cũ vẫn đọc được; bổ sung phần riêng vào gói sao lưu mới.
  var backup = S.backup, restore = S.restoreBackup;
  S.backup = function () { var pack = backup(); pack.workflowV1 = store(); return pack; };
  S.restoreBackup = function (pack, name) {
    if (pack && pack.workflowV1 && (!pack.workflowV1.days || !pack.workflowV1.config)) return { ok: false, error: 'Phần điều hành 5 bước trong bản sao lưu không hợp lệ.' };
    var r = restore(pack, name);
    if (r.ok && pack.workflowV1 && !S.writeJ(KEY, pack.workflowV1)) return { ok: false, error: 'Không lưu được dữ liệu điều hành 5 bước.' };
    return r;
  };
  setInterval(function () { if (S.ui && S.ui.tab === 'ov' && !document.hidden && !document.activeElement.closest('.wf') && !document.querySelector('.wf details[open]')) S.ui.render(); }, 60000);
})();
