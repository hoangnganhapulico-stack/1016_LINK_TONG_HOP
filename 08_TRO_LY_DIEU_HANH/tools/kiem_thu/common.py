import re, os
BASE = 'http://127.0.0.1:8765/'
ST = '/home/claude/testenv/stubs/'
def route(ctx, fake_date=None):
    def h(r):
        u = r.request.url
        if u.startswith('http://127.0.0.1') or u.startswith('file://'): return r.continue_()
        if 'xlsx' in u: return r.fulfill(path=ST + 'xlsx-shim.js', content_type='application/javascript')
        if 'chartjs-plugin' in u or 'chart.js' in u or 'chart.umd' in u: return r.fulfill(path=ST + 'chart-stub.js', content_type='application/javascript')
        if 'tailwind' in u: return r.fulfill(body='/*tw stub*/', content_type='application/javascript')
        return r.abort()
    ctx.route(re.compile(r'.*'), h)
    if fake_date:  # cố định "hôm nay" = 26/10/2026 15:00 giờ VN để kết quả lặp lại được
        ctx.add_init_script("""(()=>{const F=new Date('%s').getTime(), D=Date, off=F-D.now();
          class FD extends D{constructor(...a){ if(a.length) super(...a); else super(D.now()+off);} static now(){return D.now()+off;}}
          window.Date=FD;})();""" % fake_date)
def errs(page):
    out = []
    page.on('pageerror', lambda e: out.append('PAGEERROR ' + str(e)))
    page.on('console', lambda m: out.append('CONSOLE ' + m.text) if m.type == 'error' else None)
    return out
