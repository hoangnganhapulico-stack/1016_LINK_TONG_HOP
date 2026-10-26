// XW - BỘ GHI EXCEL CÓ ĐỊNH DẠNG (không cần thư viện ngoài)
window.XW = (() => {
  const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"");
  const colName = n => { let s = ""; n++; while (n) { const m = (n-1)%26; s = String.fromCharCode(65+m) + s; n = Math.floor((n-1)/26); } return s; };
  const ref = (r,c) => colName(c) + (r+1);

  // Bộ màu chuẩn Kohnan (khớp skill kohnan-page-style)
  const C = { blue:"0039A6", blue2:"0039A6", blueD:"002B7F", blueL:"E8F0FA", kred:"E8082C", yellow:"F5B800", yellowL:"FFF6D6", green:"1F8A4C", red:"D63B2F", gray:"465364", grayL:"FAFBFC", border:"D5DCE6", text:"16202C", white:"FFFFFF" };
  const FONT = "Arial";

  function StyleBook() {
    const fonts = [], fills = ['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'], borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'], numFmts = [], xfs = [], cache = {};
    const idx = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length-1; } return i; };
    const fmtId = f => { if (!f) return 0; const builtin = {"0":1,"0.00":2,"#,##0":3,"#,##0.00":4,"0%":9,"0.0%":10,"@":49}; if (builtin[f] != null) return builtin[f]; let i = numFmts.indexOf(f); if (i < 0) { numFmts.push(f); i = numFmts.length-1; } return 164 + i; };
    const get = (o={}) => {
      const k = JSON.stringify(o); if (cache[k] != null) return cache[k];
      const f = `<font>${o.b?"<b/>":""}${o.i?"<i/>":""}<sz val="${o.sz||10}"/><color rgb="FF${o.color||C.text}"/><name val="${FONT}"/><family val="2"/></font>`;
      const fi = idx(fonts, f);
      const fl = o.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${o.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      let bd = 0;
      if (o.border) { const bc = o.border === true ? C.border : o.border; const side = t => `<${t} style="thin"><color rgb="FF${bc}"/></${t}>`; bd = idx(borders, `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`); }
      if (o.bottom) { bd = idx(borders, `<border><left/><right/><top/><bottom style="medium"><color rgb="FF${o.bottom}"/></bottom><diagonal/></border>`); }
      const nf = fmtId(o.fmt);
      const al = `<alignment horizontal="${o.h||"general"}" vertical="${o.v||"center"}"${o.wrap?' wrapText="1"':""}${o.indent?` indent="${o.indent}"`:""}/>`;
      xfs.push(`<xf numFmtId="${nf}" fontId="${fi}" fillId="${fl}" borderId="${bd}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`);
      return (cache[k] = xfs.length - 1);
    };
    get({}); // style 0 mặc định
    const xml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${numFmts.length?`<numFmts count="${numFmts.length}">${numFmts.map((f,i)=>`<numFmt numFmtId="${164+i}" formatCode="${xmlEsc(f)}"/>`).join("")}</numFmts>`:""}
<fonts count="${fonts.length}">${fonts.join("")}</fonts>
<fills count="${fills.length}">${fills.join("")}</fills>
<borders count="${borders.length}">${borders.join("")}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
    return { get, xml };
  }

  // Kiểu ô theo loại dữ liệu
  const TYPE = {
    text:  { h:"left" },
    textB: { h:"left", b:true },
    wrap:  { h:"left", wrap:true },
    center:{ h:"center" },
    phone: { h:"center", fmt:"@" },
    code:  { h:"center", fmt:"@", color:C.gray },
    money: { h:"right", fmt:"#,##0" },
    moneyB:{ h:"right", fmt:"#,##0", b:true, color:C.green },
    int:   { h:"center", fmt:"#,##0" },
    dec:   { h:"center", fmt:"0.0" },
    pct:   { h:"center", fmt:"0.0%" },
    stt:   { h:"center", color:"8A94A3" },
  };

  function Sheet(name) {
    const rows = [];
    const sh = { name: String(name).replace(/[\[\]\*\?\/\\:]/g,"-").slice(0,31), rows, cols:[], merges:[], freeze:null, filter:null, printTitle:null, landscape:true, r:0, tabColor:null };
    sh.set = (r, c, v, style) => { (rows[r] = rows[r] || {cells:[]}).cells[c] = {v, s:style}; };
    sh.height = (r, ht) => { (rows[r] = rows[r] || {cells:[]}).ht = ht; };
    return sh;
  }

  function sheetXml(sh, sb) {
    const lastCol = Math.max(0, ...sh.rows.filter(Boolean).map(r => r.cells.length - 1), sh.cols.length - 1);
    let body = "";
    sh.rows.forEach((row, r) => {
      if (!row) return;
      let cs = "";
      row.cells.forEach((cell, c) => {
        if (!cell) return;
        const s = cell.s || 0, v = cell.v, a = ref(r,c);
        if (v === null || v === undefined || v === "") cs += `<c r="${a}" s="${s}"/>`;
        else if (typeof v === "number" && isFinite(v)) cs += `<c r="${a}" s="${s}"><v>${v}</v></c>`;
        else cs += `<c r="${a}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      });
      body += `<row r="${r+1}"${row.ht?` ht="${row.ht}" customHeight="1"`:""}>${cs}</row>`;
    });
    const fr = sh.freeze;
    const pane = fr ? `<pane ${fr.c?`xSplit="${fr.c}" `:""}ySplit="${fr.r}" topLeftCell="${ref(fr.r, fr.c||0)}" activePane="${fr.c?"bottomRight":"bottomLeft"}" state="frozen"/><selection pane="${fr.c?"bottomRight":"bottomLeft"}" activeCell="${ref(fr.r, fr.c||0)}" sqref="${ref(fr.r, fr.c||0)}"/>` : "";
    const cols = sh.cols.length ? `<cols>${sh.cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr>${sh.tabColor?`<tabColor rgb="FF${sh.tabColor}"/>`:""}<pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${ref(Math.max(0,sh.rows.length-1), lastCol)}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="100">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
${cols}<sheetData>${body}</sheetData>
${sh.filter?`<autoFilter ref="${sh.filter}"/>`:""}
${sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells>`:""}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${sh.landscape?"landscape":"portrait"}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L&amp;8KOHNAN Parc Mall - ${xmlEsc(sh.name)}&amp;R&amp;8Trang &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`;
  }

  // ZIP (lưu không nén)
  const CRC = (() => { const t = new Uint32Array(256); for (let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i=0;i<b.length;i++) c = CRC[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    const u16 = v => [v&255, (v>>>8)&255], u32 = v => [v&255, (v>>>8)&255, (v>>>16)&255, (v>>>24)&255];
    files.forEach(f => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + data.length;
    });
    const csize = central.reduce((s,p)=>s+p.length,0);
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
    return new Blob([...parts, ...central, end], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  function build(sheets, sb) {
    const ws = sheets.map(s => sheetXml(s, sb));
    const names = sheets.map(s => s.name);
    const defNames = sheets.map((s,i) => s.printTitle ? `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xmlEsc(s.name).replace(/'/g,"''")}'!$${s.printTitle}:$${s.printTitle}</definedName>` : "")
      .concat(sheets.map((s,i) => s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEsc(s.name).replace(/'/g,"''")}'!${s.filter.replace(/([A-Z]+)(\d+)/g,"$$$1$$$2")}</definedName>` : "")).join("");
    const files = [
      {name:"[Content_Types].xml", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ws.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`},
      {name:"_rels/.rels", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
      {name:"xl/workbook.xml", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names.map((n,i)=>`<sheet name="${xmlEsc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets>${defNames?`<definedNames>${defNames}</definedNames>`:""}</workbook>`},
      {name:"xl/_rels/workbook.xml.rels", data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ws.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${ws.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
      {name:"xl/styles.xml", data:sb.xml()},
      ...ws.map((d,i)=>({name:`xl/worksheets/sheet${i+1}.xml`, data:d})),
    ];
    return zip(files);
  }

  // API cấp cao: dựng sổ báo cáo theo mẫu Kohnan
  function Book() {
    const sb = StyleBook(), sheets = [];
    const S = {
      title:   sb.get({b:true, sz:15, color:C.white, fill:C.blue, h:"left", indent:1}),
      sub:     sb.get({i:true, sz:9, color:C.gray, fill:C.blueL, h:"left", indent:1, wrap:true}),
      section: sb.get({b:true, sz:11, color:C.blue, bottom:C.kred, h:"left"}),
      sectionF:sb.get({bottom:C.kred}),
      head:    sb.get({b:true, sz:10, color:C.white, fill:C.blue, h:"center", wrap:true, border:C.blueD}),
      kvL:     sb.get({b:true, color:C.blue, fill:C.blueL, border:true, h:"left", indent:1}),
      note:    sb.get({i:true, sz:9, color:C.gray, h:"left", wrap:true}),
      noteB:   sb.get({i:true, b:true, sz:9, color:C.red, h:"left", wrap:true}),
      empty:   sb.get({i:true, color:C.gray, h:"center", border:true}),
    };
    const cellStyle = (type, zebra, extra) => sb.get({...(TYPE[type]||TYPE.text), border:true, ...(zebra?{fill:C.grayL}:{}), ...(extra||{})});
    const totStyle  = (type) => sb.get({...(TYPE[type]||TYPE.text), b:true, border:C.yellow, fill:C.yellowL, color: (type==="money"||type==="moneyB") ? C.green : C.text});

    function addSheet(name, opt={}) {
      const sh = Sheet(name); sh.tabColor = opt.tab || C.blue2; sheets.push(sh);
      sh.cols = opt.cols || [];
      const nc = Math.max(sh.cols.length, 2);
      sh.set(0, 0, opt.title || name, S.title); for (let c=1;c<nc;c++) sh.set(0,c,"",S.title);
      sh.height(0, 32);
      sh.merges.push(`A1:${ref(0, nc-1)}`);
      sh.set(1, 0, "KOHNAN Parc Mall  ·  " + (opt.subtitle || ""), S.sub); for (let c=1;c<nc;c++) sh.set(1,c,"",S.sub);
      const tw = sh.cols.slice(0, nc).reduce((a,b)=>a+(b||10),0) * 1.25;
      sh.height(1, Math.max(20, Math.ceil(("KOHNAN Parc Mall  ·  " + (opt.subtitle||"")).length / tw) * 12 + 8));
      sh.merges.push(`A2:${ref(1, nc-1)}`);
      sh.r = 3;
      sh.landscape = opt.landscape !== false;
      return sh;
    }
    function section(sh, text) {
      const nc = Math.max(sh.cols.length, 2);
      sh.set(sh.r, 0, text, S.section); for (let c=1;c<nc;c++) sh.set(sh.r, c, "", S.sectionF);
      sh.height(sh.r, 22); sh.r++;
    }
    function table(sh, columns, rows, o={}) {
      const hr = sh.r, c0 = o.col0 || 0;
      columns.forEach((col, c) => sh.set(hr, c0+c, col.h, S.head));
      sh.height(hr, o.headH || 32); sh.r++;
      if (!rows.length) {
        sh.set(sh.r, c0, o.emptyText || "Không có dữ liệu", S.empty);
        for (let c=1;c<columns.length;c++) sh.set(sh.r, c0+c, "", S.empty);
        sh.merges.push(`${ref(sh.r,c0)}:${ref(sh.r,c0+columns.length-1)}`); sh.r++;
      }
      rows.forEach((row, i) => {
        const z = o.zebra !== false && i % 2 === 1;
        row.forEach((v, c) => sh.set(sh.r, c0+c, v, cellStyle(columns[c].t, z, columns[c].x)));
        let lines = 1;
        row.forEach((v, c) => { if ((columns[c].t === "wrap" || (columns[c].x && columns[c].x.wrap)) && v) { const w = (sh.cols[c0+c] || 20) * 1.15; lines = Math.max(lines, String(v).split("\n").reduce((n, seg) => n + Math.max(1, Math.ceil(seg.length / w)), 0)); } });
        if (o.rowH || lines > 1) sh.height(sh.r, Math.max(o.rowH || 18, lines * 13.5 + 5));
        sh.r++;
      });
      if (o.total) { o.total.forEach((v, c) => sh.set(sh.r, c0+c, v, totStyle(columns[c].t === "stt" ? "textB" : columns[c].t))); sh.height(sh.r, 22); sh.r++; }
      if (o.main) {
        sh.freeze = {r: hr+1, c: o.freezeCol||0};
        sh.printTitle = hr+1;
        if (rows.length) sh.filter = `${ref(hr,c0)}:${ref(hr+rows.length, c0+columns.length-1)}`;
      }
      sh.r++;
      return hr;
    }
    function kv(sh, items, o={}) {
      const per = o.pairs || 1, span = o.span || 1;
      for (let i=0; i<items.length; i+=per) {
        let rowLines = 1;
        for (let p=0; p<per; p++) {
          const it = items[i+p]; const c = p*(1+span) + (o.col0||0);
          if (!it) continue;
          sh.set(sh.r, c, it[0], S.kvL);
          sh.set(sh.r, c+1, it[1], cellStyle(it[2]||"textB", false, {b:true, wrap:true, ...(it[3]||{})}));
          const vw = sh.cols.slice(c+1, c+1+span).reduce((a,b)=>a+(b||10),0) * 1.05;
          if (typeof it[1] === "string") rowLines = Math.max(rowLines, Math.ceil(it[1].length / vw));
          for (let k=2;k<=span;k++) sh.set(sh.r, c+k, "", cellStyle("text"));
          if (span>1) sh.merges.push(`${ref(sh.r,c+1)}:${ref(sh.r,c+span)}`);
        }
        sh.height(sh.r, Math.max(20, rowLines * 13.5 + 5)); sh.r++;
      }
      sh.r++;
    }
    function note(sh, text, red) {
      const nc = Math.max(sh.cols.length, 2);
      sh.set(sh.r, 0, text, red ? S.noteB : S.note); sh.merges.push(`${ref(sh.r,0)}:${ref(sh.r,nc-1)}`);
      const w = sh.cols.slice(0, nc).reduce((a,b)=>a+(b||10),0) * 1.2;
      sh.height(sh.r, Math.max(16, Math.ceil(String(text).length / w) * 12 + 4)); sh.r++;
    }
    function save(filename) {
      const blob = build(sheets, sb);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return blob;
    }
    return { addSheet, section, table, kv, note, save, sheets, blob: () => build(sheets, sb) };
  }
  return { Book, C };
})();
