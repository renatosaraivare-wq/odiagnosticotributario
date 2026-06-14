/**
 * RENATO SARAIVA — CONSULTOR TRIBUTÁRIO
 * Diagnóstico Tributário Premium — app.js  v2.0
 * ─────────────────────────────────────────────
 * • Multi-step form with validation
 * • Scoring engine (Tributário / Previdenciário / Financeiro)
 * • Animated result screen with count-up and ring
 * • localStorage auto-save & restore
 * • WhatsApp deep-link with pre-filled message
 * • Supabase-ready lead submission hook
 * • Floating WhatsApp button (result phase)
 */

'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
  whatsapp: '5581995041947',
  consultorNome: 'Renato Saraiva',
  // Supabase (preencha para ativar o envio de leads)
  supabase: {
    enabled: false,           // mude para true quando configurar
    url: 'https://SEU-PROJETO.supabase.co',
    anonKey: 'SUA-CHAVE-ANON',
    table: 'leads_diagnostico'
  },
  storageKey: 'rs_diagnostico_v1'
};

/* ============================================================
   SCORING RULES
   Quanto maior o valor, mais organizado o perfil.
   ============================================================ */
const SCORING = {
  // Tributário (step 2)
  ir_declaracao:        { sim_regular: 20, sim_atraso: 8,  nao_isento: 15, nao_deveria: 0  },
  controle_receita:     { planilha:    20, aplicativo: 18, caderno: 10,    nao: 0          },
  notas_fiscais:        { sempre:      20, as_vezes:   10, nao_obrigado: 15, nunca: 0      },
  mei_situacao:         { ativo_dia:   20, ativo_pendente: 8, nao_sou: 15, deveria: 2     },
  reforma_conhecimento: { sim_bem:     20, superficial: 10, nao: 2                         },

  // Previdenciário (step 3)
  inss_contribui:       { sempre: 25, mei_incluso: 20, as_vezes: 12, nao: 0  },
  aposentadoria_planeja:{ sim_estrategia: 20, sim_inss: 15, penso_pouco: 7, nao: 0 },
  dependentes_protecao: { sim_completa: 20, parcial: 12, nao: 4              },

  // Financeiro (step 4)
  reserva_emergencia:   { sim_6meses: 25, sim_3meses: 18, pouca: 8, nao: 0  },
  dividas:              { nenhuma: 25, controlada: 16, alta: 5, critica: 0   },
  poupanca_mensal:      { mais20: 20, ate20: 14, irregular: 6, nao: 0        },
  controle_orcamento:   { sim_detalhado: 20, basico: 12, nao: 2              }
};

/* Groups for score computation */
const TRIB_KEYS = ['ir_declaracao','controle_receita','notas_fiscais','mei_situacao','reforma_conhecimento'];
const PREV_KEYS = ['inss_contribui','aposentadoria_planeja','dependentes_protecao'];
const FIN_KEYS  = ['reserva_emergencia','dividas','poupanca_mensal','controle_orcamento'];

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentStep: 1,
  totalSteps: 5,
  answers: {},
  profile: {},
  scores: { tributario: 0, previdenciario: 0, financeiro: 0, geral: 0 },
  submitted: false
};

/* ============================================================
   DOM SHORTCUTS
   ============================================================ */
const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  restoreFromStorage();
  initOptionCards();
  initPillOptions();
  updateProgressUI();
  attachNavigation();
  attachTextInputListeners();
  attachProfileAutoSave();
  initFloatingWA();
});

/* ============================================================
   LOCAL STORAGE — AUTO-SAVE & RESTORE
   ============================================================ */
function persistState() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({
      answers: state.answers,
      profile: state.profile,
      currentStep: state.currentStep
    }));
  } catch (_) { /* storage unavailable — silent fail */ }
}

function restoreFromStorage() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.profile) state.profile = saved.profile;
    if (saved.answers) state.answers = saved.answers;

    // Restore text fields
    if (state.profile.nome)      { const el = $('name');      if (el) el.value = state.profile.nome; }
    if (state.profile.whatsapp)  { const el = $('whatsapp');  if (el) el.value = state.profile.whatsapp; }
    if (state.profile.cidade)    { const el = $('cidade');    if (el) el.value = state.profile.cidade; }
    if (state.profile.atividade) { const el = $('atividade'); if (el) el.value = state.profile.atividade; }
    if (state.profile.tempo)     { const el = $('tempo');     if (el) el.value = state.profile.tempo; }
  } catch (_) { /* ignore */ }
}

