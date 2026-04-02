// Shared exercise card builder for trainer dashboard
// This generates the inline JS that powers the exercise card UI in both
// create-workout and edit-workout pages. Any styling/structure changes here
// automatically apply to both pages AND match the React ExerciseCard component.

export function exerciseCardScript(apiBase) {
  return `
      var API = '${apiBase}';
      var SET_TYPES = [
        { value: 'warm_up', short: 'WU', label: 'Warm Up' },
        { value: 'touch_up', short: 'TU', label: 'Touch Up' },
        { value: 'straight', short: 'REG', label: 'Regular' },
        { value: 'drop', short: 'DS', label: 'Drop Set' },
        { value: 'rest_pause', short: 'RP', label: 'Rest-Pause' },
        { value: 'superset', short: 'SS', label: 'Super Set' },
        { value: 'alternating', short: 'Alt', label: 'Alternating' },
        { value: 'giant', short: 'Gia', label: 'Giant Set' },
        { value: 'pre_exhaust', short: 'PrEx', label: 'Pre-Exhaust' },
      ];
      function getSetTypeLabel(v) { var t = SET_TYPES.find(function(x) { return x.value === v; }); return t ? t.label : 'Regular'; }
      function getSetTypeShort(v) { var t = SET_TYPES.find(function(x) { return x.value === v; }); return t ? t.short : 'REG'; }

      var exerciseCount = 0;
      var searchTimeout = null;
      var activeSearchIdx = null;
      var setCounts = {};
      var validatedExercises = {};
      var activeSetTypeBtn = null;
      var activeSetTypeExIdx = null;

      var inputCSS = 'flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';

      function el(tag, styles, attrs) {
        var e = document.createElement(tag);
        if (styles) e.style.cssText = styles;
        if (attrs) Object.keys(attrs).forEach(function(k) { e[k] = attrs[k]; });
        return e;
      }

      function updateSetCount(idx) {
        var setsDiv = document.getElementById('sets-' + idx);
        var count = setsDiv ? setsDiv.children.length : 0;
        var label = document.getElementById('set-count-' + idx);
        if (label) label.textContent = count + ' set' + (count !== 1 ? 's' : '');
      }

      function moveExercise(idx, direction) {
        var card = document.getElementById('exercise-' + idx);
        if (!card) return;
        var sibling = direction === -1 ? card.previousElementSibling : card.nextElementSibling;
        if (!sibling) return;
        var container = document.getElementById('exercises-container');
        if (direction === -1) container.insertBefore(card, sibling);
        else container.insertBefore(sibling, card);
      }

      function removeExercise(idx) {
        var e = document.getElementById('exercise-' + idx);
        if (e) e.remove();
      }

      function mkCircleBtn(svg, hoverColor, hoverBg) {
        var b = el('button', 'width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.4);transition:all 0.15s;', { type: 'button' });
        b.innerHTML = svg;
        b.onmouseover = function() { this.style.color = hoverColor; this.style.background = hoverBg; };
        b.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
        return b;
      }

      // === SECTION HEADER CARD ===
      function addSectionHeader(prefill) {
        var idx = exerciseCount++;
        var container = document.getElementById('exercises-container');
        var card = el('div', 'border-radius:16px;margin-bottom:16px;overflow:hidden;border:1px solid rgba(239,68,68,0.3);border-left:4px solid #ef4444;background:linear-gradient(90deg,rgba(239,68,68,0.08),transparent);');
        card.className = 'glass';
        card.id = 'exercise-' + idx;

        // Hidden marker for section header
        var markerInput = el('input'); markerInput.type = 'hidden';
        markerInput.name = 'exercises[' + idx + '][isSectionHeader]'; markerInput.value = '1';
        card.appendChild(markerInput);

        // Section badge + Header row
        var header = el('div', 'padding:12px 16px;display:flex;align-items:center;justify-content:space-between;');
        var badge = el('span', 'font-size:9px;color:#ef4444;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-right:8px;white-space:nowrap;');
        badge.textContent = 'SECTION';
        header.appendChild(badge);
        var nameInput = el('input', 'flex:1;padding:0;border:none;background:none;color:#fff;font-size:15px;font-weight:800;font-family:inherit;outline:none;text-transform:uppercase;letter-spacing:1px;');
        nameInput.type = 'text'; nameInput.name = 'exercises[' + idx + '][name]';
        nameInput.placeholder = 'Section Title (e.g. WARM UP)'; nameInput.required = true;
        if (prefill) nameInput.value = prefill.name || '';

        var headerBtns = el('div', 'display:flex;align-items:center;gap:4px;shrink:0;');
        var upBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        upBtn.onclick = function() { moveExercise(idx, -1); };
        var downBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        downBtn.onclick = function() { moveExercise(idx, 1); };
        var removeBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>', '#ef4444', 'rgba(239,68,68,0.15)');
        removeBtn.onclick = function() { removeExercise(idx); };
        headerBtns.appendChild(upBtn); headerBtns.appendChild(downBtn); headerBtns.appendChild(removeBtn);
        header.appendChild(nameInput); header.appendChild(headerBtns);
        card.appendChild(header);

        // Notes/description
        var notesWrap = el('div', 'padding:10px 16px;');
        var notesInput = el('textarea', 'width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;min-height:36px;');
        notesInput.name = 'exercises[' + idx + '][sectionNotes]';
        notesInput.placeholder = 'Section notes (e.g. 5 min light cardio, dynamic stretches)';
        notesInput.rows = 2;
        if (prefill && prefill.sectionNotes) notesInput.value = prefill.sectionNotes;
        notesWrap.appendChild(notesInput);
        card.appendChild(notesWrap);

        container.appendChild(card);
      }

      // === EXERCISE CARD ===
      function addExercise(prefill) {
        var idx = exerciseCount++;
        var container = document.getElementById('exercises-container');
        var card = el('div', 'border-radius:16px;margin-bottom:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);');
        card.className = 'glass';
        card.id = 'exercise-' + idx;

        // === HEADER: Exercise name + control buttons ===
        var header = el('div', 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;');

        // Search wrap
        var searchWrap = el('div', 'flex:1;position:relative;min-width:0;');
        var searchInput = el('input', 'width:100%;padding:0;border:none;background:none;color:#fff;font-size:15px;font-weight:600;font-family:inherit;outline:none;');
        searchInput.type = 'text'; searchInput.id = 'ex-search-' + idx;
        searchInput.name = 'exercises[' + idx + '][name]';
        searchInput.placeholder = 'Search exercises...'; searchInput.required = true; searchInput.autocomplete = 'off';
        if (prefill) { searchInput.value = prefill.name; validatedExercises[idx] = true; }
        searchInput.oninput = function() { searchExercises(idx, this.value); };
        searchInput.onfocus = function() { searchExercises(idx, this.value); };
        var resultsDiv = el('div', 'display:none;position:absolute;top:calc(100% + 8px);left:-16px;right:-16px;z-index:50;max-height:220px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
        resultsDiv.id = 'ex-results-' + idx;
        var validBadge = el('span', 'display:none;align-items:center;margin-left:6px;');
        validBadge.id = 'ex-valid-' + idx;
        if (prefill) { validBadge.style.display = 'inline-flex'; validBadge.style.color = '#22c55e'; validBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'; }
        searchWrap.appendChild(searchInput); searchWrap.appendChild(validBadge); searchWrap.appendChild(resultsDiv);

        // Control buttons: move up, move down, swap (add exercise below), delete
        var headerBtns = el('div', 'display:flex;align-items:center;gap:4px;shrink:0;');
        var upBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        upBtn.title = 'Move up';
        upBtn.onclick = function() { moveExercise(idx, -1); };
        var downBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        downBtn.title = 'Move down';
        downBtn.onclick = function() { moveExercise(idx, 1); };
        var addBelowBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>', '#22c55e', 'rgba(34,197,94,0.15)');
        addBelowBtn.title = 'Add exercise below';
        addBelowBtn.onclick = function() {
          var newCard = addExercise();
          var thisCard = document.getElementById('exercise-' + idx);
          if (thisCard && newCard && thisCard.nextSibling) {
            container.insertBefore(newCard, thisCard.nextSibling);
          }
        };
        var swapBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>', '#3b82f6', 'rgba(59,130,246,0.15)');
        swapBtn.title = 'Swap exercise';
        swapBtn.onclick = function() {
          searchInput.value = '';
          searchInput.focus();
          searchExercises(idx, '');
          validBadge.style.display = 'none';
          validatedExercises[idx] = false;
        };
        var removeBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>', '#ef4444', 'rgba(239,68,68,0.15)');
        removeBtn.title = 'Remove exercise';
        removeBtn.onclick = function() { removeExercise(idx); };
        headerBtns.appendChild(upBtn); headerBtns.appendChild(downBtn); headerBtns.appendChild(swapBtn); headerBtns.appendChild(addBelowBtn); headerBtns.appendChild(removeBtn);
        header.appendChild(searchWrap); header.appendChild(headerBtns);
        card.appendChild(header);

        // Hidden set type
        var stHidden = el('input'); stHidden.type = 'hidden';
        stHidden.name = 'exercises[' + idx + '][setType]'; stHidden.id = 'settype-val-' + idx;
        stHidden.value = prefill ? prefill.setType || 'straight' : 'straight';
        card.appendChild(stHidden);

        // === SET CONTROLS SUBHEADER ===
        var setControls = el('div', 'padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.015);');
        var setCountLabel = el('span', 'font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;');
        setCountLabel.id = 'set-count-' + idx;
        setCountLabel.textContent = '3 sets';
        var setBtns = el('div', 'display:flex;align-items:center;gap:6px;');
        var addSetPill = el('button', 'height:26px;padding:0 10px;border-radius:13px;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;gap:4px;cursor:pointer;color:rgba(255,255,255,0.4);font-family:inherit;transition:all 0.15s;', { type: 'button' });
        addSetPill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>';
        var addSetText = el('span', 'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;'); addSetText.textContent = 'Add Set';
        addSetPill.appendChild(addSetText);
        addSetPill.onmouseover = function() { this.style.color = '#fff'; this.style.background = 'rgba(255,255,255,0.12)'; };
        addSetPill.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
        addSetPill.onclick = function() { addSet(idx); updateSetCount(idx); };
        var rmSetPill = el('button', 'height:26px;padding:0 10px;border-radius:13px;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;gap:4px;cursor:pointer;color:rgba(255,255,255,0.4);font-family:inherit;transition:all 0.15s;', { type: 'button' });
        rmSetPill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"/></svg>';
        var rmSetText = el('span', 'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;'); rmSetText.textContent = 'Remove';
        rmSetPill.appendChild(rmSetText);
        rmSetPill.onmouseover = function() { this.style.color = '#ef4444'; this.style.background = 'rgba(239,68,68,0.12)'; };
        rmSetPill.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
        rmSetPill.onclick = function() { var sd = document.getElementById('sets-' + idx); if (sd && sd.lastChild) { sd.lastChild.remove(); updateSetCount(idx); } };
        setBtns.appendChild(addSetPill); setBtns.appendChild(rmSetPill);
        setControls.appendChild(setCountLabel); setControls.appendChild(setBtns);
        card.appendChild(setControls);

        // === COLUMN HEADERS ===
        var colHeaders = el('div', 'display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);');
        [{ t: 'Set', w: '36px' }, { t: 'Type', w: '72px' }, { t: 'Weight', f: '1' }, { t: 'Reps', f: '1' }, { t: '', w: '28px' }].forEach(function(c) {
          var sp = el('span', 'font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.25);font-weight:600;text-align:center;' + (c.f ? 'flex:' + c.f + ';' : 'width:' + c.w + ';'));
          sp.textContent = c.t; colHeaders.appendChild(sp);
        });
        card.appendChild(colHeaders);

        // === SETS CONTAINER ===
        var setsDiv = el('div'); setsDiv.id = 'sets-' + idx; card.appendChild(setsDiv);

        // === NOTES SECTION ===
        var notesWrap = el('div', 'padding:10px 16px;border-top:1px solid rgba(255,255,255,0.05);');
        var notesLabel = el('div', 'display:flex;align-items:center;gap:4px;margin-bottom:6px;');
        var notesIcon = el('span'); notesIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>';
        var notesText = el('span', 'font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;font-weight:600;'); notesText.textContent = 'Notes';
        notesLabel.appendChild(notesIcon); notesLabel.appendChild(notesText);
        var notesInput = el('textarea', 'width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;min-height:36px;');
        notesInput.name = 'exercises[' + idx + '][notes]'; notesInput.placeholder = 'Add notes for this exercise...'; notesInput.rows = 2;
        if (prefill && prefill.notes) notesInput.value = prefill.notes;
        notesWrap.appendChild(notesLabel); notesWrap.appendChild(notesInput);
        card.appendChild(notesWrap);

        container.appendChild(card);
        if (prefill && prefill.sets && prefill.sets.length > 0) {
          prefill.sets.forEach(function(s) { addSet(idx, s.reps, s.weight, prefill.setType); });
        } else {
          addSet(idx); addSet(idx); addSet(idx);
        }
        updateSetCount(idx);
        return card;
      }

      // === ADD SET ROW ===
      function addSet(exIdx, prefillReps, prefillWeight, prefillSetType) {
        if (!setCounts[exIdx]) setCounts[exIdx] = 0;
        var setIdx = setCounts[exIdx]++;
        var setsDiv = document.getElementById('sets-' + exIdx);
        var row = el('div', 'display:flex;align-items:center;padding:6px 16px;border-bottom:1px solid rgba(255,255,255,0.04);' + (setIdx % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : ''));
        row.id = 'set-' + exIdx + '-' + setIdx;

        // Set number
        var num = el('span', 'width:36px;text-align:center;font-size:13px;color:rgba(255,255,255,0.4);font-weight:700;');
        num.textContent = setIdx + 1;

        // Set type button
        var typeWrap = el('div', 'width:72px;');
        var typeBtn = el('button', 'width:100%;padding:6px 4px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;outline:none;', { type: 'button' });
        typeBtn.textContent = getSetTypeShort(prefillSetType || 'straight');
        typeBtn.onclick = function() { openSetTypePicker(exIdx, typeBtn); };
        typeWrap.appendChild(typeBtn);

        // Weight input
        var weightInput = el('input', inputCSS);
        weightInput.type = 'number'; weightInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][weight]';
        weightInput.placeholder = '—'; weightInput.value = prefillWeight !== undefined ? prefillWeight : '0';
        weightInput.onfocus = function() { if (this.value === '0') this.value = ''; };
        weightInput.onblur = function() { if (!this.value) this.value = '0'; };

        // Reps input
        var repsInput = el('input', inputCSS);
        repsInput.type = 'number'; repsInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][reps]';
        repsInput.placeholder = '10'; repsInput.value = prefillReps !== undefined ? prefillReps : '10';

        // Delete set button
        var delBtn = el('button', 'background:none;border:none;color:rgba(255,255,255,0.15);cursor:pointer;padding:4px;width:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;', { type: 'button' });
        delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
        delBtn.onmouseover = function() { this.style.color = '#ef4444'; this.style.background = 'rgba(239,68,68,0.1)'; };
        delBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.15)'; this.style.background = 'none'; };
        delBtn.onclick = function() { var e = document.getElementById('set-' + exIdx + '-' + setIdx); if (e) { e.remove(); updateSetCount(exIdx); } };

        row.appendChild(num); row.appendChild(typeWrap); row.appendChild(weightInput); row.appendChild(repsInput); row.appendChild(delBtn);
        setsDiv.appendChild(row);
      }

      function openSetTypePicker(exIdx, btnEl) {
        activeSetTypeBtn = btnEl;
        activeSetTypeExIdx = exIdx;
        var opts = document.getElementById('settype-options');
        opts.innerHTML = '';
        SET_TYPES.forEach(function(t) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = t.label;
          b.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border-bottom:1px solid rgba(255,255,255,0.05);';
          b.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
          b.onmouseout = function() { this.style.background = 'none'; };
          b.onclick = function() {
            activeSetTypeBtn.textContent = t.short;
            activeSetTypeBtn.style.color = t.value === 'straight' ? 'rgba(255,255,255,0.6)' : '#ef4444';
            document.getElementById('settype-val-' + activeSetTypeExIdx).value = t.value;
            document.getElementById('settype-modal').style.display = 'none';
          };
          opts.appendChild(b);
        });
        document.getElementById('settype-modal').style.display = 'flex';
      }

      function searchExercises(exIdx, query) {
        activeSearchIdx = exIdx;
        clearTimeout(searchTimeout);
        validatedExercises[exIdx] = false;
        var badge = document.getElementById('ex-valid-' + exIdx);
        if (badge) { badge.style.display = 'none'; }
        var resultsDiv = document.getElementById('ex-results-' + exIdx);
        if (!query || query.length < 1) { resultsDiv.style.display = 'none'; return; }
        searchTimeout = setTimeout(async function() {
          try {
            var resp = await fetch(API + '/exercises?q=' + encodeURIComponent(query));
            var exercises = await resp.json();
            resultsDiv.innerHTML = '';
            exercises.forEach(function(ex) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.05);';
              btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
              btn.onmouseout = function() { this.style.background = 'none'; };
              btn.onclick = function() { selectExercise(exIdx, ex.name); };
              var nameSpan = document.createElement('span');
              nameSpan.textContent = ex.name;
              if (ex.isCustom) {
                var tag = document.createElement('span');
                tag.textContent = ' custom';
                tag.style.cssText = 'font-size:9px;color:#ef4444;margin-left:4px;';
                nameSpan.appendChild(tag);
              }
              var muscleSpan = document.createElement('span');
              muscleSpan.textContent = ex.muscle || '';
              muscleSpan.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);';
              btn.appendChild(nameSpan); btn.appendChild(muscleSpan);
              resultsDiv.appendChild(btn);
            });
            var exactMatch = exercises.some(function(ex) { return ex.name.toLowerCase() === query.toLowerCase(); });
            if (!exactMatch) {
              var sep = document.createElement('div');
              sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);margin:4px 0;';
              resultsDiv.appendChild(sep);
              var customBtn = document.createElement('button');
              customBtn.type = 'button';
              customBtn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ef4444;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;';
              customBtn.onmouseover = function() { this.style.background = 'rgba(239,68,68,0.08)'; };
              customBtn.onmouseout = function() { this.style.background = 'none'; };
              customBtn.onclick = function() { openCustomModal(exIdx); };
              customBtn.textContent = '+ Add Custom Exercise';
              resultsDiv.appendChild(customBtn);
            }
            resultsDiv.style.display = 'block';
          } catch (err) { console.error(err); }
        }, 200);
      }

      function selectExercise(exIdx, name) {
        var input = document.getElementById('ex-search-' + exIdx);
        input.value = name;
        input.style.color = '#fff';
        document.getElementById('ex-results-' + exIdx).style.display = 'none';
        validatedExercises[exIdx] = true;
        var badge = document.getElementById('ex-valid-' + exIdx);
        if (badge) { badge.style.display = 'inline-flex'; badge.style.color = '#22c55e'; badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'; }
      }

      function openCustomModal(exIdx) {
        document.getElementById('ex-results-' + exIdx).style.display = 'none';
        document.getElementById('custom-ex-name').value = '';
        activeSearchIdx = exIdx;
        document.getElementById('custom-ex-modal').style.display = 'flex';
      }

      async function saveCustomExercise() {
        var name = document.getElementById('custom-ex-name').value.trim();
        var muscle = document.getElementById('custom-ex-muscle').value;
        if (!name) return;
        try {
          await fetch(API + '/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, muscleGroup: muscle }) });
        } catch (err) { console.error('Failed to save custom exercise:', err); }
        if (activeSearchIdx !== null) { selectExercise(activeSearchIdx, name); }
        document.getElementById('custom-ex-modal').style.display = 'none';
      }

      // Close dropdowns on outside click
      document.addEventListener('click', function(e) {
        if (!e.target.closest('[id^="ex-search-"]') && !e.target.closest('[id^="ex-results-"]')) {
          document.querySelectorAll('[id^="ex-results-"]').forEach(function(d) { d.style.display = 'none'; });
        }
      });
  `;
}
