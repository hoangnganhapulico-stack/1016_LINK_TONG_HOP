/* =====================================================================
   S1016 CORE - kho dữ liệu, mã định danh, lịch sử thay đổi, bộ máy đồng bộ
   Không phụ thuộc giao diện. Giao diện (app.js) chỉ gọi API ở đây.
   ===================================================================== */
(function () {
  "use strict";
  var S = window.S1016 = window.S1016 || {};

  /* ---------------- TIỆN ÍCH ---------------- */
  var U = S.util = {};
  U.pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  U.isoOf = function (d) { return d.getFullYear() + "-" + U.pad(d.getMonth() + 1) + "-" + U.pad(d.getDate()); };
  U.todayIso = function () {
    if (S.__fakeNow) return U.isoOf(S.__fakeNow());
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return U.isoOf(new Date()); }
  };
  U.now = function () { return S.__fakeNow ? S.__fakeNow() : new Date(); };
  U.nowIso = function () { return U.now().toISOString(); };
  U.dateOf = function (iso) { var p = iso.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  U.addDays = function (iso, n) { var d = U.dateOf(iso); d.setDate(d.getDate() + n); return U.isoOf(d); };
  U.dmy = function (iso) { if (!iso) return "-"; var p = iso.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  U.dm = function (iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; };
  U.hm = function (isoTs) { if (!isoTs) return "-"; var d = new Date(isoTs); if (isNaN(d)) return "-"; return U.pad(d.getHours()) + ":" + U.pad(d.getMinutes()) + " " + U.pad(d.getDate()) + "/" + U.pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  U.WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  U.WDF = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  U.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  U.normName = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim(); };
  U.slug = function (s) { return U.normName(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, ""); };
  U.hash = function (str) { var h = 2166136261 >>> 0; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); };
  U.uid = function (p) { return (p || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); };
  U.fmtInt = function (n) { return (n == null || !isFinite(n)) ? "-" : new Intl.NumberFormat("vi-VN").format(Math.round(n)); };
  U.fmt1 = function (n) { return (n == null || !isFinite(n)) ? "-" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n); };
  U.fmtVnd = function (n) { return (n == null || !isFinite(n)) ? "-" : new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ"; };
  U.fmtM = function (n) { return (n == null || !isFinite(n)) ? "-" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n / 1e6) + " tr"; };
  U.pct = function (a, b) { return (b > 0 && a != null) ? a / b * 100 : null; };
  U.fmtPct = function (p) { return (p == null || !isFinite(p)) ? "-" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(p) + "%"; };
  U.stable = function (o) { // JSON ổn định để so sánh
    if (o === null || typeof o !== "object") return JSON.stringify(o);
    if (Array.isArray(o)) return "[" + o.map(U.stable).join(",") + "]";
    return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + U.stable(o[k]); }).join(",") + "}";
  };
  U.clone = function (o) { return o == null ? o : JSON.parse(JSON.stringify(o)); };

  /* ---------------- LƯU TRỮ CỤC BỘ ---------------- */
  var LS = null; try { LS = window.localStorage; LS.getItem("x"); } catch (e) { LS = null; }
  S.lsOk = !!LS;
  var K = S.KEYS = { STATE: "S1016_A_STATE", CACHE: "S1016_A_CACHE", LOG: "S1016_A_LOG", SYNC: "S1016_A_SYNC", DEMO: "S1016_A_DEMO", IMPORT: "S1016_A_IMPORT" };
  var mem = {};
  S.raw = {
    get: function (k) { try { return LS ? LS.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return null; } },
    set: function (k, v) { if (LS) { LS.setItem(k, v); } else mem[k] = v; },
    del: function (k) { try { if (LS) LS.removeItem(k); else delete mem[k]; } catch (e) {} },
    keys: function () { var a = []; if (LS) { for (var i = 0; i < LS.length; i++) a.push(LS.key(i)); } else a = Object.keys(mem); return a; }
  };
  S.readJ = function (k, d) { var v = S.raw.get(k); if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } };
  S.writeJ = function (k, o) {
    try { S.raw.set(k, JSON.stringify(o)); return true; }
    catch (e) { S.emit("error", { where: "lưu " + k, message: (e && e.message) || String(e) }); return false; }
  };

  /* ---------------- SỰ KIỆN ---------------- */
  var handlers = {};
  S.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  S.emit = function (ev, data) { (handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ---------------- TRẠNG THÁI CỦA TRỢ LÝ (dữ liệu do Trợ lý sở hữu) ---------------- */
  function emptyState() {
    return { v: 1, taskOverrides: {}, adhocTasks: {}, journals: {}, followUps: {},
      settings: { user: "", writeBackLich: false, demoMode: false, cloud: { url: "", key: "", storeKey: "", enabled: false } },
      importLog: [] };
  }
  S.state = S.readJ(K.STATE, null) || emptyState();
  (function norm() { var e = emptyState(); Object.keys(e).forEach(function (k) { if (S.state[k] === undefined) S.state[k] = e[k]; });
    Object.keys(e.settings).forEach(function (k) { if (S.state.settings[k] === undefined) S.state.settings[k] = e.settings[k]; }); })();
  S.saveState = function (why) { S.state.updatedAt = U.nowIso(); var ok = S.writeJ(K.STATE, S.state); S.emit("state", why); if (S.cloud && S.cloud.markDirty) S.cloud.markDirty("STATE"); return ok; };

  /* ---------------- LỊCH SỬ THAY ĐỔI ---------------- */
  S.log = S.readJ(K.LOG, []) || [];
  S.addLog = function (entries) {
    if (!entries || !entries.length) return;
    entries.forEach(function (e) { e.at = e.at || U.nowIso(); S.log.push(e); });
    if (S.log.length > 4000) S.log = S.log.slice(S.log.length - 4000);
    S.writeJ(K.LOG, S.log);
  };
  S.userAction = function (entity, id, field, oldV, newV, note) {
    S.addLog([{ origin: "Người dùng", source: "TRO_LY", by: S.state.settings.user || "", entity: entity, id: id, field: field, old: oldV, new: newV, note: note || "" }]);
  };

  /* ---------------- ĐỌC KHÓA NGUỒN (cục bộ cùng origin hoặc gói nhập) ---------------- */
  S.imports = S.readJ(K.IMPORT, { items: {}, at: {} }) || { items: {}, at: {} };
  function touchAt(key, touchMap) { var t = touchMap && touchMap[key]; return t && t.at || null; }
  /* Trả về {value(string|null), origin:'local'|'import'|null, at(iso|null)} */
  S.getSourceKey = function (key) {
    var local = S.raw.get(key);
    var localTouch = touchAt(key, S.readJ("S1016_TOUCH", {}));
    var imp = S.imports.items[key];
    var impTouch = imp ? (S.imports.at[key] || null) : null;
    if (local != null && imp == null) return { value: local, origin: "local", at: localTouch };
    if (local == null && imp != null) return { value: typeof imp === "string" ? imp : JSON.stringify(imp), origin: "import", at: impTouch };
    if (local == null && imp == null) return { value: null, origin: null, at: null };
    // cả hai: lấy bản mới hơn theo thời điểm lưu thật
    if (impTouch && (!localTouch || impTouch > localTouch)) return { value: typeof imp === "string" ? imp : JSON.stringify(imp), origin: "import", at: impTouch, alsoLocal: true };
    return { value: local, origin: "local", at: localTouch, alsoImport: true };
  };

  /* ---------------- BỘ MÁY ĐỒNG BỘ ---------------- */
  S.STATUS = { connected: "Đã kết nối", syncing: "Đang đồng bộ", ok: "Đồng bộ thành công", fail: "Đồng bộ thất bại", fileOnly: "Chỉ hỗ trợ nhập file", notConfigured: "Chưa cấu hình", unverified: "Chưa xác minh", linkOnly: "Chỉ mở link" };
  S.sources = [];          // danh sách nguồn (adapters đăng ký)
  S.data = {};             // dữ liệu chuẩn hóa hiện hành theo nguồn: {sourceId: {...}}
  S.cache = S.readJ(K.CACHE, {}) || {};
  S.sync = S.readJ(K.SYNC, {}) || {};
  S.registerSource = function (src) { S.sources.push(src); if (!S.sync[src.id]) S.sync[src.id] = { status: src.initialStatus || "notConfigured" }; };
  S.sourceById = function (id) { for (var i = 0; i < S.sources.length; i++) if (S.sources[i].id === id) return S.sources[i]; return null; };

  function saveSync() { S.writeJ(K.SYNC, S.sync); }
  function saveCache() { if (!S.writeJ(K.CACHE, S.cache)) { /* quá dung lượng: bỏ bớt bản ghi lớn nhất */ } }

  /* So sánh bản ghi cũ/mới -> các dòng lịch sử. records: {id: obj} */
  S.diffRecords = function (sourceId, entity, oldRecs, newRecs, fields, origin) {
    var out = [], oldR = oldRecs || {}, newR = newRecs || {};
    Object.keys(newR).forEach(function (id) {
      var a = oldR[id], b = newR[id];
      if (!a) { out.push({ origin: origin, source: sourceId, entity: entity, id: id, field: "(mới)", old: null, new: summarize(b, fields) }); return; }
      fields.forEach(function (f) { if (U.stable(a[f]) !== U.stable(b[f])) out.push({ origin: origin, source: sourceId, entity: entity, id: id, field: f, old: a[f], new: b[f] }); });
    });
    Object.keys(oldR).forEach(function (id) { if (!newR[id]) out.push({ origin: origin, source: sourceId, entity: entity, id: id, field: "(không còn ở nguồn)", old: summarize(oldR[id], fields), new: null }); });
    return out;
  };
  function summarize(r, fields) { var o = {}; fields.forEach(function (f) { if (r[f] !== undefined) o[f] = r[f]; }); return o; }

  var retryTimers = {};
  /* Đồng bộ 1 nguồn. Trả về Promise<status> */
  S.syncSource = function (id, opts) {
    opts = opts || {};
    var src = S.sourceById(id); if (!src) return Promise.resolve(null);
    var st = S.sync[id] = S.sync[id] || {};
    if (src.mode === "link" || src.mode === "fileOnly") { st.status = src.mode === "link" ? "linkOnly" : "fileOnly"; saveSync(); return Promise.resolve(st); }
    st.status = "syncing"; st.lastAttempt = U.nowIso(); S.emit("sync", id);
    return Promise.resolve().then(function () { return src.read(); }).then(function (res) {
      if (!res || res.missing) {
        st.status = "notConfigured"; st.message = (res && res.message) || "Chưa có dữ liệu nguồn trong trình duyệt này."; st.read = 0; st.errors = []; st.mode = null;
        S.data[id] = S.cache[id] && S.cache[id].data && st.keepStale ? S.cache[id].data : null;
        saveSync(); S.emit("sync", id); return st;
      }
      // kiểm tra hợp lệ
      if (res.error) throw new Error(res.error);
      var hashNow = U.hash(U.stable(res.data));
      var prev = S.cache[id];
      if (src.diff && (!prev || prev.hash !== hashNow)) {
        var logs = src.diff(prev ? prev.data : null, res.data, opts.origin || (res.origin === "import" ? "Nhập gói" : "Đồng bộ"));
        if (prev) S.addLog(logs); // lần đầu không ghi hàng loạt "(mới)"
        else S.addLog([{ origin: "Đồng bộ", source: id, entity: "nguồn", id: id, field: "(lần đầu)", old: null, new: (res.count || 0) + " bản ghi" }]);
      }
      S.data[id] = res.data;
      S.cache[id] = { at: U.nowIso(), hash: hashNow, data: res.data, sourceAt: res.sourceAt || null, origin: res.origin || null };
      saveCache();
      st.status = res.unverified ? "unverified" : "ok";
      st.lastOk = U.nowIso(); st.sourceAt = res.sourceAt || null; st.read = res.count || 0; st.errors = res.warnings || []; st.mode = res.origin || src.mode;
      st.reconcile = res.reconcile || 0; st.message = res.message || ""; st.retry = 0; st.lastError = null;
      clearTimeout(retryTimers[id]);
      saveSync(); S.emit("sync", id); S.emit("data", id); return st;
    }).catch(function (err) {
      st.status = "fail"; st.lastError = (err && err.message) || String(err); st.retry = (st.retry || 0) + 1;
      st.errors = [st.lastError];
      // giữ dữ liệu tốt gần nhất nhưng đánh dấu là cũ
      S.data[id] = S.cache[id] ? S.cache[id].data : null;
      st.staleFrom = S.cache[id] ? S.cache[id].at : null;
      saveSync(); S.emit("sync", id); S.emit("data", id);
      if (st.retry <= 3 && !opts.noRetry) { clearTimeout(retryTimers[id]); retryTimers[id] = setTimeout(function () { S.syncSource(id, { noRetry: st.retry >= 3 }); }, [2000, 5000, 15000][st.retry - 1] || 15000); }
      return st;
    });
  };
  S.syncAll = function () { return Promise.all(S.sources.map(function (s) { return S.syncSource(s.id); })); };
  S.isStale = function (id) { var st = S.sync[id]; return st && st.status === "fail" && !!S.data[id]; };

  /* Lắng nghe thay đổi từ công cụ nguồn (cùng origin, tab khác) */
  S.watch = function () {
    window.addEventListener("storage", function (e) {
      if (!e.key) { S.syncAll(); return; }
      S.sources.forEach(function (src) { if (src.keys && src.keys.some(function (k) { return k instanceof RegExp ? k.test(e.key) : k === e.key; })) S.syncSource(src.id, { origin: "Đồng bộ (tự động)" }); });
    });
    try { var bc = new BroadcastChannel("s1016"); bc.onmessage = function () { setTimeout(function () { S.syncAll(); }, 150); }; } catch (e) {}
    setInterval(function () { if (!document.hidden) S.sources.forEach(function (src) { if (src.poll) S.syncSource(src.id, { origin: "Đồng bộ (định kỳ)" }); }); }, 60000);
  };

  /* ---------------- NHẬP / XUẤT GÓI ---------------- */
  /* Nhập gói đồng bộ (từ chip "Tải gói" ở công cụ nguồn) hoặc bản sao lưu đầy đủ của Trợ lý */
  S.importPackage = function (text, fileName) {
    var obj; try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: "File không phải JSON hợp lệ." }; }
    var fileHash = U.hash(text);
    var dup = S.state.importLog.filter(function (l) { return l.hash === fileHash; })[0];
    var res = { ok: true, file: fileName, hash: fileHash, newKeys: 0, sameKeys: 0, olderKeys: 0, duplicateFile: !!dup, kind: "" };
    if (obj && obj.s1016pack) {
      res.kind = "Gói đồng bộ từ " + (obj.fromTool || "?") + " (" + (obj.origin || "") + ")";
      var touch = (obj.items && obj.items.S1016_TOUCH) || {};
      Object.keys(obj.items || {}).forEach(function (k) {
        if (k === "S1016_TOUCH") return;
        var v = obj.items[k]; if (v == null) return;
        var vStr = typeof v === "string" ? v : JSON.stringify(v);
        var at = (v && v.at) || (touch[k] && touch[k].at) || obj.exportedAt;
        var cur = S.imports.items[k], curStr = cur == null ? null : (typeof cur === "string" ? cur : JSON.stringify(cur));
        if (curStr === vStr) { res.sameKeys++; return; }
        if (cur != null && S.imports.at[k] && at && at < S.imports.at[k]) { res.olderKeys++; return; }
        S.imports.items[k] = v; S.imports.at[k] = at; res.newKeys++;
      });
      if (!S.writeJ(K.IMPORT, S.imports)) return { ok: false, error: "Không đủ dung lượng lưu gói nhập." };
    } else if (obj && obj.s1016backup) {
      return S.restoreBackup(obj, fileName);
    } else return { ok: false, error: "File không đúng định dạng gói đồng bộ S1016." };
    S.state.importLog.unshift({ hash: fileHash, file: fileName, at: U.nowIso(), kind: res.kind, newKeys: res.newKeys, sameKeys: res.sameKeys, olderKeys: res.olderKeys, duplicate: res.duplicateFile });
    S.state.importLog = S.state.importLog.slice(0, 200);
    S.saveState("import");
    S.addLog([{ origin: "Nhập gói", source: "IMPORT", entity: "file", id: fileName, field: "nhập", old: null, new: res.newKeys + " khóa mới · " + res.sameKeys + " trùng (bỏ qua) · " + res.olderKeys + " cũ hơn (bỏ qua)" }]);
    return res;
  };
  S.backup = function () {
    var pack = { s1016backup: 1, exportedAt: U.nowIso(), state: S.state, log: S.log, imports: S.imports, sources: {} };
    S.sources.forEach(function (s) { (s.keys || []).forEach(function (k) { if (typeof k === "string") { var v = S.raw.get(k); if (v != null) pack.sources[k] = v; } }); });
    S.raw.keys().forEach(function (k) { if (/^S1016_SNAP_|^S1016_TOUCH$/.test(k)) pack.sources[k] = S.raw.get(k); });
    return pack;
  };
  S.restoreBackup = function (obj, fileName) {
    if (!obj || !obj.s1016backup || !obj.state) return { ok: false, error: "Không phải bản sao lưu Trợ lý." };
    S.state = obj.state; S.log = obj.log || []; S.imports = obj.imports || { items: {}, at: {} };
    // dữ liệu công cụ nguồn trong bản sao lưu được đưa vào kho "gói nhập", KHÔNG ghi đè khóa của công cụ gốc
    Object.keys(obj.sources || {}).forEach(function (k) { if (S.imports.items[k] == null) { S.imports.items[k] = obj.sources[k]; S.imports.at[k] = obj.exportedAt; } });
    S.writeJ(K.STATE, S.state); S.writeJ(K.LOG, S.log); S.writeJ(K.IMPORT, S.imports);
    S.addLog([{ origin: "Khôi phục", source: "BACKUP", entity: "file", id: fileName || "", field: "khôi phục", old: null, new: "Bản sao lưu lúc " + U.hm(obj.exportedAt) }]);
    return { ok: true, restored: true, kind: "Bản sao lưu Trợ lý" };
  };
})();
