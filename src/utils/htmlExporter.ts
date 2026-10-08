import { Question } from '../types/question';

/**
 * Gera um arquivo HTML autocontido com CSS e JavaScript nativo
 * permitindo ao aluno resolver questões interativamente sem internet.
 */
export function generateOfflineHtml(questions: Question[], filterTitle: string = 'Simulado de Questões'): string {
  const safeData = JSON.stringify(questions);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(filterTitle)} - Resolução Offline</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --success: #16a34a;
      --success-bg: #f0fdf4;
      --error: #dc2626;
      --error-bg: #fef2f2;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --radius: 12px;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 16px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .badge-offline {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 8px;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .stat-pill {
      background: #f1f5f9;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
    }
    .stat-pill strong {
      color: var(--primary);
    }
    .stat-pill.correct strong {
      color: var(--success);
    }
    .stat-pill.wrong strong {
      color: var(--error);
    }
    .question-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      transition: border-color 0.2s;
    }
    .q-header-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
    }
    .q-number-badge {
      background: #1e293b;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      padding: 6px 12px;
      border-radius: 6px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .q-etiqueta-destaque {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      color: #1e3a8a;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.06);
    }
    .etiqueta-badge {
      background: #2563eb;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .etiqueta-text {
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.01em;
    }
    .q-enunciado {
      font-size: 15px;
      font-weight: 500;
      line-height: 1.7;
      margin-bottom: 20px;
      white-space: pre-wrap;
      text-align: justify;
      color: #1e293b;
    }
    .alternatives-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .alt-btn {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      text-align: left;
      background: #ffffff;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      color: var(--text);
    }
    .alt-btn:hover:not(:disabled) {
      border-color: var(--primary);
      background: #f8fafc;
    }
    .alt-letter {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #f1f5f9;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .alt-btn.selected .alt-letter {
      background: var(--primary);
      color: #ffffff;
    }
    .alt-btn.selected {
      border-color: var(--primary);
      background: #eff6ff;
    }
    .alt-btn.correct {
      border-color: var(--success) !important;
      background: var(--success-bg) !important;
    }
    .alt-btn.correct .alt-letter {
      background: var(--success) !important;
      color: white !important;
    }
    .alt-btn.wrong {
      border-color: var(--error) !important;
      background: var(--error-bg) !important;
    }
    .alt-btn.wrong .alt-letter {
      background: var(--error) !important;
      color: white !important;
    }
    .actions-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .btn-submit {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-submit:hover:not(:disabled) {
      background: var(--primary-dark);
    }
    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-reset {
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    .feedback-banner {
      display: none;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 14px;
      padding: 10px 14px;
      border-radius: 8px;
      margin-top: 16px;
    }
    .feedback-banner.correct {
      display: flex;
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid #bbf7d0;
    }
    .feedback-banner.wrong {
      display: flex;
      background: var(--error-bg);
      color: var(--error);
      border: 1px solid #fecaca;
    }
    .accordion-section {
      display: none;
      margin-top: 20px;
      border-top: 1px dashed var(--border);
      padding-top: 16px;
    }
    .box-comment {
      background: #f8fafc;
      border-left: 4px solid var(--primary);
      padding: 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 16px;
    }
    .box-comment h4 {
      font-size: 14px;
      color: var(--primary-dark);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .box-dica {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      border-radius: 0 8px 8px 0;
    }
    .box-dica h4 {
      font-size: 14px;
      color: #b45309;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .content-body {
      font-size: 14px;
      color: #334155;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .filter-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .filter-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }
    .filter-field label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .filter-select, .filter-input {
      width: 100%;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      outline: none;
      transition: border-color 0.2s;
    }
    .filter-select:focus, .filter-input:focus {
      border-color: var(--primary);
      background: #ffffff;
    }
    .filter-bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .filter-status-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .filter-status-btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--border);
      background: #f8fafc;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-status-btn.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }
    .btn-clear-filters {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge-offline">Modo Estudo Offline (Sem Internet)</span>
      <h1>${escapeHtml(filterTitle)}</h1>
      <p class="subtitle">Este arquivo foi gerado para estudo offline autônomo com filtros completos (Módulos I, II, V, VI, VII, VIII, IX, Capítulos e Subtópicos) e gabarito comentado.</p>
      
      <div class="stats-bar">
        <div class="stat-pill">Total: <strong id="totalCount">${questions.length}</strong></div>
        <div class="stat-pill">Exibindo: <strong id="visibleCount">${questions.length}</strong></div>
        <div class="stat-pill">Respondidas: <strong id="answeredCount">0</strong></div>
        <div class="stat-pill correct">Acertos: <strong id="correctCount">0</strong></div>
        <div class="stat-pill wrong">Erros: <strong id="wrongCount">0</strong></div>
        <div class="stat-pill">Aproveitamento: <strong id="scoreRate">0%</strong></div>
      </div>
    </header>

    <!-- Barra de Filtros Hierárquicos Offline -->
    <div class="filter-card">
      <div class="filter-title">
        <span>Filtro por Conteúdo (Módulos I, II, V, VI, VII, VIII, IX &bull; Capítulos &bull; Subtópicos)</span>
        <button type="button" class="btn-clear-filters" id="btnClearFilters" onclick="resetFilters()">Limpar Filtros</button>
      </div>

      <div class="filter-grid">
        <div class="filter-field">
          <label for="selModulo">1. Módulo</label>
          <select id="selModulo" class="filter-select" onchange="onModuloFilterChange()">
            <option value="">(Todos os Módulos)</option>
          </select>
        </div>

        <div class="filter-field">
          <label for="selCapitulo">2. Capítulo (Seção X.Y)</label>
          <select id="selCapitulo" class="filter-select" onchange="onCapituloFilterChange()">
            <option value="">(Todos os Capítulos)</option>
          </select>
        </div>

        <div class="filter-field">
          <label for="selSubtopico">3. Subtópico (Nível X.Y.Z)</label>
          <select id="selSubtopico" class="filter-select" onchange="applyFilters()">
            <option value="">(Todos os Subtópicos)</option>
          </select>
        </div>

        <div class="filter-field">
          <label for="txtSearch">4. Busca por Texto</label>
          <input type="text" id="txtSearch" class="filter-input" placeholder="Pesquisar..." oninput="applyFilters()" />
        </div>
      </div>

      <div class="filter-bottom">
        <div class="filter-status-group">
          <button type="button" class="filter-status-btn active" id="btnStatus_todas" onclick="setStatusFilter('todas')">Todas</button>
          <button type="button" class="filter-status-btn" id="btnStatus_acertos" onclick="setStatusFilter('acertos')">Acertos</button>
          <button type="button" class="filter-status-btn" id="btnStatus_erros" onclick="setStatusFilter('erros')">Erros</button>
          <button type="button" class="filter-status-btn" id="btnStatus_pendentes" onclick="setStatusFilter('pendentes')">Não Respondidas</button>
        </div>
      </div>
    </div>

    <div id="questionsList"></div>
  </div>

  <script>
    const questionsData = ${safeData};
    const userAnswers = {}; // { [index]: { selected: 'A', status: 'correct'|'wrong' } }
    let activeStatusFilter = 'todas';

    // Módulos oficiais padrão
    const OFFICIAL_MODULOS = [
      'Módulo I',
      'Módulo II',
      'Módulo V',
      'Módulo VI',
      'Módulo VII',
      'Módulo VIII',
      'Módulo IX'
    ];

    function initFilterOptions() {
      const selMod = document.getElementById('selModulo');
      const modSet = new Set(OFFICIAL_MODULOS);

      questionsData.forEach(q => {
        const m = cleanField(q.modulo);
        if (m) modSet.add(normalizeModulo(m));
      });

      const sortedMods = Array.from(modSet).sort(compareMods);
      sortedMods.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        selMod.appendChild(opt);
      });

      updateCapitulosOptions();
    }

    function onModuloFilterChange() {
      updateCapitulosOptions();
      applyFilters();
    }

    function updateCapitulosOptions() {
      const selMod = document.getElementById('selModulo').value;
      const selCap = document.getElementById('selCapitulo');
      const currentCap = selCap.value;
      selCap.innerHTML = '<option value="">(Todos os Capítulos)</option>';

      const capSet = new Set();
      questionsData.forEach(q => {
        const qMod = normalizeModulo(cleanField(q.modulo));
        if (selMod && !areModsEq(qMod, selMod)) return;
        const c = cleanField(q.capitulo);
        if (c) capSet.add(c);
      });

      Array.from(capSet).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === currentCap) opt.selected = true;
        selCap.appendChild(opt);
      });

      updateSubtopicosOptions();
    }

    function onCapituloFilterChange() {
      updateSubtopicosOptions();
      applyFilters();
    }

    function updateSubtopicosOptions() {
      const selMod = document.getElementById('selModulo').value;
      const selCap = document.getElementById('selCapitulo').value;
      const selSub = document.getElementById('selSubtopico');
      const currentSub = selSub.value;
      selSub.innerHTML = '<option value="">(Todos os Subtópicos)</option>';

      const subSet = new Set();
      questionsData.forEach(q => {
        const qMod = normalizeModulo(cleanField(q.modulo));
        if (selMod && !areModsEq(qMod, selMod)) return;
        const qCap = cleanField(q.capitulo);
        if (selCap && !areCapsEq(qCap, selCap)) return;
        const s = cleanField(q.subtopico);
        if (s) subSet.add(s);
      });

      Array.from(subSet).sort().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === currentSub) opt.selected = true;
        selSub.appendChild(opt);
      });
    }

    function setStatusFilter(status) {
      activeStatusFilter = status;
      ['todas', 'acertos', 'erros', 'pendentes'].forEach(st => {
        const btn = document.getElementById('btnStatus_' + st);
        if (btn) btn.classList.toggle('active', st === status);
      });
      applyFilters();
    }

    function resetFilters() {
      document.getElementById('selModulo').value = '';
      document.getElementById('txtSearch').value = '';
      activeStatusFilter = 'todas';
      ['todas', 'acertos', 'erros', 'pendentes'].forEach(st => {
        const btn = document.getElementById('btnStatus_' + st);
        if (btn) btn.classList.toggle('active', st === 'todas');
      });
      updateCapitulosOptions();
      applyFilters();
    }

    function applyFilters() {
      const selMod = document.getElementById('selModulo').value;
      const selCap = document.getElementById('selCapitulo').value;
      const selSub = document.getElementById('selSubtopico').value;
      const search = (document.getElementById('txtSearch').value || '').toLowerCase().trim();

      let visibleCount = 0;

      questionsData.forEach((q, idx) => {
        const card = document.getElementById('q_' + idx);
        if (!card) return;

        const qMod = normalizeModulo(cleanField(q.modulo));
        const qCap = cleanField(q.capitulo);
        const qSub = cleanField(q.subtopico);

        let match = true;

        if (selMod && !areModsEq(qMod, selMod)) match = false;
        if (match && selCap && !areCapsEq(qCap, selCap)) match = false;
        if (match && selSub && !qSub.toLowerCase().includes(selSub.toLowerCase())) match = false;

        if (match && activeStatusFilter !== 'todas') {
          const ans = userAnswers[idx];
          if (activeStatusFilter === 'pendentes' && ans && ans.answered) match = false;
          if (activeStatusFilter === 'acertos' && (!ans || !ans.isCorrect)) match = false;
          if (activeStatusFilter === 'erros' && (!ans || ans.isCorrect)) match = false;
        }

        if (match && search) {
          const content = (q.enunciado + ' ' + (q.gabarito_comentado || '') + ' ' + (q.modulo || '') + ' ' + (q.capitulo || '')).toLowerCase();
          if (!content.includes(search)) match = false;
        }

        card.style.display = match ? 'block' : 'none';
        if (match) visibleCount++;
      });

      const visEl = document.getElementById('visibleCount');
      if (visEl) visEl.textContent = visibleCount;
    }

    function normalizeModulo(m) {
      if (!m) return '';
      const str = String(m).trim();
      const numMatch = str.match(/(?:m[óo]dulo\s*)?([0-9]+|[ivxlcdm]+)/i);
      if (!numMatch) return str;
      const val = numMatch[1].toUpperCase();
      const map = { '1':'Módulo I', '2':'Módulo II', '3':'Módulo III', '4':'Módulo IV', '5':'Módulo V', '6':'Módulo VI', '7':'Módulo VII', '8':'Módulo VIII', '9':'Módulo IX', 'I':'Módulo I', 'II':'Módulo II', 'V':'Módulo V', 'VI':'Módulo VI', 'VII':'Módulo VII', 'VIII':'Módulo VIII', 'IX':'Módulo IX' };
      return map[val] || ('Módulo ' + val);
    }

    function areModsEq(a, b) {
      if (!a && !b) return true;
      if (!a || !b) return false;
      return normalizeModulo(a).toLowerCase() === normalizeModulo(b).toLowerCase();
    }

    function areCapsEq(a, b) {
      if (!a && !b) return true;
      if (!a || !b) return false;
      const na = a.toLowerCase().replace(/[^0-9a-z]/g, '');
      const nb = b.toLowerCase().replace(/[^0-9a-z]/g, '');
      return na.includes(nb) || nb.includes(na);
    }

    function compareMods(a, b) {
      const order = { 'Módulo I': 1, 'Módulo II': 2, 'Módulo V': 5, 'Módulo VI': 6, 'Módulo VII': 7, 'Módulo VIII': 8, 'Módulo IX': 9 };
      return (order[a] || 99) - (order[b] || 99);
    }

    function renderQuestions() {
      const container = document.getElementById('questionsList');
      container.innerHTML = '';

      questionsData.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = 'q_' + index;

        // Limpar menções a modelo e montar a etiqueta destacada: modulo - capitulo - subtopico - tema
        const cleanMod = cleanField(q.modulo);
        const cleanCap = cleanField(q.capitulo);
        const cleanSub = cleanField(q.subtopico);
        const cleanTema = cleanField(q.tema_subtopico);

        const etiquetaParts = [];
        if (cleanMod) etiquetaParts.push(cleanMod);
        if (cleanCap) etiquetaParts.push(cleanCap);
        if (cleanSub) etiquetaParts.push(cleanSub);
        if (cleanTema) etiquetaParts.push(cleanTema);
        const etiquetaStr = etiquetaParts.join(' - ');

        // Cabeçalho da questão com Etiqueta em destaque
        let headerHtml = '<div class="q-header-top">';
        headerHtml += '<span class="q-number-badge">Questão ' + (index + 1) + '</span>';
        if (etiquetaStr) {
          headerHtml += '<div class="q-etiqueta-destaque">' +
            '<span class="etiqueta-badge">Etiqueta</span>' +
            '<span class="etiqueta-text">' + escapeStr(etiquetaStr) + '</span>' +
          '</div>';
        }
        headerHtml += '</div>';

        // Enunciado limpo (sem tags de modelo ou módulo)
        const cleanEnunciado = cleanQuestionEnunciado(q.enunciado);
        const enunciadoHtml = '<div class="q-enunciado">' + escapeStr(cleanEnunciado) + '</div>';

        // Alternativas
        let altsHtml = '<div class="alternatives-list" id="alts_' + index + '">';
        const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
        alts.forEach((alt, altIdx) => {
          const letter = typeof alt === 'object' && alt.letra ? String(alt.letra).toUpperCase().trim() : String.fromCharCode(65 + altIdx);
          const text = typeof alt === 'object' && alt.texto ? alt.texto : String(alt);
          altsHtml += '<button type="button" class="alt-btn" id="btn_' + index + '_' + letter + '" onclick="selectOption(' + index + ', \'' + letter + '\')">' +
            '<span class="alt-letter">' + letter + '</span>' +
            '<span class="alt-text">' + escapeStr(text) + '</span>' +
          '</button>';
        });
        altsHtml += '</div>';

        // Linha de ações
        const actionsHtml = '<div class="actions-row">' +
          '<button type="button" class="btn-submit" id="submit_' + index + '" onclick="submitAnswer(' + index + ')" disabled>Responder</button>' +
          '<button type="button" class="btn-reset" id="reset_' + index + '" onclick="resetQuestion(' + index + ')" style="display:none;">Tentar Novamente</button>' +
        '</div>';

        // Feedback
        const feedbackHtml = '<div class="feedback-banner" id="feedback_' + index + '"></div>';

        // Accordion Gabarito Comentado e Dica
        let accordionHtml = '<div class="accordion-section" id="accordion_' + index + '">';
        if (q.gabarito_comentado) {
          accordionHtml += '<div class="box-comment">' +
            '<h4>Gabarito Comentado (Alternativa ' + escapeStr(q.alternativa_correta) + ')</h4>' +
            '<div class="content-body">' + escapeStr(q.gabarito_comentado) + '</div>' +
          '</div>';
        }
        if (q.dica_macete) {
          accordionHtml += '<div class="box-dica">' +
            '<h4>💡 Dica & Macete de Memorização</h4>' +
            '<div class="content-body">' + escapeStr(q.dica_macete) + '</div>' +
          '</div>';
        }
        accordionHtml += '</div>';

        card.innerHTML = headerHtml + enunciadoHtml + altsHtml + actionsHtml + feedbackHtml + accordionHtml;
        container.appendChild(card);
      });

      updateStats();
    }

    function selectOption(qIdx, letter) {
      if (userAnswers[qIdx] && userAnswers[qIdx].answered) return;

      const q = questionsData[qIdx];
      const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
      alts.forEach((alt, idx) => {
        const l = typeof alt === 'object' && alt.letra ? alt.letra : String.fromCharCode(65 + idx);
        const btn = document.getElementById('btn_' + qIdx + '_' + l);
        if (btn) btn.classList.remove('selected');
      });

      const selectedBtn = document.getElementById('btn_' + qIdx + '_' + letter);
      if (selectedBtn) selectedBtn.classList.add('selected');

      userAnswers[qIdx] = { selected: letter, answered: false };
      const submitBtn = document.getElementById('submit_' + qIdx);
      if (submitBtn) submitBtn.disabled = false;
    }

    function submitAnswer(qIdx) {
      const state = userAnswers[qIdx];
      if (!state || !state.selected) return;

      const q = questionsData[qIdx];
      const correct = q.alternativa_correta.toUpperCase().trim();
      const isCorrect = state.selected.toUpperCase().trim() === correct;

      state.answered = true;
      state.isCorrect = isCorrect;

      // Estilizar botões
      const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
      alts.forEach((alt, idx) => {
        const l = typeof alt === 'object' && alt.letra ? alt.letra : String.fromCharCode(65 + idx);
        const btn = document.getElementById('btn_' + qIdx + '_' + l);
        if (btn) {
          btn.disabled = true;
          if (l === correct) {
            btn.classList.add('correct');
          } else if (l === state.selected && !isCorrect) {
            btn.classList.add('wrong');
          }
        }
      });

      // Feedback
      const feedback = document.getElementById('feedback_' + qIdx);
      if (feedback) {
        if (isCorrect) {
          feedback.className = 'feedback-banner correct';
          feedback.innerHTML = '✔ Parabéns! Resposta correta (Alternativa ' + correct + ').';
        } else {
          feedback.className = 'feedback-banner wrong';
          feedback.innerHTML = '✖ Resposta incorreta. A alternativa correta é a ' + correct + '.';
        }
      }

      // Expandir Gabarito e Dica
      const accordion = document.getElementById('accordion_' + qIdx);
      if (accordion) accordion.style.display = 'block';

      // Botões
      const submitBtn = document.getElementById('submit_' + qIdx);
      if (submitBtn) submitBtn.style.display = 'none';

      const resetBtn = document.getElementById('reset_' + qIdx);
      if (resetBtn) resetBtn.style.display = 'inline-block';

      updateStats();
    }

    function resetQuestion(qIdx) {
      delete userAnswers[qIdx];
      const q = questionsData[qIdx];
      const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
      alts.forEach((alt, idx) => {
        const l = typeof alt === 'object' && alt.letra ? alt.letra : String.fromCharCode(65 + idx);
        const btn = document.getElementById('btn_' + qIdx + '_' + l);
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('selected', 'correct', 'wrong');
        }
      });

      const feedback = document.getElementById('feedback_' + qIdx);
      if (feedback) {
        feedback.className = 'feedback-banner';
        feedback.style.display = 'none';
      }

      const accordion = document.getElementById('accordion_' + qIdx);
      if (accordion) accordion.style.display = 'none';

      const submitBtn = document.getElementById('submit_' + qIdx);
      if (submitBtn) {
        submitBtn.style.display = 'inline-block';
        submitBtn.disabled = true;
      }

      const resetBtn = document.getElementById('reset_' + qIdx);
      if (resetBtn) resetBtn.style.display = 'none';

      updateStats();
    }

    function updateStats() {
      let answered = 0;
      let correct = 0;
      let wrong = 0;

      Object.values(userAnswers).forEach(item => {
        if (item.answered) {
          answered++;
          if (item.isCorrect) correct++;
          else wrong++;
        }
      });

      document.getElementById('answeredCount').innerText = answered;
      document.getElementById('correctCount').innerText = correct;
      document.getElementById('wrongCount').innerText = wrong;
      const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      document.getElementById('scoreRate').innerText = rate + '%';
    }

    function cleanField(str) {
      if (!str) return '';
      let s = String(str);
      s = s.replace(/\(?\s*modelo\s*[12]\s*[-–—:]*\s*(?:m[úu]ltipla\s*escol(?:ha|a)|julgamento(?:\s+de\s+itens)?|certo\s*e?\s*errado)?\s*\)?/gi, '');
      s = s.replace(/\(?\s*m[úu]ltipla\s*escol(?:ha|a)\s*\)?/gi, '');
      s = s.replace(/\(?\s*julgamento\s+de\s+itens\s*\)?/gi, '');
      s = s.replace(/\(?\s*modelo\s*[12]\s*\)?/gi, '');
      return s.replace(/^[\s\-–—:.]+/g, '').replace(/[\s\-–—:.]+$/g, '').trim();
    }

    function cleanQuestionEnunciado(raw) {
      if (!raw) return '';
      let s = cleanField(raw);
      s = s.replace(/^\s*\([^)]*m[óo]dulo[^)]*\)\s*/i, '');
      return s.replace(/^[\s\-–—:.]+/g, '').trim();
    }

    function escapeStr(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Inicializar na carga
    window.addEventListener('DOMContentLoaded', () => {
      renderQuestions();
      initFilterOptions();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dispara o download no navegador usando Blob e a tag <a>
 */
export function downloadOfflineHtmlFile(questions: Question[], filename: string = 'questoes_concurso_offline.html', title?: string): void {
  const htmlContent = generateOfflineHtml(questions, title || 'Caderno de Questões Offline');
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
