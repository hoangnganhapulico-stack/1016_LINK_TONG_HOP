/* S1016 BRIDGE v1 - cầu nối dữ liệu công cụ nguồn -> Trợ lý Điều hành Store 1016
   - Ghi thời điểm lưu thật (S1016_TOUCH) khi công cụ lưu vào localStorage các khóa nghiệp vụ.
   - Cho phép công cụ công bố ảnh chụp dữ liệu (S1016_SNAP_<KIND>) để Trợ lý đọc cùng origin.
   - Chip nhỏ góc dưới: xem lần gửi gần nhất + tải "gói đồng bộ" JSON (nhập tay vào Trợ lý khi khác máy/origin).
   Không đọc/ghi dữ liệu nào ngoài các khóa S1016_*. Không gửi dữ liệu ra mạng. */
(function () {
  "use strict";
  if (window.S1016Bridge) return;
  var TOOL = window.S1016_BRIDGE_TOOL || { id: "UNKNOWN", name: document.title };
  var WATCH = /^(khn16-|TEAM_ADMIN_|PUSH_SALE_V8|kohnan1016_)/;
  var bc = null; try { bc = new BroadcastChannel("s1016"); } catch (e) {}
  var ls = null; try { ls = window.localStorage; ls.getItem("x"); } catch (e) { ls = null; }

  function nowIso() { return new Date().toISOString(); }
  function readJ(k, d) { try { var v = ls && ls.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function hash(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); }

  // 1) Ghi thời điểm lưu thật của các khóa nghiệp vụ
  if (ls && Storage && Storage.prototype && !Storage.prototype.__s1016) {
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var r = orig.apply(this, arguments);
      try {
        if (this === window.localStorage && WATCH.test(String(k)) && String(k).indexOf("__probe__") < 0) {
          var t = readJ("S1016_TOUCH", {}) || {};
          t[k] = { at: nowIso(), tool: TOOL.id, page: location.pathname.split("/").slice(-2).join("/") };
          orig.call(this, "S1016_TOUCH", JSON.stringify(t));
          if (bc) bc.postMessage({ type: "touch", key: k, tool: TOOL.id });
        }
      } catch (e) {}
      return r;
    };
    Storage.prototype.__s1016 = true;
  }

  // 2) Công bố ảnh chụp dữ liệu
  var last = null;
  function publish(kind, payload, meta) {
    var body = JSON.stringify(payload);
    var snap = { v: 1, kind: kind, tool: TOOL.id, toolName: TOOL.name, page: location.href.split("#")[0], at: nowIso(), hash: hash(body), meta: meta || {}, payload: payload };
    var prev = readJ("S1016_SNAP_" + kind, null);
    if (prev && prev.hash === snap.hash) { snap.at = prev.at; last = snap; chip(); return { ok: true, unchanged: true }; }
    try { ls.setItem("S1016_SNAP_" + kind, JSON.stringify(snap)); }
    catch (e) { last = { error: String(e && e.message || e), kind: kind, at: nowIso() }; chip(); return { ok: false, error: last.error }; }
    last = snap; chip();
    if (bc) try { bc.postMessage({ type: "snap", kind: kind, tool: TOOL.id, at: snap.at }); } catch (e) {}
    return { ok: true };
  }

  function downloadPack() {
    var pack = { s1016pack: 1, exportedAt: nowIso(), fromTool: TOOL.id, origin: location.origin, items: {} };
    for (var i = 0; ls && i < ls.length; i++) { var k = ls.key(i);
      if (/^S1016_SNAP_/.test(k) || k === "S1016_TOUCH") pack.items[k] = readJ(k, null);
      else if (WATCH.test(k) && k.indexOf("__probe__") < 0) pack.items[k] = ls.getItem(k); }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: "application/json" }));
    var d = new Date(), p = function (n) { return n < 10 ? "0" + n : "" + n; };
    a.download = "S1016_GoiDongBo_" + TOOL.id + "_" + p(d.getDate()) + "-" + p(d.getMonth() + 1) + "-" + d.getFullYear() + "_" + p(d.getHours()) + p(d.getMinutes()) + ".json";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  // 3) Chip trạng thái
  var chipEl = null, hidden = false;
  function chip() {
    if (hidden || !document.body) return;
    if (!chipEl) {
      chipEl = document.createElement("div");
      chipEl.id = "s1016-chip";
      chipEl.setAttribute("style", "position:fixed;left:10px;bottom:10px;z-index:2147483000;background:#fff;border:1px solid #c9d6ee;border-radius:999px;box-shadow:0 2px 8px rgba(0,40,120,.15);font:600 11px/1.2 'Be Vietnam Pro',system-ui,sans-serif;color:#0039a6;padding:5px 6px 5px 10px;display:flex;gap:6px;align-items:center;max-width:calc(100vw - 20px)");
      document.body.appendChild(chipEl);
      chipEl.addEventListener("click", function (e) {
        var b = e.target.closest("[data-s1016]"); if (!b) return;
        if (b.dataset.s1016 === "pack") downloadPack();
        if (b.dataset.s1016 === "x") { hidden = true; chipEl.remove(); }
      });
    }
    var txt;
    if (!last) txt = "🔗 Trợ lý 1016: chờ dữ liệu";
    else if (last.error) txt = "⚠️ Trợ lý 1016: lưu thất bại (" + last.error.slice(0, 40) + ")";
    else { var t = new Date(last.at); txt = "🔗 Trợ lý 1016: đã gửi " + (t.getHours() < 10 ? "0" : "") + t.getHours() + ":" + (t.getMinutes() < 10 ? "0" : "") + t.getMinutes(); }
    chipEl.innerHTML = '<span>' + txt + '</span><button data-s1016="pack" title="Tải gói đồng bộ JSON để nhập vào Trợ lý trên máy khác" style="border:1px solid #0039a6;background:#0039a6;color:#fff;border-radius:999px;font:600 10px system-ui;padding:3px 8px;cursor:pointer">Tải gói</button><button data-s1016="x" title="Ẩn" style="border:0;background:none;color:#8a94a3;cursor:pointer;font-size:13px">✕</button>';
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chip); else setTimeout(chip, 0);

  window.S1016Bridge = { publish: publish, downloadPack: downloadPack, tool: TOOL, version: 1 };
})();