function clearStorage() {
  try { localStorage.removeItem(CONFIG.storageKey); } catch (_) {}
}

/* ============================================================
   OPTION CARDS (radio & checkbox)
   ============================================================ */
function initOptionCards() {
  $$('.option-card').forEach(card => {
    const input = card.querySelector('input');
    if (!input) return;

    // Restore checked state from saved answers
    const name = input.name;
    if (name && state.answers[name] !== undefined) {
      const saved = state.answers[name];
      if (input.type === 'radio' && input.value === saved) {
        input.checked = true;
        card.classList.add('selected');
      }
      if (input.type === 'checkbox' && Array.isArray(saved) && saved.includes(input.value)) {
        input.checked = true;
        card.classList.add('selected');
      }
    }

    card.addEventListener('click', () => {
      const n    = input.name;
      const type = input.type;

      if (type === 'radio') {
        $$(`input[name="${n}"]`).forEach(sib => {
          sib.closest('.option-card')?.classList.remove('selected');
        });
        input.checked = true;
        card.classList.add('selected');
      } else {
        input.checked = !input.checked;
        card.classList.toggle('selected', input.checked);
      }

      if (n) {
        saveAnswer(n, getGroupValue(n, type));
        persistState();
      }
    });
  });
}

/* ============================================================
   PILL OPTIONS (radio inline)
   ============================================================ */
function initPillOptions() {
  $$('.pill-option').forEach(pill => {
    const input = pill.querySelector('input');
    if (!input) return;

    // Restore
    const name = input.name;
    if (name && state.answers[name] !== undefined) {
      const saved = state.answers[name];
      if (input.type === 'radio' && input.value === saved) {
        input.checked = true;
        pill.classList.add('selected');
      }
    }

    pill.addEventListener('click', () => {
      const n    = input.name;
      const type = input.type;

      if (type === 'radio') {
        $$(`input[name="${n}"]`).forEach(sib => {
          sib.closest('.pill-option')?.classList.remove('selected');
        });
        input.checked = true;
        pill.classList.add('selected');
      } else {
        input.checked = !input.checked;
        pill.classList.toggle('selected', input.checked);
      }

      if (n) {
        saveAnswer(n, getGroupValue(n, type));
        persistState();
      }
    });
  });
}

function getGroupValue(name, type) {
  if (type === 'radio') {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : null;
  }
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
               .map(el => el.value);
}

function saveAnswer(key, value) {
  state.answers[key] = value;
}

/* ============================================================
   PROFILE SAVE
   ============================================================ */
function saveProfile() {
  state.profile.nome      = ($('name')?.value      || '').trim();
  state.profile.whatsapp  = ($('whatsapp')?.value  || '').trim();
  state.profile.cidade    = ($('cidade')?.value    || '').trim();
  state.profile.atividade = ($('atividade')?.value || '');
  state.profile.tempo     = ($('tempo')?.value     || '');
  persistState();
}

function attachProfileAutoSave() {
  ['name','whatsapp','cidade','atividade','tempo'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('blur',   saveProfile);
      el.addEventListener('change', saveProfile);
    }
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function attachNavigation() {
  $$('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      saveProfile();
      if (validateStep(state.currentStep)) goToStep(state.currentStep + 1);
    });
  });
  $$('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(state.currentStep - 1));
  });
  $$('[data-submit]').forEach(btn => {
    btn.addEventListener('click', handleSubmit);
  });
}

function attachTextInputListeners() {
  $$('.form-input, .form-select').forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const errEl = el.parentElement?.querySelector('.form-error');
      if (errEl) errEl.classList.remove('visible');
    });
  });
}

