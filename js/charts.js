/* نمودارهای SVG سبک و آفلاین با tooltip */
'use strict';
LD.chart = (() => {
  const h = LD.h;
  const NS = 'http://www.w3.org/2000/svg';
  const S = (i) => 'var(--s' + ((i % 8) + 1) + ')';
  const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };

  /* tooltip مشترک */
  let tip;
  const showTip = (ev, html) => {
    if (!tip) { tip = h('div.chart-tip'); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    const x = ev.clientX, y = ev.clientY, w = tip.offsetWidth;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px';
    tip.style.top = (y - tip.offsetHeight - 14 < 0 ? y + 18 : y - tip.offsetHeight - 14) + 'px';
  };
  const hideTip = () => { if (tip) tip.style.display = 'none'; };
  document.addEventListener('scroll', hideTip, true);
  const bindTip = (node, html) => {
    node.addEventListener('pointermove', (e) => showTip(e, html));
    node.addEventListener('pointerdown', (e) => showTip(e, html));
    node.addEventListener('pointerleave', hideTip);
  };

  const legend = (series) => series.length < 2 ? null : h('div.legend', series.map((s, i) => h('span', h('i', { style: { background: s.color || S(i) } }), s.name)));
  const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  /* فاصله برچسب‌های محور افقی تا روی هم نیفتند */
  const labelStep = (labels, width) => { const maxLen = Math.max(1, ...labels.map((l) => String(l).length)); return Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(width / (maxLen * 6.5 + 10))))); };
  const mk = (W, H) => svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  const yAxis = (svg, { x0, x1, y, max, min, ticks = 4, W }) => {
    for (let i = 0; i <= ticks; i++) {
      const v = min + (max - min) * i / ticks, yy = y(v);
      svg.appendChild(svgEl('line', { x1: x0, x2: x1, y1: yy, y2: yy, class: v === 0 ? 'axis' : 'grid' }));
      svg.appendChild(svgEl('text', { x: x0 - 6, y: yy + 4, 'text-anchor': 'end', class: 'tick' }, LD.money(v, true)));
    }
  };

  /* میله‌ای گروهی (پشتیبانی از مقدار منفی) */
  function bars(el, { labels, series, height = 240 }) {
    el.innerHTML = '';
    const W = Math.max(320, el.clientWidth || 640), H = height, L = 64, R = 12, T = 10, B = 28;
    const all = series.flatMap((s) => s.values);
    const max = niceMax(Math.max(0, ...all)), min = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    const svg = mk(W, H);
    yAxis(svg, { x0: L, x1: W - R, y, max, min, W });
    const gw = (W - L - R) / labels.length, bw = Math.max(3, Math.min(28, (gw - 8) / series.length - 2));
    const step = labelStep(labels, W - L - R);
    labels.forEach((lab, i) => {
      const gx = L + gw * i + (gw - (bw + 2) * series.length) / 2;
      series.forEach((s, j) => {
        const v = s.values[i] || 0, y0 = y(0), y1 = y(v);
        const r = svgEl('rect', { x: gx + j * (bw + 2), y: Math.min(y0, y1), width: bw, height: Math.max(1, Math.abs(y1 - y0)), rx: Math.min(4, bw / 2), fill: s.color || S(j), class: 'mark' });
        bindTip(r, `<b>${LD.esc(lab)}</b><br>${LD.esc(s.name)}: ${LD.money(v)} تومان`);
        svg.appendChild(r);
      });
      if ((labels.length - 1 - i) % step === 0) svg.appendChild(svgEl('text', { x: L + gw * i + gw / 2, y: H - 8, 'text-anchor': 'middle', class: 'tick' }, lab));
    });
    el.append(legend(series) || '', h('div.chart-wrap', svg));
  }

  /* خطی با crosshair */
  function line(el, { labels, series, height = 240 }) {
    el.innerHTML = '';
    const W = Math.max(320, el.clientWidth || 640), H = height, L = 64, R = 12, T = 10, B = 28;
    const all = series.flatMap((s) => s.values);
    const max = niceMax(Math.max(0, ...all)), min = Math.min(0, ...all) < 0 ? -niceMax(-Math.min(...all)) : 0;
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    const x = (i) => L + (labels.length < 2 ? (W - L - R) / 2 : (W - L - R) * i / (labels.length - 1));
    const svg = mk(W, H);
    yAxis(svg, { x0: L, x1: W - R, y, max, min, W });
    series.forEach((s, j) => {
      svg.appendChild(svgEl('polyline', { points: s.values.map((v, i) => x(i) + ',' + y(v || 0)).join(' '), fill: 'none', stroke: s.color || S(j), 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    });
    const step = labelStep(labels, W - L - R);
    labels.forEach((lab, i) => { if ((labels.length - 1 - i) % step === 0) svg.appendChild(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, lab)); });
    const cross = svgEl('line', { y1: T, y2: H - B, class: 'cross', style: 'display:none' }); svg.appendChild(cross);
    const dots = series.map((s, j) => { const c = svgEl('circle', { r: 4, fill: s.color || S(j), class: 'dot', style: 'display:none' }); svg.appendChild(c); return c; });
    const hit = svgEl('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }); svg.appendChild(hit);
    const move = (e) => {
      const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
      const lp = p.matrixTransform(svg.getScreenCTM().inverse());
      const i = Math.max(0, Math.min(labels.length - 1, Math.round((lp.x - L) / ((W - L - R) / Math.max(1, labels.length - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
      dots.forEach((d, j) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[j].values[i] || 0)); d.style.display = ''; });
      showTip(e, `<b>${LD.esc(labels[i])}</b>` + series.map((s, j) => `<br><i style="background:${s.color || S(j)}"></i>${LD.esc(s.name)}: ${LD.money(s.values[i] || 0)}`).join(''));
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hideTip(); cross.style.display = 'none'; dots.forEach((d) => (d.style.display = 'none')); });
    el.append(legend(series) || '', h('div.chart-wrap', svg));
  }

  /* میله افقی برای تفکیک دسته‌ها (خواناتر از دونات برای تعداد زیاد) */
  function hbars(el, { items, color, max: maxN = 10 }) {
    el.innerHTML = '';
    let list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    if (list.length > maxN) { const rest = list.slice(maxN - 1); list = list.slice(0, maxN - 1).concat([{ label: 'سایر', value: LD.sum(rest, (x) => x.value) }]); }
    const total = LD.sum(list, (x) => x.value), max = list[0] ? list[0].value : 1;
    if (!list.length) { el.append(h('p.muted', 'داده‌ای برای نمایش نیست')); return; }
    el.append(h('div.hbars', list.map((x) => {
      const row = h('div.hbar-row', h('span.hbar-label', x.label), h('span.hbar-track', h('span.hbar-fill', { style: { width: (x.value / max * 100) + '%', background: x.color || color || S(0) } })), h('span.hbar-val', LD.money(x.value, true), h('small', ' ' + LD.pct(x.value / total))));
      bindTip(row, `<b>${LD.esc(x.label)}</b><br>${LD.money(x.value)} تومان — ${LD.pct(x.value / total)}`);
      return row;
    })));
  }

  /* دونات برای سهم (حداکثر ۶ برش + سایر) */
  function donut(el, { items, center, size = 200 }) {
    el.innerHTML = '';
    let list = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    if (list.length > 6) { const rest = list.slice(5); list = list.slice(0, 5).concat([{ label: 'سایر', value: LD.sum(rest, (x) => x.value), color: 'var(--muted)' }]); }
    const total = LD.sum(list, (x) => x.value);
    const svg = mk(size, size), R = size / 2 - 4, r = R * 0.62, cx = size / 2, cy = size / 2;
    if (!total) { el.append(h('p.muted', 'داده‌ای برای نمایش نیست')); return; }
    let a0 = -Math.PI / 2;
    list.forEach((x, i) => {
      const a1 = a0 + (x.value / total) * Math.PI * 2 - (list.length > 1 ? 0.02 : 0);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad, a) => (cx + rad * Math.cos(a)) + ' ' + (cy + rad * Math.sin(a));
      const d = list.length === 1 ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy} M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`
        : `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
      const path = svgEl('path', { d, fill: x.color || S(i), 'fill-rule': 'evenodd', class: 'mark' });
      bindTip(path, `<b>${LD.esc(x.label)}</b><br>${LD.money(x.value)} تومان — ${LD.pct(x.value / total)}`);
      svg.appendChild(path);
      a0 = a1 + (list.length > 1 ? 0.02 : 0);
    });
    if (center) { svg.appendChild(svgEl('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', class: 'donut-c' }, center)); }
    el.append(h('div.donut', h('div.donut-svg', svg), h('div.legend.col', list.map((x, i) => h('span', h('i', { style: { background: x.color || S(i) } }), x.label, h('b', ' ' + LD.pct(x.value / total)))))));
  }

  /* حبابی/پراکندگی: points [{x,y,r,label,color,tip}] */
  function bubble(el, opts) {
    const { points, xLabel, yLabel, height = 300, xFmt = (v) => LD.money(v, true), yFmt = (v) => LD.pct(v), xDomain, yDomain, quadrants } = opts;
    el.innerHTML = '';
    const W = Math.max(320, el.clientWidth || 640), H = height, L = 64, R = 20, T = 16, B = 40;
    if (!points.length) { el.append(h('p.muted', 'داده‌ای برای نمایش نیست')); return; }
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const [x0, x1] = xDomain || [0, niceMax(Math.max(...xs) * 1.1)];
    const [y0, y1] = yDomain || [Math.min(0, Math.min(...ys) * 1.2), Math.max(0.1, Math.max(...ys) * 1.2)];
    const X = (v) => L + (W - L - R) * (v - x0) / (x1 - x0 || 1), Y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1));
    const svg = mk(W, H);
    if (quadrants) {
      const mx = X((x0 + x1) / 2), my = Y((y0 + y1) / 2);
      quadrants.forEach((q, i) => {
        const qx = i % 2 === 0 ? L : mx, qy = i < 2 ? T : my;
        svg.appendChild(svgEl('rect', { x: qx, y: qy, width: i % 2 === 0 ? mx - L : W - R - mx, height: i < 2 ? my - T : H - B - my, class: 'quad' + (q.hi ? ' hi' : '') }));
        svg.appendChild(svgEl('text', { x: qx + 6, y: qy + 14, class: 'quad-label' }, q.label));
      });
    }
    const yT = opts.yTicks || [0, 1, 2, 3, 4].map((i) => y0 + (y1 - y0) * i / 4);
    const xT = opts.xTicks || [0, 1, 2, 3, 4].map((i) => x0 + (x1 - x0) * i / 4);
    yT.forEach((v) => {
      svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: Math.abs(v) < 1e-9 ? 'axis' : 'grid' }));
      svg.appendChild(svgEl('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, yFmt(v)));
    });
    xT.forEach((xv) => svg.appendChild(svgEl('text', { x: X(xv), y: H - B + 16, 'text-anchor': 'middle', class: 'tick' }, xFmt(xv))));
    svg.appendChild(svgEl('text', { x: (W + L) / 2, y: H - 4, 'text-anchor': 'middle', class: 'axis-label' }, xLabel || ''));
    svg.appendChild(svgEl('text', { x: 12, y: (H - B + T) / 2, 'text-anchor': 'middle', class: 'axis-label', transform: `rotate(-90 12 ${(H - B + T) / 2})` }, yLabel || ''));
    const rMax = Math.max(1, ...points.map((p) => Math.abs(p.r || 1)));
    [...points].sort((a, b) => Math.abs(b.r || 1) - Math.abs(a.r || 1)).forEach((p, i) => {
      const rad = p.fixedR || 8 + 22 * Math.sqrt(Math.abs(p.r || 1) / rMax);
      const c = svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: rad, fill: p.color || S(i), class: 'bubble' });
      if (p.onclick) { c.style.cursor = 'pointer'; c.addEventListener('click', p.onclick); }
      bindTip(c, p.tip || LD.esc(p.label)); svg.appendChild(c);
      svg.appendChild(svgEl('text', { x: X(p.x), y: Y(p.y) - rad - 4, 'text-anchor': 'middle', class: 'bubble-label' }, p.label.length > 18 ? p.label.slice(0, 17) + '…' : p.label));
    });
    el.append(h('div.chart-wrap', svg));
  }

  /* اسپارک‌لاین به صورت SVG */
  function spark(values, color = S(0), w = 120, hgt = 28) {
    const svg = mk(w, hgt); svg.classList.add('spark');
    if (!values.length) return svg;
    const max = Math.max(...values), min = Math.min(0, ...values), rng = max - min || 1;
    const pts = values.map((v, i) => (values.length < 2 ? w / 2 : i * (w - 4) / (values.length - 1) + 2) + ',' + (hgt - 3 - (v - min) / rng * (hgt - 6)));
    if (min < 0) { const zy = hgt - 3 - (0 - min) / rng * (hgt - 6); svg.appendChild(svgEl('line', { x1: 0, x2: w, y1: zy, y2: zy, class: 'grid' })); }
    svg.appendChild(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    return svg;
  }

  /* گانت ساده: rows [{label, start, end, milestones:[{date,title,done}]}] */
  function gantt(el, { rows }) {
    el.innerHTML = '';
    const dates = rows.flatMap((r) => [r.start, r.end, ...(r.milestones || []).map((m) => m.date)]).filter(Boolean).sort();
    if (!dates.length) { el.append(h('p.muted', 'برای نمایش تایم‌لاین، تاریخ شروع/پایان یا مراحل را وارد کنید')); return; }
    const d0 = dates[0], d1 = dates[dates.length - 1] > d0 ? dates[dates.length - 1] : LD.addDays(d0, 30);
    const span = LD.daysBetween(d0, d1) || 1, W = Math.max(360, el.clientWidth || 640), L = 120, R = 16, rowH = 34, T = 24;
    const H = T + rows.length * rowH + 8, X = (d) => L + (W - L - R) * LD.daysBetween(d0, d) / span;
    const svg = mk(W, H);
    const months = []; let m = LD.J.toISO(LD.J.toJalali(d0).jy, LD.J.toJalali(d0).jm, 1);
    while (m <= d1) { if (m >= d0) months.push(m); m = LD.J.addMonths(m, 1); }
    const step = Math.ceil(months.length / 8);
    months.forEach((mm, i) => { svg.appendChild(svgEl('line', { x1: X(mm), x2: X(mm), y1: T - 4, y2: H, class: 'grid' })); if (i % step === 0) svg.appendChild(svgEl('text', { x: X(mm) + 3, y: 14, class: 'tick' }, LD.J.monthLabel(LD.J.monthKey(mm)))); });
    const today = LD.todayISO();
    if (today >= d0 && today <= d1) svg.appendChild(svgEl('line', { x1: X(today), x2: X(today), y1: T - 6, y2: H, class: 'today' }));
    rows.forEach((r, i) => {
      const yy = T + i * rowH;
      svg.appendChild(svgEl('text', { x: L - 8, y: yy + rowH / 2 + 4, 'text-anchor': 'end', class: 'tick strong' }, r.label.length > 16 ? r.label.slice(0, 15) + '…' : r.label));
      if (r.start) {
        const e = r.end || today, bar = svgEl('rect', { x: X(r.start), y: yy + 9, width: Math.max(4, X(e) - X(r.start)), height: rowH - 18, rx: 4, fill: r.color || S(i), opacity: 0.35 });
        bindTip(bar, `<b>${LD.esc(r.label)}</b><br>${LD.J.fmt(r.start)} تا ${r.end ? LD.J.fmt(r.end) : 'اکنون'}`); svg.appendChild(bar);
        if (r.progress) svg.appendChild(svgEl('rect', { x: X(r.start), y: yy + 9, width: Math.max(2, (X(e) - X(r.start)) * r.progress), height: rowH - 18, rx: 4, fill: r.color || S(i) }));
      }
      (r.milestones || []).filter((mm) => mm.date).forEach((mm) => {
        const cx = X(mm.date), cy = yy + rowH / 2;
        const dm = svgEl('path', { d: `M ${cx} ${cy - 7} L ${cx + 7} ${cy} L ${cx} ${cy + 7} L ${cx - 7} ${cy} Z`, class: 'milestone' + (mm.done ? ' done' : '') });
        bindTip(dm, `<b>${LD.esc(mm.title)}</b><br>${LD.J.fmt(mm.date)} — ${mm.done ? 'انجام شد ✓' : 'در انتظار'}`); svg.appendChild(dm);
      });
    });
    el.append(h('div.chart-wrap', svg));
  }

  return { bars, line, hbars, donut, bubble, spark, gantt, S, showTip, hideTip };
})();
