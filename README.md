# Diagnóstico Tributário Premium
### Renato Saraiva — Consultor Tributário

---

## Visão Geral

Formulário de geração de leads qualificados com diagnóstico tributário, previdenciário e financeiro. Desenvolvido em HTML5 + CSS3 + JavaScript puro — sem dependências externas.

**Arquivos entregues**
```
index.html   → Estrutura completa (5 etapas + resultado)
styles.css   → Design system premium (inclua na mesma pasta)
app.js       → Lógica, scoring, animações e integrações
README.md    → Este arquivo
```

---

## Deploy Rápido

### Opção 1 — Vercel (recomendado, gratuito)

1. Crie uma conta em [vercel.com](https://vercel.com)
2. Clique em **Add New → Project**
3. Faça upload dos 3 arquivos (index.html, styles.css, app.js)
4. Clique em **Deploy**
5. Pronto — você recebe uma URL pública em segundos

### Opção 2 — Netlify (gratuito)

1. Acesse [netlify.com](https://netlify.com)
2. Arraste a **pasta** com os 3 arquivos para a área de drop
3. URL gerada instantaneamente

### Opção 3 — Hospedagem própria / cPanel

1. Acesse o Gerenciador de Arquivos do seu painel
2. Navegue até `public_html` (ou subpasta desejada)
3. Faça upload dos 3 arquivos
4. Acesse pelo domínio configurado

---

## Integração com Supabase (captura de leads no banco)

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → New Project
2. Anote a **URL do projeto** e a **anon key** (Settings → API)

### 2. Criar tabela de leads

Execute no **SQL Editor** do Supabase:

```sql
create table leads_diagnostico (
  id              uuid default gen_random_uuid() primary key,
  nome            text,
  whatsapp        text,
  cidade          text,
  atividade       text,
  tempo_atividade text,
  score_geral     int,
  score_trib      int,
  score_prev      int,
  score_fin       int,
  classificacao   text,
  respostas       jsonb,
  interesses      jsonb,
  urgencia        text,
  criado_em       timestamptz default now()
);

-- Permite inserção pública (sem autenticação)
alter table leads_diagnostico enable row level security;

create policy "Inserção pública de leads"
  on leads_diagnostico for insert
  with check (true);
```

### 3. Ativar no app.js

Abra `app.js` e localize o objeto `CONFIG` (topo do arquivo):

```js
supabase: {
  enabled: false,           // ← mude para true
  url: 'https://SEU-PROJETO.supabase.co',   // ← cole sua URL
  anonKey: 'SUA-CHAVE-ANON',               // ← cole sua anon key
  table: 'leads_diagnostico'
},
```

Salve e faça re-upload do `app.js`. A partir deste momento cada diagnóstico concluído cria um registro na tabela.

---

## Integração com Firebase (alternativa ao Supabase)

Substitua a função `submitToSupabase()` no final do `app.js`:

```js
async function submitToSupabase() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = initializeApp({
    apiKey: "SUA-API-KEY",
    projectId: "SEU-PROJETO"
  });

  const db = getFirestore(app);
  await addDoc(collection(db, 'leads_diagnostico'), {
    ...state.profile,
    ...state.scores,
    respostas: state.answers,
    criadoEm: new Date()
  });
}
```

---

## Personalização

### Trocar número do WhatsApp

Em `app.js`, linha 10:
```js
whatsapp: '5581995041947',  // DDI + DDD + número (só dígitos)
```

### Alterar nome do consultor

```js
consultorNome: 'Renato Saraiva',
```

### Trocar imagem do hero

Em `index.html`, procure a tag `<img` dentro de `.hero-visual` e substitua o `src`:
```html
<img src="URL-DA-SUA-IMAGEM" alt="Descrição" ... />
```

### Modificar perguntas

Cada etapa é um `<div id="stepN" class="form-step">`. Adicione novas opções seguindo o padrão:
```html
<label class="option-card">
  <input type="radio" name="NOME_DA_PERGUNTA" value="VALOR" />
  <div class="option-indicator"><div class="option-indicator-dot"></div></div>
  <div class="option-text">
    <div class="option-label">Texto da opção</div>
  </div>
</label>
```
Depois adicione o peso correspondente em `app.js` dentro de `SCORING`:
```js
NOME_DA_PERGUNTA: { VALOR: 15, outro_valor: 5 }
```

### Ajustar pesos do score geral

Em `app.js`, função `computeScores()`:
```js
state.scores.geral = Math.round(
  state.scores.tributario     * 0.40 +  // 40%
  state.scores.previdenciario * 0.30 +  // 30%
  state.scores.financeiro     * 0.30    // 30%
);
```

---

## Estrutura de Scoring

| Dimensão        | Perguntas avaliadas                                   | Peso |
|-----------------|-------------------------------------------------------|------|
| Tributário      | IR, controle de receita, notas fiscais, MEI, Reforma  | 40%  |
| Previdenciário  | INSS, aposentadoria, proteção familiar                | 30%  |
| Financeiro      | Reserva, dívidas, poupança, orçamento                 | 30%  |

**Classificações**
| Faixa    | Perfil               |
|----------|----------------------|
| 75–100   | Perfil Organizado    |
| 50–74    | Perfil em Desenvolvimento |
| 30–49    | Perfil de Atenção    |
| 0–29     | Perfil Prioritário   |

---

## SEO & Performance

- Meta tags básicas já configuradas (title, description, og:title, og:image)
- Fontes carregadas com `preconnect` para reduzir latência
- Imagem hero com `loading="eager"` e dimensões explícitas (evita CLS)
- JavaScript no final do body (não bloqueia renderização)
- Código sem dependências externas além das fontes Google

**Para melhorar ainda mais:**
- Adicione Google Analytics / Meta Pixel antes de `</head>`
- Configure domínio personalizado no Vercel/Netlify
- Adicione `og:url` com a URL final do site

---

## Suporte

Desenvolvido como solução completa de geração de leads para consultoria tributária.  
Qualquer dúvida sobre personalização ou deploy, entre em contato.

**Renato Saraiva — Consultor Tributário**  
WhatsApp: (81) 99504-1947  
Zona da Mata Norte · Pernambuco
