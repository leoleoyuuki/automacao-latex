# ⚡ Fabiola-Tex — Gerador de Laudos Periciais em LaTeX (Cloud Run)

Microserviço em **Node.js (Express)** com o motor **Tectonic (LaTeX)** embutido, desenhado especificamente para compilar Laudos Periciais Judiciais em PDF com qualidade forense de alto padrão e custo R$ 0,00 no **Google Cloud Run**.

---

## 📁 Estrutura do Projeto

```
fabiola-Tex/
├── Dockerfile            # Container pronto para Google Cloud Run / Railway com Tectonic
├── .dockerignore         # Ignora arquivos temporários e node_modules
├── package.json          # Dependências Express, CORS, etc.
├── index.js              # Servidor com injeção de variáveis e compilação do .tex
├── template_laudo.tex    # Template LaTeX forense profissional
├── test-payload.json     # Exemplo de payload para testes locais
└── README.md             # Instruções de uso e deploy
```

---

## 🛠️ Como Funciona o Fluxo

1. O **VistoriaPro** (ou Google Apps Script / Make.com) faz uma requisição `POST` com os dados da vistoria e as fotos em Base64.
2. O servidor injeta as variáveis no `template_laudo.tex`, monta as tabelas e a galeria fotográfica de 2 colunas.
3. O compilador **Tectonic** compila o código LaTeX e gera o PDF final em aproximadamente **1 segundo**.
4. O servidor devolve o arquivo **PDF binário** ou em **Base64** para ser salvo diretamente no Google Drive da cliente.

---

## 🚀 Como Fazer o Deploy no Google Cloud Run (Grátis)

O Google Cloud Run permite rodar containers de forma **100% serverless** (ele só é cobrado nos 2 segundos de compilação e dá **2 milhões de requisições gratuitas por mês**).

### Opção 1: Via Google Cloud CLI (`gcloud`)

No terminal, dentro da pasta `fabiola-Tex`:

```bash
# 1. Faça login na sua conta do Google Cloud (se ainda não fez)
gcloud auth login

# 2. Defina seu projeto ativo
gcloud config set project SEU_PROJECT_ID

# 3. Faça o deploy em 1 comando (o Cloud Run compilará o Dockerfile automaticamente)
gcloud run deploy fabiola-tex \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```

Ao finalizar, ele fornecerá uma URL pública como:
`https://fabiola-tex-xxxx-uc.a.run.app`

---

### Opção 2: Deploy no Railway ou Render (Alternativa em 2 cliques)

1. Crie um repositório no GitHub com esta pasta `fabiola-Tex`.
2. Acesse o [Railway.app](https://railway.app) ou [Render.com](https://render.com).
3. Conecte o repositório. Ele detectará o `Dockerfile` automaticamente e subirá o serviço com HTTPS ativo.

---

## 🧪 Como Testar a API

### 1. Teste de Saúde (Health Check)
```bash
GET https://sua-url-cloud-run.a.run.app/health
# Retorno: OK
```

### 2. Gerar Laudo em PDF
```bash
curl -X POST https://sua-url-cloud-run.a.run.app/gerar-laudo \
  -H "Content-Type: application/json" \
  -d @test-payload.json \
  --output laudo_teste.pdf
```

Para receber em formato JSON com Base64:
```bash
POST https://sua-url-cloud-run.a.run.app/gerar-laudo?format=base64
```

---

## 📄 Personalização do Template LaTeX

O arquivo `template_laudo.tex` pode ser aberto e editado no **Overleaf** ou em qualquer editor LaTeX a qualquer momento para personalizar:
* Cabeçalhos e brasões do Tribunal de Justiça.
* Cores da identidade visual (`\definecolor{primary}{...}`).
* Assinatura do Perito e dados do CREA / CAU.
"# automacao-latex" 
