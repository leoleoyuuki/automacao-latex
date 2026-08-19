# Usar imagem Node.js oficial slim
FROM node:20-slim

# Instala dependências do sistema e o motor Tectonic (Compilador LaTeX moderno e leve)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu72 \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/ \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Diretório da aplicação
WORKDIR /app

# Copia arquivos de dependências e instala
COPY package*.json ./
RUN npm install --omit=dev

# Copia o código da aplicação e o template LaTeX
COPY . .

# Porta padrão exigida pelo Google Cloud Run
ENV PORT=8080
EXPOSE 8080

# Executa o servidor Node
CMD ["node", "index.js"]