function goToStep(step) {
  if (step < 1 || step > state.totalSteps) return;

  $(`step${state.currentStep}`)?.classList.remove('active');
  state.currentStep = step;
  $(`step${state.currentStep}`)?.classList.add('active');

  // Dots
  $$('.step-dot').forEach((dot, i) => {
    const n = i + 1;
    dot.classList.toggle('completed', n < step);
    dot.classList.toggle('active',    n === step);
  });

  updateProgressUI();
  persistState();

  // Smooth scroll — form section on mobile
  const target = document.querySelector('.form-section') || document.querySelector('.step-progress');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateProgressUI() {
  // On last step (submit) show 100%
  const isLast = state.currentStep === state.totalSteps;
  const pct = isLast
    ? 100
    : ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
  const fill = document.querySelector('.step-track-fill');
  if (fill) fill.style.width = pct + '%';
}

/* ============================================================
   VALIDATION
   ============================================================ */
function validateStep(step) {
  let valid = true;

  const setError = (el, msg) => {
    if (!el) return;
    el.classList.add('error');
    const errEl = el.parentElement?.querySelector('.form-error');
    if (errEl) { if (msg) errEl.textContent = msg; errEl.classList.add('visible'); }
    if (!valid) return; // scroll only to first error
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    valid = false;
  };

  if (step === 1) {
    const nome = $('name');
    const wpp  = $('whatsapp');
    const atv  = $('atividade');

    if (!nome?.value.trim())  setError(nome, 'Por favor, informe seu nome.');
    if (!atv?.value)          setError(atv,  'Selecione sua atividade principal.');

    if (wpp) {
      const digits = wpp.value.replace(/\D/g, '');
      if (digits.length < 10) setError(wpp, 'Informe um WhatsApp válido com DDD.');
    }
  }

  return valid;
}

/* ============================================================
   SUBMIT
   ============================================================ */
async function handleSubmit() {
  if (state.submitted) return;
  saveProfile();
  saveAnswer('interesses', getGroupValue('interesses', 'checkbox'));
  saveAnswer('urgencia',   getGroupValue('urgencia',   'radio'));

  state.submitted = true;

  // Hide form, show processing
  const wrapper = $('formWrapper');
  const proc    = $('processingScreen');
  if (wrapper) wrapper.style.display = 'none';
  if (proc)    proc.classList.add('active');

  // Run processing animation then compute + show result
  await runProcessingAnimation();
  computeScores();
  showResults();

  // Fire-and-forget Supabase submission
  if (CONFIG.supabase.enabled) submitToSupabase();

  // Clear saved draft so the form is fresh next time
  clearStorage();
}

/* ============================================================
   PROCESSING ANIMATION
   ============================================================ */
function runProcessingAnimation() {
  return new Promise(resolve => {
    const steps = $$('.processing-step');
    let i = 0;

    function next() {
      if (i >= steps.length) {
        setTimeout(resolve, 400);
        return;
      }
      steps[i].classList.add('visible');
      setTimeout(() => {
        steps[i].classList.add('done');
        i++;
        setTimeout(next, 550);
      }, 750);
    }
    setTimeout(next, 300);
  });
}

/* ============================================================
   SCORING ENGINE
   ============================================================ */
function scoreGroup(keys) {
  const a = state.answers;
  let raw = 0, max = 0;
  keys.forEach(k => {
    const map = SCORING[k];
    if (!map) return;
    const maxVal = Math.max(...Object.values(map));
    max += maxVal;
    const val = a[k];
    if (val !== undefined && val !== null && map[val] !== undefined) raw += map[val];
  });
  return max > 0 ? Math.round((raw / max) * 100) : 50;
}

function computeScores() {
  state.scores.tributario     = scoreGroup(TRIB_KEYS);
  state.scores.previdenciario = scoreGroup(PREV_KEYS);
  state.scores.financeiro     = scoreGroup(FIN_KEYS);
  state.scores.geral = Math.round(
    state.scores.tributario     * 0.40 +
    state.scores.previdenciario * 0.30 +
    state.scores.financeiro     * 0.30
  );

  // If user answered nothing at all (demo / preview), show a realistic mid-low sample
  const totalAnswers = Object.keys(state.answers).length;
  if (totalAnswers === 0) {
    state.scores = { tributario: 38, previdenciario: 42, financeiro: 29, geral: 36 };
  }
}

/* ============================================================
   CLASSIFICATION
   ============================================================ */
function getClassification(score) {
  if (score >= 75) return {
    key: 'organizado',
    label: '✦ Perfil Organizado',
    tagline: 'Você já possui uma boa base tributária. Vamos identificar como otimizar ainda mais.',
    color: '#4FC59A'
  };
  if (score >= 50) return {
    key: 'desenvolvimento',
    label: '◈ Perfil em Desenvolvimento',
    tagline: 'Há pontos importantes que merecem atenção e oportunidades claras a explorar.',
    color: '#E0C068'
  };
  if (score >= 30) return {
    key: 'atencao',
    label: '⚠ Perfil de Atenção',
    tagline: 'Identificamos riscos que podem impactar seu futuro financeiro e previdenciário.',
    color: '#FBC96B'
  };
  return {
    key: 'prioritario',
    label: '⬤ Perfil Prioritário',
    tagline: 'Sua situação requer orientação especializada com urgência.',
    color: '#F88888'
  };
}

/* ============================================================
   RESULT SCREEN
   ============================================================ */
function showResults() {
  const proc   = $('processingScreen');
  const result = $('resultScreen');
  if (proc)   proc.classList.remove('active');
  if (result) result.classList.add('active');

  const s      = state.scores;
  const nome   = state.profile.nome || 'Profissional';
  const first  = nome.split(' ')[0];
  const classif = getClassification(s.geral);

  // ── Score ring ──────────────────────────────────────────
  const circle = document.querySelector('.score-ring-fill');
  if (circle) {
    const circumference = 2 * Math.PI * 70; // r=70 → ≈ 439.8
    const offset = circumference - (s.geral / 100) * circumference;
    // Trigger after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { circle.style.strokeDashoffset = offset; });
    });
  }

  // ── Score counter ────────────────────────────────────────
  animateNumber($('scoreValue'), 0, s.geral, 1500);

  // ── Classification badge ─────────────────────────────────
  const classifEl = $('scoreClassification');
  if (classifEl) {
    classifEl.textContent = classif.label;
    classifEl.className   = `result-classification classification-${classif.key}`;
  }

  // ── Sub-scores ───────────────────────────────────────────
  setSubScore('tribScore', s.tributario);
  setSubScore('prevScore', s.previdenciario);
  setSubScore('finScore',  s.financeiro);

  // Animate bars after a small delay so transition fires
  setTimeout(animateSubBars, 300);

  // ── Text content ─────────────────────────────────────────
  const nomeEl = $('resultNome');
  if (nomeEl) nomeEl.textContent = first;
  const tagEl  = $('resultTagline');
  if (tagEl) tagEl.textContent = classif.tagline;
  const recEl  = $('recommendationText');
  if (recEl) recEl.textContent = buildRecommendation(s, state.answers, classif);

  // ── Lists ─────────────────────────────────────────────────
  renderList('opportunitiesList', buildOpportunities(s, state.answers), 'opportunity');
  renderList('positivesList',     buildPositives(s, state.answers),     'positive');
  renderList('attentionList',     buildAttentions(s, state.answers),    'warning');

  // ── WhatsApp links ────────────────────────────────────────
  const waMsg  = buildWhatsAppMessage(nome, s, classif, state.profile);
  const waLink = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(waMsg)}`;
  $$('.btn-whatsapp, .btn-wa-secondary, .fab-wa').forEach(btn => {
    btn.href = waLink;
  });

  // ── Floating button ───────────────────────────────────────
  showFloatingWA();

  // ── Staggered card animations ─────────────────────────────
  staggerResultCards();

  // ── Scroll ────────────────────────────────────────────────
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Sub-score helper */
function setSubScore(containerId, value) {
  const el = $(containerId);
  if (!el) return;
  const bar = el.querySelector('.sub-score-bar');
  const val = el.querySelector('.sub-score-value');
  if (bar) bar.dataset.pct = value;
  if (val) animateNumber(val, 0, value, 1300);
}

/* Sub-score bar animation — reads data-pct set by setSubScore */
function animateSubBars() {
  $$('.sub-score-bar').forEach(bar => {
    const pct = parseInt(bar.dataset.pct || '0', 10);
    bar.style.width = pct + '%';
  });
}

/* Number count-up */
function animateNumber(el, from, to, duration) {
  if (!el) return;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* Stagger result sections */
function staggerResultCards() {
  const cards = $$('.result-section, .recommendation-box');
  cards.forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(16px)';
    card.style.transition = `opacity 0.45s ease ${i * 120}ms, transform 0.45s ease ${i * 120}ms`;
    setTimeout(() => {
      card.style.opacity   = '1';
      card.style.transform = 'none';
    }, 80 + i * 120);
  });
}

/* ============================================================
   CONTENT GENERATORS
   ============================================================ */
function buildPositives(s, a) {
  const list = [];
  if (s.tributario >= 60)     list.push('Você demonstra consciência sobre suas obrigações fiscais e tributárias.');
  if (s.previdenciario >= 60) list.push('Sua contribuição previdenciária está em bom caminho para garantir seus direitos futuros.');
  if (s.financeiro >= 60)     list.push('Você possui um nível satisfatório de organização financeira.');
  if (a.controle_receita && a.controle_receita !== 'nao')
    list.push('Você realiza controle das suas receitas — hábito fundamental para autônomos.');
  if (['sim_estrategia','sim_inss'].includes(a.aposentadoria_planeja))
    list.push('Você já pensa na aposentadoria, o que representa uma vantagem significativa.');
  if (a.ir_declaracao === 'sim_regular')
    list.push('Sua declaração do Imposto de Renda está em dia — isso evita multas e pendências.');
  if (a.mei_situacao === 'ativo_dia')
    list.push('Seu MEI está ativo e regularizado, garantindo acesso a benefícios previdenciários.');
  if (list.length === 0)
    list.push('Ao buscar este diagnóstico você já demonstra iniciativa — o primeiro passo para a organização financeira.');
  return list;
}

function buildAttentions(s, a) {
  const list = [];
  if (s.tributario < 50)
    list.push('Existem lacunas nas obrigações tributárias que precisam ser regularizadas para evitar penalidades.');
  if (s.previdenciario < 50)
    list.push('Contribuição previdenciária irregular pode comprometer sua aposentadoria e benefícios por afastamento.');
  if (s.financeiro < 50)
    list.push('Organização financeira insuficiente cria vulnerabilidade em períodos de baixa renda — comum para autônomos.');
  if (['alta','critica'].includes(a.dividas))
    list.push('Endividamento elevado exige estratégia urgente de renegociação antes que os juros comprometam sua renda.');
  if (a.ir_declaracao === 'nao_deveria')
    list.push('A omissão na declaração do IR representa risco real de multas retroativas e bloqueio de CPF na Receita Federal.');
  if (a.reforma_conhecimento === 'nao')
    list.push('Desconhecer a Reforma Tributária (CBS/IBS) pode resultar em surpresas fiscais nos próximos anos.');
  if (a.mei_situacao === 'ativo_pendente')
    list.push('MEI com pendências (DAS em atraso ou declarações não enviadas) está sujeito a cancelamento e perda de benefícios.');
  if (a.reserva_emergencia === 'nao')
    list.push('Ausência de reserva de emergência é o principal fator de risco financeiro para trabalhadores autônomos.');
  if (list.length === 0)
    list.push('Mantenha atenção constante às obrigações fiscais e previdenciárias para preservar sua situação atual.');
  return list;
}

function buildOpportunities(s, a) {
  const list = [];
  list.push('A Reforma Tributária pode simplificar obrigações e abrir espaço para redução legal de carga fiscal para autônomos e MEIs.');
  if (a.mei_situacao === 'deveria')
    list.push('A formalização como MEI pode reduzir sua carga tributária imediatamente e garantir INSS, auxílio-doença e aposentadoria.');
  if (s.previdenciario < 60)
    list.push('Um planejamento previdenciário adequado pode antecipar sua aposentadoria e aumentar seu benefício mensal.');
  if (s.financeiro < 70)
    list.push('Com organização financeira estruturada, é possível aumentar sua capacidade de poupança em até 30% sem reduzir gastos essenciais.');
  if (a.ir_declaracao === 'nao_isento')
    list.push('Mesmo isento, a declaração voluntária do IR pode gerar restituição e comprovar renda para financiamentos e crédito.');
  list.push('A revisão do seu enquadramento tributário pode gerar economia imediata nas obrigações fiscais mensais.');
  if (a.reforma_conhecimento !== 'sim_bem')
    list.push('Com orientação especializada sobre a Reforma Tributária, você pode se posicionar antes das novas regras entrarem em vigor.');
  return list;
}

function buildRecommendation(s, a, classif) {
  const labelClean = classif.label.replace(/[✦◈⚠⬤]\s*/g, '');
  const intro = `Com base nas suas respostas, seu índice geral de organização é de ${s.geral}/100 — classificado como "${labelClean}". `;
  const suffix = ` Para receber sua análise completa e personalizada, entre em contato com ${CONFIG.consultorNome} pelo WhatsApp — o diagnóstico completo e a primeira orientação são gratuitos.`;

  if (s.geral >= 75)
    return intro + `Seu perfil demonstra uma base sólida. O próximo passo é otimizar sua estrutura tributária e previdenciária para maximizar benefícios — especialmente diante das mudanças da Reforma Tributária.` + suffix;
  if (s.geral >= 50)
    return intro + `Há oportunidades claras de melhoria nas três áreas avaliadas. Com orientação especializada, é possível regularizar pendências, reduzir riscos e estruturar um planejamento que proteja sua renda e seu futuro.` + suffix;
  if (s.geral >= 30)
    return intro + `Foram identificados riscos significativos que merecem atenção imediata. Pendências tributárias e previdenciárias podem acumular multas e afetar seus direitos. Recomendamos fortemente uma conversa com o consultor ainda esta semana.` + suffix;
  return intro + `A situação identificada requer intervenção especializada com urgência. Riscos tributários, previdenciários e financeiros combinados podem comprometer seriamente sua estabilidade. Entre em contato hoje mesmo para uma avaliação completa e gratuita.` + suffix;
}

function buildWhatsAppMessage(nome, scores, classif, profile) {
  const labelClean = classif.label.replace(/[✦◈⚠⬤]\s*/g, '');
  const atv = profile.atividade
    ? `\n*Atividade:* ${profile.atividade}`
    : '';
  const cid = profile.cidade
    ? `\n*Cidade:* ${profile.cidade}`
    : '';

  return [
    `Olá, ${CONFIG.consultorNome}! Acabei de concluir o Diagnóstico Tributário no seu site.`,
    ``,
    `*👤 Meu Perfil*`,
    `*Nome:* ${nome}${atv}${cid}`,
    ``,
    `*📊 Resultados do Diagnóstico*`,
    `*Índice Geral:* ${scores.geral}/100`,
    `*Classificação:* ${labelClean}`,
    ``,
    `• Tributário: ${scores.tributario}/100`,
    `• Previdenciário: ${scores.previdenciario}/100`,
    `• Financeiro: ${scores.financeiro}/100`,
    ``,
    `Gostaria de receber meu diagnóstico completo e entender como posso melhorar minha situação. Pode me ajudar?`
  ].join('\n');
}

/* ============================================================
   RENDER LIST
   ============================================================ */
function renderList(id, items, type = 'positive') {
  const el = $(id);
  if (!el) return;

  const icons = {
    positive:    `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1A936F" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
    warning:     `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#D97706" stroke-width="2.5" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    opportunity: `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" stroke-width="2.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  };

  const cssClass = {
    positive:    'result-item-positive',
    warning:     'result-item-warning',
    opportunity: 'result-item-opportunity'
  }[type] || 'result-item-positive';

  el.innerHTML = items
    .map(text => `
      <div class="result-item ${cssClass}">
        ${icons[type]}
        <span>${text}</span>
      </div>`)
    .join('');
}

