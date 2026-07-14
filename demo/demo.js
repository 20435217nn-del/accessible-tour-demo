(function () {
  'use strict';

  const app = document.getElementById('app');
  const data = window.ZERO_MILE_DATA;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer = null;
  let actionTimer = null;
  let sheetTimer = null;
  let sheetReturnSelector = null;

  const state = {
    currentView: 'map',
    activeFilter: 'guide',
    selectedPointId: null,
    bottomSheet: 'none',
    locationEnabled: false,
    toastMsg: null,
    isVoiceNavActive: false,
    mediaMode: 'video',
    isPlaying: false,
    pendingAction: null
  };

  const pendingLabels = {
    listen: '正在查找',
    locate: '定位中',
    'nearby-facilities': '正在查找',
    'start-nav': '正在启动'
  };

  const iconNodes = {
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
    pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    accessibility: '<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    check: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    corner: '<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>'
  };

  function icon(name, className) {
    return '<svg class="icon ' + (className || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconNodes[name] + '</svg>';
  }

  function deviceOverlay() {
    return '<div class="device-overlay" aria-hidden="true">' +
      '<div class="status-time">9:41</div><div class="dynamic-island"></div>' +
      '<div class="status-icons"><span class="cell-bars"><i></i><i></i><i></i><i></i></span>' +
      '<svg class="wifi" viewBox="0 0 16 12"><path d="M8 1.5C4.5 1.5 1.5 3.5 0 6L8 12L16 6C14.5 3.5 11.5 1.5 8 1.5Z" fill="currentColor"/></svg>' +
      '<span class="battery"><i></i></span></div><div class="home-indicator"></div></div>';
  }

  function button(label, action, variant, extra, iconName) {
    const busy = state.pendingAction === action;
    return '<button type="button" class="btn btn-' + (variant || 'primary') + ' ' + (extra || '') + (busy ? ' is-busy' : '') + '" data-action="' + action + '"' +
      (busy ? ' aria-busy="true" aria-disabled="true"' : '') + '>' +
      (busy ? '<span class="busy-spinner" aria-hidden="true"></span>' : (iconName ? icon(iconName, 'btn-icon') : '')) +
      '<span>' + (busy ? pendingLabels[action] : label) + '</span></button>';
  }

  function motionClass(motion) {
    return motion ? ' motion-' + motion : '';
  }

  function selectedPoint() {
    return data.allPoints.find(function (point) { return point.id === state.selectedPointId; }) || null;
  }

  function activePoints() {
    const points = data.allPoints.filter(function (point) {
      if (state.activeFilter === 'guide') return point.type === 'guide';
      if (state.activeFilter === 'service') return point.type === 'service' || point.type === 'wc';
      return point.type === 'wc' || point.type === 'ramp';
    });
    const point = selectedPoint();
    const showRecommendedFacility = state.bottomSheet === 'nearest-facility' || state.isVoiceNavActive;
    if (showRecommendedFacility && point && point.type !== 'guide' && !points.some(function (item) { return item.id === point.id; })) {
      points.push(point);
    }
    return points;
  }

  function markerName(point) {
    if (point.type === 'guide') return '居民讲解点';
    if (point.type === 'wc') return '无障碍卫生间';
    if (point.type === 'ramp') return '可提供坡板';
    return '便民服务';
  }

  function legend() {
    if (state.activeFilter === 'guide') {
      return '<div class="legend-row"><img src="assets/figma-make/___1.png" alt=""><span>居民讲解点</span></div>';
    }
    if (state.activeFilter === 'service') {
      return '<div class="legend-stack"><div class="legend-row"><span class="legend-symbol legend-service">服</span><span>便民服务</span></div>' +
        '<div class="legend-row"><span class="legend-symbol legend-wc">WC</span><span>无障碍卫生间</span></div>' +
        '<p>* 行李寄存位置确认中</p></div>';
    }
    return '<div class="legend-stack"><div class="legend-row"><span class="legend-symbol legend-ramp">坡</span><span>可提供坡板</span></div>' +
      '<div class="legend-row"><span class="legend-symbol legend-wc">WC</span><span>无障碍卫生间</span></div></div>';
  }

  function markers() {
    return activePoints().map(function (point, index) {
      const selected = state.selectedPointId === point.id;
      let symbol = '';
      if (point.type === 'guide') {
        symbol = '<img src="' + point.icon + '" alt="' + point.name + '讲解员">';
      } else if (point.type === 'wc') {
        symbol = '<span class="map-symbol map-wc">WC</span>';
      } else if (point.type === 'ramp') {
        symbol = '<span class="map-symbol map-ramp">坡</span>';
      } else {
        symbol = '<span class="map-symbol map-service"><b>服</b></span>';
      }
      return '<button type="button" class="map-marker marker-' + point.type + (selected ? ' is-selected' : '') + '" style="left:' + point.x + '%;top:' + point.y + '%;--marker-index:' + index + '" data-action="point" data-id="' + point.id + '" aria-label="' + point.name + '，' + markerName(point) + '" aria-pressed="' + selected + '">' +
        symbol + (selected && !state.isVoiceNavActive ? '<span class="marker-tooltip">' + point.name + '</span>' : '') + '</button>';
    }).join('');
  }

  function filterTabs() {
    return data.filters.map(function (filter) {
      const active = state.activeFilter === filter.id;
      return '<button type="button" role="tab" aria-selected="' + active + '" class="filter-tab' + (active ? ' is-active' : '') + '" data-action="filter" data-filter="' + filter.id + '">' + filter.label + '</button>';
    }).join('');
  }

  function toast() {
    return state.toastMsg ? '<div class="toast" role="status">' + icon('info') + '<span>' + state.toastMsg + '</span></div>' : '';
  }

  function voicePath() {
    const point = selectedPoint();
    if (!state.isVoiceNavActive || !point) return '';
    return '<svg class="nav-path" aria-hidden="true"><line x1="50%" y1="85%" x2="' + point.x + '%" y2="' + point.y + '%"/></svg>';
  }

  function locationMarker() {
    return state.locationEnabled ? '<div class="location-marker" role="img" aria-label="您的当前位置"></div>' : '';
  }

  function supportPhone() {
    return String(data.supportPhone || '').trim();
  }

  function dialablePhone() {
    return supportPhone().replace(/[^\d+]/g, '');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function contactActions() {
    const phone = supportPhone();
    const dialable = dialablePhone();
    const status = phone || '联系电话待补充';
    const phoneAction = dialable
      ? '<a class="voice-contact-action" href="tel:' + dialable + '" aria-label="拨打辅助联系电话 ' + escapeHtml(phone) + '">电话联系</a>'
      : '<button type="button" class="voice-contact-action" disabled aria-label="电话联系，联系电话待补充">电话联系</button>';
    const copyAction = phone
      ? '<button type="button" class="voice-contact-action" data-action="copy-support-phone" aria-label="复制辅助联系电话 ' + escapeHtml(phone) + '">复制</button>'
      : '<button type="button" class="voice-contact-action" disabled aria-label="复制电话，联系电话待补充">复制</button>';
    return '<div class="voice-contact"><span class="voice-contact-status">' + escapeHtml(status) + '</span><div class="voice-contact-actions">' + phoneAction + copyAction + '</div></div>';
  }

  function bottomActions() {
    if (state.isVoiceNavActive) {
      return '<section class="bottom-panel voice-panel"><span class="drag-handle"></span><div class="voice-toolbar"><p class="voice-kicker">' + icon('navigation') + '语音辅助指引中</p>' + contactActions() + '</div><div class="voice-copy">' +
        '<h2>前方路口右转，沿缓坡向上</h2><p>示意指引，尚未完成现场走测</p></div><div class="button-row">' +
        button('重复本段', 'repeat-nav', 'secondary', 'flex-1') + button('结束指引', 'end-nav', 'primary', 'flex-1') + '</div></section>';
    }
    const primary = state.activeFilter === 'guide'
      ? button('听讲解', 'listen', 'primary', 'full-width', 'volume')
      : '<div class="selection-hint">请在地图上选择您需要的' + (state.activeFilter === 'service' ? '便民服务' : '无障碍服务') + '点位</div>';
    return '<section class="bottom-panel"><span class="drag-handle"></span><div class="panel-primary">' + primary + '</div><div class="button-row compact">' +
      button('当前位置', 'locate', 'secondary', 'flex-1 compact-btn', 'pin') + button('附近设施', 'nearby-facilities', 'secondary', 'flex-1 compact-btn', 'accessibility') + '</div></section>';
  }

  function sheetBackdrop() {
    return state.bottomSheet === 'none' ? '' : '<button class="sheet-backdrop" data-action="close-sheet" aria-label="关闭弹层"></button>';
  }

  function nearestSheet() {
    const open = state.bottomSheet === 'nearest-guide' || state.bottomSheet === 'next-guide';
    const kicker = state.bottomSheet === 'next-guide' ? '下一个讲解点' : '最近的讲解点';
    const guide = selectedPoint() || data.guides[0];
    return '<section class="sheet nearest-sheet' + (open ? ' is-open' : '') + '" role="dialog" aria-modal="true" aria-labelledby="nearest-title" aria-hidden="' + !open + '">' +
      '<span class="drag-handle"></span><div class="sheet-title-row"><div><p class="sheet-kicker">' + kicker + '</p><h2 id="nearest-title">' + guide.name + '</h2></div>' +
      '<button class="icon-button" data-action="close-sheet" aria-label="关闭弹层">' + icon('close') + '</button></div>' +
      '<div class="media-summary">' + icon('video') + '<strong>含字幕视频讲解 /</strong><span>3分12秒</span></div><div class="button-row">' +
      button('跳过', 'skip-guide', 'secondary', 'flex-1') + button('听讲解', 'open-recommended-guide', 'primary', 'flex-2') + '</div></section>';
  }

  function nearbyFacilitySheet() {
    const open = state.bottomSheet === 'nearest-facility';
    const selected = selectedPoint();
    const facility = selected && selected.type !== 'guide' ? selected : data.nearbyFacilities[0];
    return '<section class="sheet nearby-facility-sheet' + (open ? ' is-open' : '') + '" role="dialog" aria-modal="true" aria-labelledby="nearby-facility-title" aria-hidden="' + !open + '">' +
      '<span class="drag-handle"></span><div class="sheet-title-row"><div><p class="sheet-kicker">附近设施</p><h2 id="nearby-facility-title">' + facility.name + '</h2></div>' +
      '<button class="icon-button" data-action="close-sheet" aria-label="关闭弹层">' + icon('close') + '</button></div>' +
      '<div class="media-summary">' + icon('info') + '<strong>' + markerName(facility) + ' /</strong><span>模拟定位推荐</span></div><div class="button-row">' +
      button('跳过', 'skip-facility', 'secondary', 'flex-1') + button('前往', 'start-nav', 'primary', 'flex-2', 'navigation') + '</div></section>';
  }

  function renderMap(motion) {
    return '<div class="phone-shell map-view' + motionClass(motion) + '">' + deviceOverlay() +
      '<header class="map-header"><h1>零里说</h1><p>无障碍在线导览</p><div class="filter-tabs" role="tablist" aria-label="地图内容筛选">' + filterTabs() + '</div></header>' +
      '<main id="app-main" class="map-area" aria-label="示意地图"><img class="map-background" src="' + data.mapImage + '" alt="南头古城示意地图背景">' +
      '<aside class="map-legend" aria-label="图例">' + legend() + '</aside>' + locationMarker() + voicePath() + markers() +
      '<p class="map-disclaimer">示意地图，点位与路线待现场核验</p></main>' + bottomActions() + toast() + sheetBackdrop() + nearestSheet() + nearbyFacilitySheet() + '</div>';
  }

  function guideDetailSheet() {
    const open = state.bottomSheet === 'next-steps';
    return (open ? '<button class="sheet-backdrop" data-action="close-sheet" aria-label="关闭弹层"></button>' : '') +
      '<section class="sheet next-sheet' + (open ? ' is-open' : '') + '" role="dialog" aria-modal="true" aria-labelledby="next-steps-title" aria-hidden="' + !open + '">' +
      '<span class="drag-handle"></span><div class="next-title"><h2 id="next-steps-title">接下来去哪儿</h2><button class="icon-button" data-action="close-sheet" aria-label="关闭弹层">' + icon('close') + '</button></div>' +
      '<div class="nearby-list"><h3>附近设施</h3>' + facilityCard('s3', 'WC', '南门洗手间', '无障碍卫生间', 'square') +
      facilityCard('r5', '坡', '同源馆坡板', '可提供坡板协助', 'round') + '</div><div class="next-footer">' +
      button('前往下一个讲解点', 'next-guide', 'primary', 'full-width') + '</div></section>';
  }

  function facilityCard(id, symbol, title, sub, shape) {
    return '<button class="facility-card" data-action="open-point" data-id="' + id + '"><span class="facility-card-icon ' + shape + '">' + symbol + '</span><span class="facility-card-copy"><strong>' + title + '</strong><small>' + sub + '</small></span>' + icon('corner') + '</button>';
  }

  function renderGuideDetail(motion) {
    const point = selectedPoint();
    if (!point) return renderMap(motion);
    const mediaIcon = state.mediaMode === 'video' ? icon('video', 'media-placeholder-icon') : icon('volume', 'media-placeholder-icon');
    const mediaText = state.mediaMode === 'video' ? '真实视频待内容组替换' : '纯音频播放中';
    return '<div class="phone-shell detail-view' + motionClass(motion) + '">' + deviceOverlay() + '<header class="detail-header"><button class="icon-button back-button" data-action="back-map" aria-label="返回地图">' + icon('back') + '</button><h1>' + point.name + '</h1></header>' +
      '<main id="app-main" class="detail-scroll"><section class="media-player"><div class="media-placeholder">' + mediaIcon + '<span>' + mediaText + '</span></div><div class="media-shade"><button class="play-button" data-action="toggle-play" aria-label="' + (state.isPlaying ? '暂停' : '播放') + '">' + icon(state.isPlaying ? 'pause' : 'play') + '</button></div>' +
      '<span class="media-badge">' + (state.mediaMode === 'video' ? '含字幕' : '纯音频') + '</span><span class="media-time">' + (state.isPlaying ? '01:24' : '00:00') + ' / 03:12</span></section>' +
      '<div class="media-switch"><button class="media-option' + (state.mediaMode === 'video' ? ' is-active' : '') + '" data-action="media-video" aria-pressed="' + (state.mediaMode === 'video') + '">' + icon('video') + '视频讲解</button>' +
      '<button class="media-option' + (state.mediaMode === 'audio' ? ' is-active' : '') + '" data-action="media-audio" aria-pressed="' + (state.mediaMode === 'audio') + '">' + icon('volume') + '纯音频</button></div>' +
      '<article class="transcript"><h2>讲解文字</h2><p>欢迎来到' + point.name + '。这里是南头古城的重要节点，见证了深圳千年的历史变迁。大家现在看到的这座建筑，保留了清代的营造法式……</p>' +
      '<p class="transcript-note">(真实的讲解文字内容将在此处展示，字号保证不小于16px，达到WCAG AA对比度标准。)</p><p>穿过这道门，我们就能感受到古代城市防御体系的精妙。请注意脚下，如果有需要，左侧有无障碍坡道可以使用。</p></article></main>' +
      '<footer class="detail-cta">' + button('完成讲解，查看下一步', 'show-next', 'primary', 'full-width') + '</footer>' + toast() + guideDetailSheet() + '</div>';
  }

  function serviceMeta(point) {
    if (point.type === 'wc') return { display: '无障碍卫生间', status: '设施开放中，具体状况待现场核验', symbol: 'WC', shape: 'square' };
    if (point.type === 'ramp') return { display: '便民坡板', status: '可提供坡板，使用方式待核验', symbol: '坡', shape: 'round' };
    return { display: '便民服务', status: '服务开放中', symbol: '服', shape: 'diamond' };
  }

  function renderServiceDetail(motion) {
    const point = selectedPoint();
    if (!point) return renderMap(motion);
    const meta = serviceMeta(point);
    return '<div class="phone-shell service-detail' + motionClass(motion) + '">' + deviceOverlay() + '<header class="service-header"><button class="icon-button back-button" data-action="back-map" aria-label="返回地图">' + icon('back') + '</button><span>服务详情</span></header>' +
      '<main id="app-main" class="service-scroll"><section class="service-title"><span class="service-hero-icon ' + meta.shape + '"><b>' + meta.symbol + '</b></span><div><h1>' + point.name + '</h1><p class="service-type">' + icon('check') + meta.display + '</p></div></section>' +
      '<section class="status-card"><h2>' + icon('info') + '状态说明</h2><p>' + meta.status + '</p></section><hr>' +
      '<section class="confirm"><h2>使用前确认</h2><div><p>坡板的具体位置、当前开放时间，以及是否需要工作人员到场协助，<strong>仍需等待现场确认</strong>。建议到达后联系附近工作人员。</p></div></section></main>' +
      '<footer class="detail-cta">' + button('前往' + point.name, 'start-nav', 'primary', 'full-width', 'navigation') + '</footer>' + toast() + '</div>';
  }

  function render(options) {
    const previousAction = options && options.preserveFocus ? document.activeElement && document.activeElement.getAttribute('data-action') : null;
    const previousId = options && options.preserveFocus ? document.activeElement && document.activeElement.getAttribute('data-id') : null;
    const motion = options && options.motion;
    if (state.currentView === 'guide-detail') app.innerHTML = renderGuideDetail(motion);
    else if (state.currentView === 'service-detail') app.innerHTML = renderServiceDetail(motion);
    else app.innerHTML = renderMap(motion);
    app.setAttribute('aria-busy', state.pendingAction ? 'true' : 'false');
    const focusSelector = options && options.focusSelector;
    if (focusSelector) {
      const focusTarget = app.querySelector(focusSelector);
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    } else if (previousAction) {
      const idSelector = previousId ? '[data-id="' + previousId + '"]' : '';
      const target = app.querySelector('[data-action="' + previousAction + '"]' + idSelector);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function focusOpenSheet() {
    const closeButton = app.querySelector('.sheet.is-open [data-action="close-sheet"]');
    if (closeButton) closeButton.focus({ preventScroll: true });
  }

  function openSheet(returnSelector, motion) {
    sheetReturnSelector = returnSelector;
    render({ motion: motion || 'sheet' });
    focusOpenSheet();
  }

  function closeSheet() {
    if (sheetTimer || state.bottomSheet === 'none') return;
    const returnSelector = sheetReturnSelector;
    const openSheetNode = app.querySelector('.sheet.is-open');
    const backdrop = app.querySelector('.sheet-backdrop');
    if (openSheetNode) openSheetNode.classList.add('is-closing');
    if (backdrop) backdrop.classList.add('is-closing');
    sheetTimer = setTimeout(function () {
      sheetTimer = null;
      state.bottomSheet = 'none';
      sheetReturnSelector = null;
      render({ focusSelector: returnSelector || ('[data-action="point"][data-id="' + state.selectedPointId + '"]') });
    }, reducedMotion.matches ? 0 : 160);
  }

  function runPendingAction(action, delay, complete) {
    if (state.pendingAction) return;
    clearToast();
    state.pendingAction = action;
    render({ preserveFocus: true });
    actionTimer = setTimeout(function () {
      actionTimer = null;
      state.pendingAction = null;
      complete();
    }, reducedMotion.matches ? 0 : delay);
  }

  function legacyCopyText(text) {
    return new Promise(function (resolve, reject) {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.top = '-1000px';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, field.value.length);
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      field.remove();
      if (copied) resolve();
      else reject(new Error('Copy command was not available'));
    });
  }

  function writeClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopyText(text);
      });
    }
    return legacyCopyText(text);
  }

  function copySupportPhone() {
    const phone = supportPhone();
    if (!phone) return;
    writeClipboard(phone).then(function () {
      showToast('电话号码已复制', { preserveFocus: true });
    }).catch(function () {
      showToast('复制失败，请手动记录', { preserveFocus: true });
    });
  }

  function clearToast() {
    clearTimeout(toastTimer);
    toastTimer = null;
    state.toastMsg = null;
  }

  function showToast(message, options) {
    clearToast();
    state.toastMsg = message;
    render(options);
    toastTimer = setTimeout(function () {
      state.toastMsg = null;
      toastTimer = null;
      render({ preserveFocus: true });
    }, 3000);
  }

  function selectMapPoint(id) {
    state.selectedPointId = id;
    render({ motion: 'select' });
    const marker = app.querySelector('[data-action="point"][data-id="' + id + '"]');
    if (marker) marker.focus({ preventScroll: true });
  }

  function nextRecommendedGuide() {
    const currentGuide = data.guides.find(function (guide) { return guide.id === state.selectedPointId; });
    if (!currentGuide) return data.guides[0];
    return data.guides.find(function (guide) { return guide.id === currentGuide.nextGuideId; }) || data.guides[0];
  }

  function nextRecommendedFacility() {
    const currentIndex = data.nearbyFacilities.findIndex(function (facility) { return facility.id === state.selectedPointId; });
    return data.nearbyFacilities[(currentIndex + 1) % data.nearbyFacilities.length];
  }

  function openPoint(id) {
    const point = data.allPoints.find(function (item) { return item.id === id; });
    if (!point) return;
    clearToast();
    state.selectedPointId = id;
    state.bottomSheet = 'none';
    state.currentView = point.type === 'guide' ? 'guide-detail' : 'service-detail';
    state.isPlaying = false;
    render({ motion: 'forward' });
  }

  app.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');

    if (state.pendingAction) return;

    if (action === 'filter') {
      state.activeFilter = target.getAttribute('data-filter');
      state.selectedPointId = null;
      state.isVoiceNavActive = false;
      render({ preserveFocus: true, motion: 'filter' });
    } else if (action === 'point') {
      const pointId = target.getAttribute('data-id');
      if (state.selectedPointId === pointId) openPoint(pointId);
      else selectMapPoint(pointId);
    } else if (action === 'open-point') {
      openPoint(target.getAttribute('data-id'));
    } else if (action === 'listen') {
      runPendingAction('listen', 480, function () {
        state.locationEnabled = true;
        state.selectedPointId = 'g6';
        state.bottomSheet = 'nearest-guide';
        openSheet('[data-action="listen"]');
      });
    } else if (action === 'locate') {
      runPendingAction('locate', 420, function () {
        state.locationEnabled = true;
        showToast('已定位到当前位置', { preserveFocus: true });
      });
    } else if (action === 'nearby-facilities') {
      runPendingAction('nearby-facilities', 380, function () {
        state.locationEnabled = true;
        state.selectedPointId = data.nearbyFacilities[0].id;
        state.bottomSheet = 'nearest-facility';
        state.isVoiceNavActive = false;
        openSheet('[data-action="nearby-facilities"]');
      });
    } else if (action === 'close-sheet') {
      closeSheet();
    } else if (action === 'skip-guide') {
      state.selectedPointId = nextRecommendedGuide().id;
      showToast('已切换至下一个讲解点', { preserveFocus: true });
    } else if (action === 'skip-facility') {
      state.selectedPointId = nextRecommendedFacility().id;
      showToast('已切换至下一个附近设施', { preserveFocus: true });
    } else if (action === 'open-recommended-guide') {
      openPoint(state.selectedPointId);
    } else if (action === 'back-map') {
      state.currentView = 'map';
      state.bottomSheet = 'none';
      render({ motion: 'back' });
      const returnedMarker = app.querySelector('[data-action="point"][data-id="' + state.selectedPointId + '"]');
      if (returnedMarker) returnedMarker.focus({ preventScroll: true });
    } else if (action === 'toggle-play') {
      state.isPlaying = !state.isPlaying;
      render({ preserveFocus: true });
    } else if (action === 'media-video' || action === 'media-audio') {
      state.mediaMode = action === 'media-video' ? 'video' : 'audio';
      state.isPlaying = false;
      render({ preserveFocus: true });
    } else if (action === 'show-next') {
      state.bottomSheet = 'next-steps';
      openSheet('[data-action="show-next"]');
    } else if (action === 'next-guide') {
      clearToast();
      state.selectedPointId = nextRecommendedGuide().id;
      state.activeFilter = 'guide';
      state.bottomSheet = 'next-guide';
      state.currentView = 'map';
      state.isPlaying = false;
      state.isVoiceNavActive = false;
      sheetReturnSelector = '[data-action="point"][data-id="' + state.selectedPointId + '"]';
      render({ motion: 'sheet' });
      focusOpenSheet();
    } else if (action === 'start-nav') {
      runPendingAction('start-nav', 320, function () {
        state.currentView = 'map';
        state.bottomSheet = 'none';
        state.isVoiceNavActive = true;
        sheetReturnSelector = null;
        render({ motion: 'settle' });
      });
    } else if (action === 'repeat-nav') {
      showToast('已重播当前语音');
    } else if (action === 'copy-support-phone') {
      copySupportPhone();
    } else if (action === 'end-nav') {
      state.isVoiceNavActive = false;
      showToast('已结束导航');
    }
  });

  render();
}());
