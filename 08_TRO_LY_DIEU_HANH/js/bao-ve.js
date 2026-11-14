/* BẢO VỆ TRỢ LÝ - màn hình mật khẩu + ghi nhận thiết bị + cảnh báo thiết bị lạ.
   - Mật khẩu KHÔNG nằm trong file: chỉ có "dấu vân tay" PBKDF2 (js/bao-ve-mk.js, đặt bằng _HE_THONG/dat_mat_khau.py).
   - Chưa mở khóa thì các file dữ liệu/ứng dụng (script[data-src] trong index.html) KHÔNG được tải.
   - Mỗi lần mở khóa / nhập sai: ghi vào Apps Script đồng bộ (ns bao_ve_tro_ly), khóa d_<mã máy>.
   - Máy tin cậy (laptop, điện thoại riêng) thấy cảnh báo khi có máy lạ vào hoặc có người nhập sai. */
(function () {
  "use strict";
  var MK = window.S1016_BAO_VE || {};
  var SYNC = { url: "https://script.google.com/macros/s/AKfycbzo-GXaLWkkfBDPOL6nyYM-_BdFPOcxBmpXSpdFH3qUmUdS3mYA6WDzalC9UlbNqzBl/exec", ns: "bao_ve_tro_ly", token: "k1016-0c5d3c02df924ab9" };
  var K_OK = "S1016_BV_OK", K_TRUST = "S1016_BV_TIN_CAY", K_ACK = "S1016_BV_DA_XEM", K_WAIT = "S1016_BV_CHO";
  var NGAY = 864e5, NHO_MAY_TIN_CAY = 30 * NGAY;

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(ms) { if (!ms) return "-"; var d = new Date(ms), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getHours()) + ":" + p(d.getMinutes()) + " " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }

  /* ---- mã máy (dùng chung với s1016-cloud.js) ---- */
  var devId = lsGet("S1016_A_DEVICE", null);
  if (!devId) { devId = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); lsSet("S1016_A_DEVICE", devId); }
  var devKey = ("d_" + devId).replace(/[^A-Za-z0-9_:.\-]/g, "_").slice(0, 80);
  function loaiMay() {
    var u = navigator.userAgent || "", os = "Máy khác", br = "Trình duyệt";
    if (/iPhone/.test(u)) os = "iPhone"; else if (/iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) os = "iPad";
    else if (/Android/.test(u)) os = /Mobile/.test(u) ? "Điện thoại Android" : "Máy tính bảng Android";
    else if (/Macintosh|Mac OS X/.test(u)) os = "Máy Mac"; else if (/Windows/.test(u)) os = "Máy Windows"; else if (/Linux|CrOS/.test(u)) os = "Máy Linux/Chromebook";
    if (/Zalo/i.test(u)) br = "Zalo"; else if (/FBAN|FBAV/.test(u)) br = "Facebook"; else if (/Edg\//.test(u)) br = "Edge";
    else if (/CriOS|Chrome\//.test(u)) br = "Chrome"; else if (/FxiOS|Firefox\//.test(u)) br = "Firefox"; else if (/Safari\//.test(u)) br = "Safari";
    return os + " · " + br;
  }

  /* ---- đồng bộ (Apps Script) ---- */
  function kvGet() {
    return fetch(SYNC.url + "?ns=" + SYNC.ns + "&t=" + Date.now()).then(function (r) { return r.json(); })
      .then(function (j) { return j && j.ok ? j.data || {} : {}; }).catch(function () { return null; });
  }
  function kvSet(key, v) {
    var set = {}; set[key] = { v: v, at: Date.now() };
    return fetch(SYNC.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: SYNC.token, ns: SYNC.ns, by: devId.slice(0, 40), set: set }) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  function ghiNhan(kieu) { // kieu: "vao" | "sai" | "tin_cay" | "bo_tin_cay"
    return kvGet().then(function (all) {
      var now = Date.now(), cur = (all && all[devKey] && all[devKey].v) || {};
      var r = { ten: cur.ten || "", loai: loaiMay(), lan_dau: cur.lan_dau || now, lan_cuoi: cur.lan_cuoi || 0, so_lan: cur.so_lan || 0,
        sai: cur.sai || 0, sai_cuoi: cur.sai_cuoi || 0, tin_cay: !!cur.tin_cay, tin_cay_luc: cur.tin_cay_luc || 0 };
      if (kieu === "vao") { r.lan_cuoi = now; r.so_lan++; }
      if (kieu === "sai") { r.sai++; r.sai_cuoi = now; }
      var tc = lsGet(K_TRUST, null); // trạng thái máy riêng luôn theo máy này
      if (tc && !r.tin_cay) { r.tin_cay = true; r.tin_cay_luc = now; }
      if (tc) r.ten = tc.ten || r.ten; else r.tin_cay = false;
      return kvSet(devKey, r);
    });
  }

  /* ---- mật khẩu ---- */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function bam(pw) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(pw.normalize("NFC")), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(MK.salt), iterations: MK.iter }, k, 256);
    }).then(hex);
  }
  function daMoKhoa() {
    var tag = MK.hash.slice(0, 16);
    if (ssGet(K_OK) === tag) return true;
    var t = lsGet(K_OK, null);
    return !!(t && t.h === tag && t.den > Date.now() && lsGet(K_TRUST, null));
  }
  function luuMoKhoa() {
    var tag = MK.hash.slice(0, 16); ssSet(K_OK, tag);
    if (lsGet(K_TRUST, null)) lsSet(K_OK, { h: tag, den: Date.now() + NHO_MAY_TIN_CAY });
  }

  /* ---- tải ứng dụng sau khi mở khóa ---- */
  function taiUngDung() {
    var list = Array.prototype.map.call(document.querySelectorAll("script[data-src]"), function (s) { return s.getAttribute("data-src"); });
    document.body.classList.remove("khoa");
    return list.reduce(function (p, src) {
      return p.then(function () { return new Promise(function (ok, bad) {
        var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("Không tải được " + src)); };
        document.body.appendChild(s); }); });
    }, Promise.resolve()).then(themNutNav).catch(function (e) { alert(e.message + " - thử tải lại trang."); });
  }

  /* ---- giao diện ---- */
  var CSS = "#bvGate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(135deg,#0039a6,#002a7a);font-family:'Be Vietnam Pro',system-ui,sans-serif}" +
    "#bvGate .bx{background:#fff;border-radius:16px;padding:26px 22px;width:100%;max-width:360px;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:center;color:#1b2230}" +
    "#bvGate img{height:34px;margin-bottom:10px}#bvGate h2{margin:0 0 4px;font-size:19px;color:#0039a6}#bvGate p{margin:0 0 16px;font-size:13px;color:#5b6475}" +
    "#bvGate input{width:100%;box-sizing:border-box;padding:12px 14px;font-size:16px;border:1.5px solid #c9d2e3;border-radius:10px;outline:none}#bvGate input:focus{border-color:#0039a6}" +
    "#bvGate button{width:100%;margin-top:12px;padding:12px;font-size:15px;font-weight:700;border:0;border-radius:10px;background:#e8082c;color:#fff;cursor:pointer}#bvGate button:disabled{opacity:.6}" +
    "#bvGate .err{min-height:18px;margin-top:10px;font-size:13px;color:#c3001f;font-weight:600}#bvGate .nt{margin-top:12px;font-size:11.5px;color:#8a93a5}" +
    ".bv-bar{position:sticky;top:0;z-index:999;background:#c3001f;color:#fff;font-size:13.5px;padding:10px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-family:'Be Vietnam Pro',system-ui,sans-serif}" +
    ".bv-bar b{font-weight:700}.bv-bar .sp{flex:1}.bv-bar button{background:#fff;color:#c3001f;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:13px}.bv-bar button.o{background:transparent;color:#fff;border:1px solid #fff}" +
    ".bv-bar.ask{background:#0039a6}.bv-bar.ask button{color:#0039a6}" +
    "#bvBox{position:fixed;inset:0;z-index:9998;background:rgba(10,20,40,.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;font-family:'Be Vietnam Pro',system-ui,sans-serif}" +
    "#bvBox .bx{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:760px;color:#1b2230}#bvBox h3{margin:0 0 6px;color:#0039a6}#bvBox .tw{overflow-x:auto}" +
    "#bvBox table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}#bvBox th,#bvBox td{text-align:left;padding:7px 8px;border-bottom:1px solid #e5e9f2;white-space:nowrap}#bvBox th{background:#f2f5fb;color:#1b2230;font-weight:700}" +
    "#bvBox tr.la td{background:#fff1f3}#bvBox .tg{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:700}#bvBox .ok{background:#e3f6ea;color:#11743a}#bvBox .bad{background:#ffe1e6;color:#c3001f}" +
    "#bvBox .ft{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}#bvBox button{border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;background:#0039a6;color:#fff}#bvBox button.o{background:#eef2f9;color:#0039a6}" +
    "#bvBox .hd{font-size:12.5px;color:#5b6475;margin-top:12px;line-height:1.55}";
  function style() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  function manHinhKhoa() {
    var g = document.createElement("div"); g.id = "bvGate";
    g.innerHTML = '<form class="bx" autocomplete="on"><img src="kohnan_logo.png" alt="Kohnan"><h2>Trợ Lý Điều Hành 1016</h2><p>Trang riêng. Nhập mật khẩu để vào.</p>' +
      '<input type="text" name="username" value="tro-ly-1016" autocomplete="username" hidden>' +
      '<input type="password" id="bvPw" autocomplete="current-password" placeholder="Mật khẩu" required><button type="submit" id="bvGo">Vào trang</button>' +
      '<div class="err" id="bvErr"></div><div class="nt">Mọi lần vào trang và nhập sai đều được ghi lại theo thiết bị.</div></form>';
    document.body.appendChild(g);
    var pw = g.querySelector("#bvPw"), go = g.querySelector("#bvGo"), err = g.querySelector("#bvErr");
    setTimeout(function () { pw.focus(); }, 50);
    g.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var w = lsGet(K_WAIT, { n: 0, den: 0 });
      if (w.den > Date.now()) { err.textContent = "Nhập sai nhiều lần. Đợi " + Math.ceil((w.den - Date.now()) / 1000) + " giây."; return; }
      go.disabled = true; err.textContent = "";
      bam(pw.value).then(function (h) {
        go.disabled = false;
        if (h === MK.hash) {
          lsSet(K_WAIT, { n: 0, den: 0 }); luuMoKhoa(); ghiNhan("vao"); g.remove(); taiUngDung().then(sauKhiVao);
        } else {
          w.n++; if (w.n >= 5) { w.den = Date.now() + Math.min(300, 30 * Math.pow(2, w.n - 5)) * 1000; }
          lsSet(K_WAIT, w); ghiNhan("sai"); pw.value = ""; pw.focus();
          err.textContent = "Sai mật khẩu" + (w.den > Date.now() ? ". Tạm khóa " + Math.ceil((w.den - Date.now()) / 1000) + " giây." : " (lần " + w.n + ").");
        }
      }).catch(function () { go.disabled = false; err.textContent = "Trình duyệt này không hỗ trợ. Mở bằng Chrome hoặc Safari mới."; });
    });
  }

  function thanh(cls, html) {
    var b = document.createElement("div"); b.className = "bv-bar " + cls; b.innerHTML = html;
    document.body.insertBefore(b, document.body.firstChild); return b;
  }

  function sauKhiVao() {
    var trust = lsGet(K_TRUST, null);
    if (!trust) {
      var b = thanh("ask", '<span>Đây có phải <b>laptop hoặc điện thoại riêng của chị</b> không? Máy riêng sẽ nhớ đăng nhập 30 ngày và nhận cảnh báo khi có máy lạ vào.</span><span class="sp"></span>' +
        '<button data-a="yes">Đúng, máy riêng</button><button class="o" data-a="no">Không, chỉ lần này</button>');
      b.addEventListener("click", function (e) {
        var a = e.target.getAttribute("data-a"); if (!a) return;
        if (a === "yes") {
          var ten = prompt("Đặt tên cho máy này (vd: Laptop chị, iPhone chị):", loaiMay()) || loaiMay();
          lsSet(K_TRUST, { ten: ten.slice(0, 40), luc: Date.now() }); luuMoKhoa(); ghiNhan("tin_cay").then(kiemTraCanhBao);
        }
        b.remove();
      });
      return;
    }
    kiemTraCanhBao();
  }

  function canhBao(all) {
    var ack = lsGet(K_ACK, 0), out = [];
    Object.keys(all || {}).forEach(function (k) {
      if (k.indexOf("d_") !== 0) return;
      var r = all[k].v || {}, may = (r.ten ? r.ten + " - " : "") + (r.loai || "?"), toi = k === devKey;
      if (!r.tin_cay && !toi && r.lan_cuoi > ack) out.push("<b>" + esc(may) + "</b> đã vào trang lúc " + fmt(r.lan_cuoi));
      if (r.sai_cuoi > ack) out.push((toi ? "Máy này" : "<b>" + esc(may) + "</b>") + " nhập sai mật khẩu (" + r.sai + " lần, gần nhất " + fmt(r.sai_cuoi) + ")");
      if (r.tin_cay && !toi && r.tin_cay_luc > ack) out.push("<b>" + esc(may) + "</b> mới được đánh dấu là máy riêng lúc " + fmt(r.tin_cay_luc));
    });
    return out;
  }
  function kiemTraCanhBao() {
    if (!lsGet(K_TRUST, null)) return;
    kvGet().then(function (all) {
      if (!all) return;
      var ds = canhBao(all); if (!ds.length) return;
      var old = document.querySelector(".bv-bar:not(.ask)"); if (old) old.remove();
      var b = thanh("", "<span>⚠ <b>Cảnh báo bảo mật:</b> " + ds.slice(0, 3).join(" · ") + (ds.length > 3 ? " · và " + (ds.length - 3) + " mục khác" : "") +
        ". Nếu không phải chị: đổi mật khẩu ngay.</span><span class=\"sp\"></span><button data-a=\"xem\">Xem thiết bị</button><button class=\"o\" data-a=\"ack\">Đã biết</button>");
      b.addEventListener("click", function (e) {
        var a = e.target.getAttribute("data-a");
        if (a === "xem") bangThietBi();
        if (a === "ack") { lsSet(K_ACK, Date.now()); b.remove(); }
      });
    });
  }

  function bangThietBi() {
    var box = document.createElement("div"); box.id = "bvBox";
    box.innerHTML = '<div class="bx"><h3>🔒 Thiết bị đã vào Trợ lý</h3><div>Đang tải...</div></div>';
    document.body.appendChild(box);
    box.addEventListener("click", function (e) { if (e.target === box) box.remove(); });
    kvGet().then(function (all) {
      var rows = Object.keys(all || {}).filter(function (k) { return k.indexOf("d_") === 0; }).map(function (k) { var r = all[k].v || {}; r._k = k; return r; })
        .sort(function (a, b) { return Math.max(b.lan_cuoi, b.sai_cuoi) - Math.max(a.lan_cuoi, a.sai_cuoi); });
      var tb = rows.map(function (r) {
        return '<tr class="' + (r.tin_cay ? "" : "la") + '"><td>' + esc(r.ten || "-") + (r._k === devKey ? " <b>(máy này)</b>" : "") + "</td><td>" + esc(r.loai) +
          '</td><td><span class="tg ' + (r.tin_cay ? "ok" : "bad") + '">' + (r.tin_cay ? "Máy riêng" : "Máy lạ") + "</span></td><td>" + fmt(r.lan_cuoi) + "</td><td>" + (r.so_lan || 0) +
          "</td><td>" + (r.sai ? r.sai + " (" + fmt(r.sai_cuoi) + ")" : "0") + "</td><td>" + fmt(r.lan_dau) + "</td></tr>";
      }).join("");
      var trust = lsGet(K_TRUST, null);
      box.querySelector(".bx").innerHTML = '<h3>🔒 Thiết bị đã vào Trợ lý</h3><div class="tw"><table><thead><tr><th>Tên máy</th><th>Loại</th><th>Trạng thái</th><th>Vào gần nhất</th><th>Số lần vào</th><th>Nhập sai</th><th>Lần đầu</th></tr></thead><tbody>' +
        (tb || '<tr><td colspan="7">Chưa có dữ liệu.</td></tr>') + "</tbody></table></div>" +
        '<div class="hd">Hàng đỏ = máy không phải máy riêng của chị. Nếu thấy máy lạ hoặc nhập sai mà không phải chị: <b>đổi mật khẩu</b> (nhờ Claude chạy <code>python3 _HE_THONG/dat_mat_khau.py</code>), mọi máy sẽ phải nhập mật khẩu mới.<br>Trang chỉ nhận diện theo trình duyệt: cùng một máy mà mở bằng trình duyệt khác, hoặc xóa dữ liệu trình duyệt, sẽ hiện là máy mới.</div>' +
        '<div class="ft">' + (trust ? '<button class="o" data-a="bo">Máy này không còn là máy riêng</button>' : "") + '<button class="o" data-a="khoa">Khóa trang ngay</button><button data-a="dong">Đóng</button></div></div>';
    });
    box.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "dong") box.remove();
      if (a === "khoa") khoaNgay();
      if (a === "bo" && confirm("Bỏ đánh dấu máy riêng cho máy này? Lần sau phải nhập mật khẩu mỗi lần mở.")) {
        try { localStorage.removeItem(K_TRUST); localStorage.removeItem(K_OK); } catch (x) {}
        ghiNhan("bo_tin_cay"); box.remove();
      }
    });
  }

  function khoaNgay() { ssSet(K_OK, null); try { localStorage.removeItem(K_OK); } catch (x) {} location.reload(); }

  function themNutNav() {
    var nav = document.getElementById("navTabs"); if (!nav || document.getElementById("bvNav")) return;
    var b = document.createElement("button"); b.id = "bvNav"; b.type = "button"; b.className = "nav-sys"; b.textContent = "🔒 Bảo mật";
    b.addEventListener("click", function (e) { e.stopPropagation(); bangThietBi(); });
    nav.appendChild(b);
  }

  /* ---- khởi động ---- */
  style();
  if (!MK.hash || !MK.salt) { taiUngDung(); return; } // chưa đặt mật khẩu -> mở như cũ
  if (!window.crypto || !crypto.subtle) { document.body.innerHTML = "<p style='padding:24px;font-family:sans-serif'>Trình duyệt này không mở được trang bảo vệ. Hãy mở link bằng Chrome hoặc Safari (địa chỉ https).</p>"; return; }
  if (daMoKhoa()) { taiUngDung().then(function () { ghiNhan("vao"); sauKhiVao(); }); }
  else manHinhKhoa();
})();
