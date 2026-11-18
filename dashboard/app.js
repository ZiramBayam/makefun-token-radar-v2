/* Survey Chart — behaviour. Reads window.RADAR from data.js; no fetching. */

(function () {
  var R = window.RADAR || { meta: {}, rows: [], live: [], categories: [] };
  var rowsEl = document.getElementById('rows');
  var emptyEl = document.getElementById('empty');
  var countEl = document.getElementById('count');
  var countLabel = document.getElementById('countLabel');
  var resultEl = document.getElementById('resultCount');
  var asofEl = document.getElementById('asof');
  var qEl = document.getElementById('q');
  var catEl = document.getElementById('category');
  var drawer = document.getElementById('drawer');
  var titleEl = document.getElementById('cardTitle');
  var subEl = document.getElementById('cardSub');
  var bodyEl = document.getElementById('cardBody');

  var mode = 'pre';
  var sortKey = 'rank';
  var sortDir = 1;
  var query = '';
  var category = 'all';
  var closeTimer = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function group(s) {
    return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function usd(n) { return '$' + group(n); }
  function compact(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M';
    return '$' + group(n);
  }
  function pct(n) {
    if (n == null) return '—';
    return (n > 0 ? '+' : '') + Number(n).toFixed(1) + '%';
  }
  function tenure(days) {
    if (days == null) return '—';
    if (days < 60) return days + 'd';
    if (days < 730) return (days / 30).toFixed(1) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }

  asofEl.textContent = R.meta.as_of || '—';
  asofEl.setAttribute('datetime', R.meta.as_of || '');
  for (var i = 0; i < R.categories.length; i++) {
    var opt = document.createElement('option');
    opt.value = R.categories[i];
    opt.textContent = R.categories[i];
    catEl.appendChild(opt);
  }

  function source() { return mode === 'pre' ? R.rows : R.live; }

  function matches(r) {
    if (category !== 'all' && r.category !== category) return false;
    if (!query) return true;
    var hay = [r.name, r.category].concat(r.chains || []).join(' ').toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function compare(a, b) {
    var x = a[sortKey], y = b[sortKey];
    if (sortKey === 'name' || sortKey === 'category') {
      x = String(x || ''); y = String(y || '');
      return sortDir * x.localeCompare(y);
    }
    x = x == null ? -Infinity : x;
    y = y == null ? -Infinity : y;
    return sortDir * (x - y);
  }

  var MODE_HINT = {
    lend: 'supply & borrow', lp: 'provide liquidity', bridge: 'bridge a test sum',
    stake: 'stake an epoch', govern: 'delegate & post', points: 'test tx & refer',
    security: 'audit & revoke', rwa: 'exposure & verify', generic: 'open a position',
  };
  function hintFor(r) {
    if (mode !== 'pre') return 'token records — not ranked';
    var chain = (r.chains && r.chains[0]) || 'Ethereum';
    return (MODE_HINT[r.mode] || 'open a position') + ' · $250-500 · ' + chain;
  }
  function chainLine(r) {
    var cs = r.chains || [];
    if (cs.length <= 3) return cs.join(', ');
    return cs.slice(0, 3).join(', ') + ' +' + (cs.length - 3) + ' more';
  }

  function render() {
    var list = source().filter(matches).sort(compare);
    var liveMode = mode === 'live';
    countEl.textContent = group(liveMode ? R.live.length : R.rows.length);
    countLabel.textContent = liveMode ? 'protocols recording a token' : 'soundings charted';
    resultEl.textContent = list.length + ' of ' + source().length + ' readings';

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var cls = [];
      if (!liveMode && r.rank === 1) cls.push('shoal');
      if (r.watchlisted) cls.push('watchlisted');
      var chg = r.change_7d == null ? '' : (r.change_7d >= 0 ? ' up' : ' down');
      html += '<tr data-slug="' + esc(r.slug) + '" tabindex="0" role="button"'
        + (cls.length ? ' class="' + cls.join(' ') + '"' : '')
        + ' aria-label="Open survey card for ' + esc(r.name) + '">';
      html += '<td class="rank num">' + (liveMode ? '—' : String(r.rank).padStart(2, '0')) + '</td>';
      html += '<td class="protocol">' + esc(r.name) + '</td>';
      html += '<td class="cat">' + esc(r.category) + '</td>';
      html += '<td class="num">' + compact(r.tvl_usd) + '</td>';
      html += '<td class="num change' + chg + '">' + pct(r.change_7d) + '</td>';
      html += '<td class="num">' + (liveMode ? '—' : tenure(r.age_days)) + '</td>';
      html += '<td class="num depth-val">' + (liveMode ? 'trading' : usd(r.implied_value_usd)) + '</td>';
      html += '<td class="hint">' + esc(hintFor(r)) + '</td>';
      html += '</tr>';
    }
    rowsEl.innerHTML = html;
    emptyEl.hidden = list.length !== 0;

    var ths = document.querySelectorAll('.depth thead th[data-sort]');
    for (var j = 0; j < ths.length; j++) {
      var th = ths[j];
      var active = th.getAttribute('data-sort') === sortKey;
      th.className = active ? 'num sorted' : (th.classList.contains('num') ? 'num' : '');
      if (active) th.className += ' sorted';
      th.innerHTML = esc(th.textContent.replace(/\s*[▲▼]$/, '')) +
        (active ? ' <span class="arrow">' + (sortDir === 1 ? '▲' : '▼') + '</span>' : '');
    }
  }

  function inputRow(label, value) {
    return '<tr><td>' + esc(label) + '</td><td>' + esc(value) + '</td></tr>';
  }

  function openCard(r) {
    var liveMode = mode === 'live';
    titleEl.textContent = r.name;
    subEl.textContent = liveMode
      ? 'Records a token · ' + r.category + ' · ' + chainLine(r)
      : 'Sounding ' + String(r.rank).padStart(2, '0') + ' of ' + R.rows.length +
        ' · ' + r.category + ' · ' + chainLine(r) +
        (r.watchlisted ? ' · watchlist' : '');

    var f = r.factors || {};
    var html = '';
    html += '<h3>Model inputs</h3><table class="inputs">';
    html += inputRow('Recorded TVL', usd(r.tvl_usd));
    html += inputRow('7d TVL change', pct(r.change_7d));
    html += inputRow('First listed', r.listed_at || 'not recorded');
    if (!liveMode) {
      html += inputRow('Tenure, days', f.age_days + ' (of 1460 cap)');
      html += inputRow('Peer group', f.peer_group || r.category);
      html += inputRow('Category percentile', f.peer_percentile);
      html += inputRow('Chains counted', f.chain_count + ' (of 8 cap)');
      html += inputRow('TVL exponent', '0.86');
    }
    html += '</table>';

    if (!liveMode) {
      html += '<h3>Arithmetic, with inputs substituted</h3>';
      html += '<div class="arithmetic">'
        + 'growth = 1 + clamp(' + pct(f.change_7d) + ', -60, 120)/100 × 0.6 = ' + f.growth.toFixed(3) + '<br>'
        + 'tenure = 0.55 + min(' + f.age_days + ', 1460)/1460 × 0.45 = ' + f.tenure.toFixed(3) + '<br>'
        + 'peer = 0.8 + 0.4 × ' + f.peer_percentile.toFixed(3) + ' = ' + f.peer.toFixed(3) + '<br>'
        + 'breadth = 1 + 0.03 × min(' + f.chain_count + ', 8) = ' + f.breadth.toFixed(3) + '<br>'
        + esc(r.formula)
        + '</div>';
      html += '<div class="reading">' + usd(r.implied_value_usd) + ' implied depth</div>';

      html += '<h3>Farm route · ' + r.farm_steps.length + ' steps</h3><ol class="plan">';
      for (var i = 0; i < r.farm_steps.length; i++) {
        html += '<li>' + esc(r.farm_steps[i]) + '</li>';
      }
      html += '</ol>';
      html += '<p class="card-note">A sounding is this entry’s own reading of the sealed record. '
        + 'No token, date or reward is promised; keep each receipt named above.</p>';
    } else {
      html += '<h3>Why this one is not ranked</h3>';
      html += '<p class="card-note">This protocol records a market cap, a CoinGecko id and a '
        + 'symbol in the snapshot. It is charted beside the board so a reader can compare it, '
        + 'but the radar only ranks protocols that record no token.</p>';
    }
    bodyEl.innerHTML = html;
  }

  function showDrawer(r) {
    openCard(r);
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    drawer.hidden = false;
    drawer.classList.remove('closed');
    var close = drawer.querySelector('.close');
    if (close) close.focus();
  }
  function hideDrawer() {
    drawer.classList.add('closed');
    closeTimer = setTimeout(function () {
      drawer.hidden = true;
      closeTimer = null;
    }, 220);
  }

  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    var r = source().find(function (x) { return x.slug === tr.getAttribute('data-slug'); });
    if (r) showDrawer(r);
  });
  rowsEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    e.preventDefault();
    var r = source().find(function (x) { return x.slug === tr.getAttribute('data-slug'); });
    if (r) showDrawer(r);
  });

  qEl.addEventListener('input', function () {
    query = qEl.value.trim().toLowerCase();
    if (!drawer.hidden) hideDrawer();
    render();
  });
  catEl.addEventListener('change', function () {
    category = catEl.value;
    if (!drawer.hidden) hideDrawer();
    render();
  });

  var toggles = document.querySelectorAll('.toggle button');
  for (var t = 0; t < toggles.length; t++) {
    toggles[t].addEventListener('click', function () {
      mode = this.getAttribute('data-mode');
      if (!drawer.hidden) hideDrawer();
      for (var k = 0; k < toggles.length; k++) {
        var on = toggles[k] === this;
        toggles[k].classList.toggle('active', on);
        toggles[k].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      if (mode === 'live') { sortKey = 'tvl_usd'; sortDir = -1; }
      else { sortKey = 'rank'; sortDir = 1; }
      category = 'all'; catEl.value = 'all';
      render();
    });
  }

  var ths = document.querySelectorAll('.depth thead th[data-sort]');
  for (var h = 0; h < ths.length; h++) {
    ths[h].addEventListener('click', function () {
      var key = this.getAttribute('data-sort');
      if (key === sortKey) sortDir = -sortDir;
      else sortDir = (key === 'name' || key === 'category') ? 1 : -1;
      sortKey = key;
      render();
    });
  }

  var closers = drawer.querySelectorAll('[data-close]');
  for (var c = 0; c < closers.length; c++) closers[c].addEventListener('click', hideDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hidden) hideDrawer();
  });

  render();
})();