/* ============================================================
   FLOATING WHATSAPP BUTTON
   ============================================================ */
function initFloatingWA() {
  // Created in HTML; hidden until results show
  const fab = $('fabWA');
  if (fab) fab.style.display = 'none';
}

function showFloatingWA() {
  const fab = $('fabWA');
  if (!fab) return;
  fab.style.display = 'flex';
  requestAnimationFrame(() => { fab.classList.add('fab-visible'); });
}

/* ============================================================
   PHONE MASK
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const wpp = $('whatsapp');
  if (!wpp) return;
  wpp.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if      (v.length > 7) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) v = `(${v}`;
    this.value = v;
  });
});

/* ============================================================
   SUPABASE INTEGRATION (fire-and-forget)
   ============================================================ */
async function submitToSupabase() {
  const { url, anonKey, table } = CONFIG.supabase;
  try {
    await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({
        nome:           state.profile.nome,
        whatsapp:       state.profile.whatsapp,
        cidade:         state.profile.cidade,
        atividade:      state.profile.atividade,
        tempo_atividade:state.profile.tempo,
        score_geral:    state.scores.geral,
        score_trib:     state.scores.tributario,
        score_prev:     state.scores.previdenciario,
        score_fin:      state.scores.financeiro,
        classificacao:  getClassification(state.scores.geral).key,
        respostas:      JSON.stringify(state.answers),
        interesses:     JSON.stringify(state.answers.interesses || []),
        urgencia:       state.answers.urgencia || null,
        criado_em:      new Date().toISOString()
      })
    });
  } catch (err) {
    // Never block the user — log silently
    console.warn('[Supabase] Lead submission failed:', err.message);
  }
}
