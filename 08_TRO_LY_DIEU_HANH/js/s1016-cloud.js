/* S1016 CLOUD (tùy chọn) - đồng bộ nhiều máy qua Supabase (PostgREST).
   Chỉ hoạt động khi người dùng tự cấu hình URL + anon key + mã cửa hàng (nhập trên máy, không nằm trong file HTML).
   Bảng: s1016_kv(k text pk, v jsonb, rev bigint, updated_at timestamptz, updated_by text, device text) - xem supabase/schema.sql */
(function () {
  "use strict";
  var S = window.S1016, U = S.util, C = S.cloud = {};
  var dirty = {}, timer = null, deviceId = S.readJ("S1016_A_DEVICE", null);
  if (!deviceId) { deviceId = U.uid("dev"); S.writeJ("S1016_A_DEVICE", deviceId); }
  C.device = deviceId;
  C.cfg = function () { return S.state.settings.cloud || {}; };
  C.enabled = function () { var c = C.cfg(); return !!(c.enabled && c.url && c.key && c.storeKey); };
  C.status = S.readJ("S1016_A_CLOUD", { status: "notConfigured", lastPush: null, lastPull: null, revs: {}, errors: [] });
  function saveStatus() { S.writeJ("S1016_A_CLOUD", C.status); S.emit("sync", "CLOUD"); }
  function hdr(extra) { var c = C.cfg(); return Object.assign({ apikey: c.key, Authorization: "Bearer " + c.key, "x-s1016-store": c.storeKey, "Content-Type": "application/json" }, extra || {}); }
  function base() { return C.cfg().url.replace(/\/+$/, "") + "/rest/v1/s1016_kv"; }
  function req(url, opt) {
    return fetch(url, opt).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + ": " + (t || r.statusText).slice(0, 200)); });
      return r.status === 204 ? null : r.json();
    });
  }
  C.test = function () {
    if (!C.enabled()) { C.status.status = "notConfigured"; saveStatus(); return Promise.resolve({ ok: false, error: "Chưa cấu hình đủ URL, anon key, mã cửa hàng." }); }
    C.status.status = "syncing"; saveStatus();
    return req(base() + "?select=k&limit=1", { headers: hdr() }).then(function () { C.status.status = "connected"; C.status.lastTest = U.nowIso(); C.status.errors = []; saveStatus(); return { ok: true }; })
      .catch(function (e) { C.status.status = "fail"; C.status.errors = [e.message]; saveStatus(); return { ok: false, error: e.message }; });
  };
  C.syncKeys = function () {
    var ks = ["STATE"];
    S.raw.keys().forEach(function (k) { if (/^S1016_SNAP_|^khn16-(sched|tasks)$|^TEAM_ADMIN_(POS_)?PUSH_SALE_/.test(k) && k.indexOf("__probe__") < 0) ks.push(k); });
    return ks;
  };
  C.markDirty = function (k) { if (!C.enabled()) return; dirty[k] = 1; clearTimeout(timer); timer = setTimeout(function () { C.push(); }, 2500); };
  function valueOf(k) { if (k === "STATE") { var st = U.clone(S.state); delete st.settings; return st; } var v = S.raw.get(k); return v == null ? null : { raw: v }; }
  /* Đẩy: ghi có điều kiện theo rev (chống ghi đè thay đổi đồng thời) */
  C.push = function (keys) {
    if (!C.enabled()) return Promise.resolve({ ok: false, error: "Chưa bật đồng bộ đám mây." });
    keys = keys || (Object.keys(dirty).length ? Object.keys(dirty) : C.syncKeys()); dirty = {};
    var res = { ok: true, pushed: 0, conflicts: 0, errors: [] };
    C.status.status = "syncing"; saveStatus();
    return keys.reduce(function (p, k) {
      return p.then(function () {
        var v = valueOf(k); if (v == null) return;
        var known = C.status.revs[k] || 0;
        return req(base() + "?k=eq." + encodeURIComponent(k) + "&select=k,rev,v,updated_at,device", { headers: hdr() }).then(function (rows) {
          var remote = rows && rows[0];
          if (remote && remote.rev > known && remote.device !== deviceId) {
            // xung đột: máy khác đã ghi sau lần kéo gần nhất -> gộp trước rồi mới ghi
            res.conflicts++;
            if (k === "STATE") { C.mergeState(remote.v); v = valueOf(k); }
            else { S.addLog([{ origin: "Đám mây", source: "CLOUD", entity: "xung đột", id: k, field: "rev", old: known, new: remote.rev, note: "Máy khác vừa ghi - giữ bản mới hơn theo thời điểm" }]);
              if (remote.updated_at > (C.status.lastPushAt && C.status.lastPushAt[k] || "")) { C.status.revs[k] = remote.rev; return; } }
          }
          var next = (remote ? remote.rev : 0) + 1, body = JSON.stringify([{ k: k, v: v, rev: next, updated_at: U.nowIso(), updated_by: S.state.settings.user || "", device: deviceId }]);
          var url = base() + (remote ? "?k=eq." + encodeURIComponent(k) + "&rev=eq." + remote.rev : "");
          var opt = remote ? { method: "PATCH", headers: hdr({ Prefer: "return=representation" }), body: JSON.stringify(JSON.parse(body)[0]) } : { method: "POST", headers: hdr({ Prefer: "return=representation,resolution=merge-duplicates" }), body: body };
          return req(url, opt).then(function (out) {
            if (remote && (!out || !out.length)) { res.conflicts++; return; } // rev đổi giữa chừng - lần sau gộp lại
            C.status.revs[k] = next; res.pushed++; C.status.lastPushAt = C.status.lastPushAt || {}; C.status.lastPushAt[k] = U.nowIso();
          });
        }).catch(function (e) { res.errors.push(k + ": " + e.message); });
      });
    }, Promise.resolve()).then(function () {
      C.status.lastPush = U.nowIso(); C.status.status = res.errors.length ? "fail" : "ok"; C.status.errors = res.errors; C.status.lastResult = res; saveStatus();
      if (res.errors.length) res.ok = false; return res;
    });
  };
  /* Kéo: dữ liệu công cụ từ máy khác vào kho "gói nhập" (không ghi đè khóa gốc của công cụ trên máy này) */
  C.pull = function () {
    if (!C.enabled()) return Promise.resolve({ ok: false, error: "Chưa bật đồng bộ đám mây." });
    C.status.status = "syncing"; saveStatus();
    var since = C.status.lastPullAt || "1970-01-01T00:00:00Z";
    return req(base() + "?updated_at=gt." + encodeURIComponent(since) + "&select=k,v,rev,updated_at,device&order=updated_at.asc", { headers: hdr() }).then(function (rows) {
      var n = 0; (rows || []).forEach(function (r) {
        C.status.revs[r.k] = Math.max(C.status.revs[r.k] || 0, r.rev);
        if (r.device === deviceId) return;
        if (r.k === "STATE") { C.mergeState(r.v); n++; }
        else if (r.v && r.v.raw != null) { var cur = S.imports.at[r.k]; if (!cur || r.updated_at > cur) { S.imports.items[r.k] = r.v.raw; S.imports.at[r.k] = r.updated_at; n++; } }
        if (r.updated_at > since) since = r.updated_at;
      });
      S.writeJ(S.KEYS.IMPORT, S.imports);
      C.status.lastPull = U.nowIso(); C.status.lastPullAt = since; C.status.status = "ok"; C.status.errors = []; saveStatus();
      return S.syncAll().then(function () { return { ok: true, applied: n }; });
    }).catch(function (e) { C.status.status = "fail"; C.status.errors = [e.message]; saveStatus(); return { ok: false, error: e.message }; });
  };
  /* Gộp trạng thái Trợ lý theo từng bản ghi (bản cập nhật sau thắng; nhật ký đã xác nhận không bị bản nháp ghi đè) */
  C.mergeState = function (remote) {
    if (!remote) return;
    ["taskOverrides", "adhocTasks", "journals", "followUps"].forEach(function (f) {
      var L = S.state[f] = S.state[f] || {}, R = remote[f] || {};
      Object.keys(R).forEach(function (id) {
        var a = L[id], b = R[id];
        if (!a) { L[id] = b; return; }
        if (f === "journals" && a.status === "confirmed" && b.status !== "confirmed") return;
        if (f === "journals" && b.status === "confirmed" && a.status !== "confirmed") { L[id] = b; return; }
        if ((b.updatedAt || "") > (a.updatedAt || "")) { S.addLog([{ origin: "Đám mây", source: "CLOUD", entity: f, id: id, field: "(gộp)", old: a.updatedAt, new: b.updatedAt, note: "lấy bản mới hơn từ máy khác" }]); L[id] = b; }
      });
    });
    var seen = {}; S.state.importLog = (S.state.importLog || []).concat(remote.importLog || []).filter(function (l) { if (seen[l.hash + l.at]) return false; seen[l.hash + l.at] = 1; return true; }).slice(0, 200);
    S.writeJ(S.KEYS.STATE, S.state); S.emit("state", "cloud-merge");
  };
  S.registerSource({ id: "CLOUD", name: "Đồng bộ đám mây (Supabase - tùy chọn)", group: "Hệ thống", mode: "cloud", entity: "Đồng bộ nhiều máy", keys: [],
    how: "Cấu hình tại mục Nguồn dữ liệu → Đám mây. Xem supabase/schema.sql.",
    read: function () {
      if (!C.enabled()) return { missing: true, message: "Chưa cấu hình (tùy chọn) - các máy đang dùng dữ liệu riêng của từng trình duyệt." };
      return C.test().then(function (r) { if (!r.ok) throw new Error(r.error); return { data: { ok: true }, count: 0, origin: "cloud", sourceAt: C.status.lastPull, message: "Kéo gần nhất: " + U.hm(C.status.lastPull) + " · Đẩy gần nhất: " + U.hm(C.status.lastPush) }; });
    } });
})();
