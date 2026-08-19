import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const app = express();

app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Helper: Escape special LaTeX characters in user input strings
function escapeLatex(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[%$&_#{}]/g, '\\$&')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}');
}

// Helper: Generate appliance table in LaTeX
function buildApplianceTableLatex(data) {
  const appliances = [
    { name: 'Lâmpadas em Uso', qty: data.numLampadas || '0' },
    { name: 'Aparelhos de TV', qty: data.numTvs || '0' },
    { name: 'Ventiladores de Mesa/Chão', qty: data.numVentiladores || '0' },
    { name: 'Ventiladores de Teto', qty: data.numVentiladoresTeto || '0' },
    { name: 'Aparelhos de Ar-Condicionado', qty: data.numArCondicionados || '0' },
    { name: 'Geladeiras / Refrigeradores', qty: data.numGeladeiras || '0' },
    { name: 'Chuveiros Elétricos', qty: data.numChuveiros || '0' },
    { name: 'Máquinas de Lavar Roupa', qty: data.numMaquinasLavar || '0' },
    { name: 'Freezers Verticais/Horizontais', qty: data.numFreezers || '0' }
  ];

  let latex = `\\begin{table}[H]\n\\centering\n\\begin{tabularx}{\\textwidth}{@{}X c@{}}\n\\toprule\n\\textbf{Equipamento / Aparelho} & \\textbf{Quantidade Constatada} \\\\\n\\midrule\n`;
  
  appliances.forEach(item => {
    latex += `${escapeLatex(item.name)} & ${escapeLatex(item.qty)} \\\\\n`;
  });

  latex += `\\bottomrule\n\\end{tabularx}\n\\end{table}`;
  return latex;
}

// Helper: Generate checklist items in LaTeX
function buildChecklistLatex(checklist) {
  if (!checklist || (Array.isArray(checklist) && checklist.length === 0)) {
    return '\\item \\textit{Nenhum item específico apontado no checklist.}';
  }

  const items = Array.isArray(checklist) ? checklist : [checklist];
  return items.map(item => `\\item \\textbf{Item Constatado:} ${escapeLatex(item)} (Conforme/Registrado)`).join('\n');
}

// Helper: Generate photo subfigures in LaTeX (2 photos per row)
function buildPhotoGridLatex(photoFilenames, labelPrefix) {
  if (!photoFilenames || photoFilenames.length === 0) {
    return '\\textit{Nenhuma fotografia anexada nesta seção.}';
  }

  let latex = '';
  for (let i = 0; i < photoFilenames.length; i += 2) {
    const photo1 = photoFilenames[i];
    const photo2 = photoFilenames[i + 1];

    latex += `\\begin{figure}[H]\n\\centering\n`;
    latex += `\\begin{subfigure}{0.48\\textwidth}\n`;
    latex += `  \\centering\n`;
    latex += `  \\includegraphics[width=\\linewidth,height=5.5cm,keepaspectratio]{${photo1.path}}\n`;
    latex += `  \\caption{${escapeLatex(labelPrefix)} — Foto ${String(i + 1).padStart(2, '0')}}\n`;
    latex += `\\end{subfigure}\n`;

    if (photo2) {
      latex += `\\hfill\n`;
      latex += `\\begin{subfigure}{0.48\\textwidth}\n`;
      latex += `  \\centering\n`;
      latex += `  \\includegraphics[width=\\linewidth,height=5.5cm,keepaspectratio]{${photo2.path}}\n`;
      latex += `  \\caption{${escapeLatex(labelPrefix)} — Foto ${String(i + 2).padStart(2, '0')}}\n`;
      latex += `\\end{subfigure}\n`;
    }

    latex += `\\end{figure}\n\n`;
  }

  return latex;
}

// Configura o diretório de cache do Tectonic para o /tmp (exigência da Vercel)
process.env.TECTONIC_CACHE_DIR = path.join(os.tmpdir(), 'tectonic-cache');

// Identifica o executável do Tectonic (Windows local ou Linux na Vercel/Cloud Run)
function getTectonicCommand() {
  if (process.platform === 'win32') {
    const localWinBin = path.join(process.cwd(), 'bin', 'tectonic.exe');
    if (fs.existsSync(localWinBin)) return `"${localWinBin}"`;
    return 'tectonic';
  } else {
    // Linux / Vercel Serverless
    const linuxBin = path.join(process.cwd(), 'bin', 'tectonic-linux');
    if (fs.existsSync(linuxBin)) {
      try {
        fs.chmodSync(linuxBin, 0o755);
      } catch (chmodErr) {
        console.warn('Aviso chmod:', chmodErr.message);
      }
      return `"${linuxBin}"`;
    }
    return 'tectonic';
  }
}

// 1. Health Check
app.get('/', (req, res) => {
  res.json({
    service: 'VistoriaPro LaTeX Compiler Engine',
    status: 'online',
    runtime: process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Standalone',
    endpoints: {
      health: 'GET /health',
      compile: 'POST /gerar-laudo'
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 2. Endpoint Principal: Compilação de Laudo em LaTeX para PDF
app.post('/gerar-laudo', async (req, res) => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laudo-'));
  const photosDir = path.join(workDir, 'fotos');
  fs.mkdirSync(photosDir, { recursive: true });

  try {
    const data = req.body || {};
    console.log(`[${new Date().toISOString()}] Recebida requisição para gerar laudo: ${data.nomeAutor || 'Sem Nome'} | Proc: ${data.numeroProcesso || 'S/N'}`);

    // Processa Fotos do Imóvel
    const fotosImovelFiles = [];
    if (data.photosImovel && Array.isArray(data.photosImovel)) {
      data.photosImovel.forEach((photo, idx) => {
        const ext = (photo.name || 'foto.jpeg').split('.').pop() || 'jpeg';
        const filename = `imovel_${String(idx + 1).padStart(2, '0')}.${ext}`;
        const filePath = path.join(photosDir, filename);

        if (photo.base64) {
          const base64Clean = photo.base64.replace(/^data:image\/\w+;base64,/, '');
          fs.writeFileSync(filePath, Buffer.from(base64Clean, 'base64'));
          fotosImovelFiles.push({ path: `fotos/${filename}` });
        }
      });
    }

    // Processa Fotos do Medidor
    const fotosMedidorFiles = [];
    if (data.photosMedidor && Array.isArray(data.photosMedidor)) {
      data.photosMedidor.forEach((photo, idx) => {
        const ext = (photo.name || 'foto.jpeg').split('.').pop() || 'jpeg';
        const filename = `medidor_${String(idx + 1).padStart(2, '0')}.${ext}`;
        const filePath = path.join(photosDir, filename);

        if (photo.base64) {
          const base64Clean = photo.base64.replace(/^data:image\/\w+;base64,/, '');
          fs.writeFileSync(filePath, Buffer.from(base64Clean, 'base64'));
          fotosMedidorFiles.push({ path: `fotos/${filename}` });
        }
      });
    }

    // Lê o template LaTeX base
    const templatePath = path.join(process.cwd(), 'template_laudo.tex');
    let texContent = fs.readFileSync(templatePath, 'utf-8');

    // Substituição de Variáveis no Template
    texContent = texContent
      .replace(/{{NUMERO_PROCESSO}}/g, escapeLatex(data.numeroProcesso || '0000000-00.0000.0.00.0000'))
      .replace(/{{TIPO_ACAO}}/g, escapeLatex(data.tipoAcao || 'Perícia Técnica de Consumo'))
      .replace(/{{NOME_AUTOR}}/g, escapeLatex(data.nomeAutor || 'Autor(a) Não Informado'))
      .replace(/{{REU_CONCESSIONARIA}}/g, escapeLatex(data.reuConcessionaria || 'Concessionária Ré'))
      .replace(/{{DATA_VISTORIA}}/g, escapeLatex(data.dataVistoria || new Date().toLocaleDateString('pt-BR')))
      .replace(/{{NUMERO_VISTORIA}}/g, escapeLatex(data.numeroVistoria || '1'))
      .replace(/{{PERIODO_VISTORIA}}/g, escapeLatex(data.periodoVistoria || 'Horário Comercial'))
      .replace(/{{REPRESENTACAO_AUTOR}}/g, escapeLatex(data.representacaoAutor || 'Presente'))
      .replace(/{{REPRESENTACAO_REU}}/g, escapeLatex(data.representacaoReu || 'Presente'))
      .replace(/{{OBSERVACOES_PRESENCA}}/g, escapeLatex(data.observacoesPresenca || 'As partes acompanharam integralmente a diligência.'))
      .replace(/{{NUMERO_MEDIDOR}}/g, escapeLatex(data.numeroMedidor || 'Não identificado'))
      .replace(/{{MEDIDOR_CHIP}}/g, escapeLatex(data.medidorChip || 'Não'))
      .replace(/{{CONDICOES_MEDIDOR}}/g, escapeLatex(data.condicoesMedidor || 'Lacrado'))
      .replace(/{{CORTE_ENERGIA}}/g, escapeLatex(data.corteEnergia || 'Não'))
      .replace(/{{QTD_PESSOAS}}/g, escapeLatex(data.qtdPessoas || '1'))
      .replace(/{{QTD_COMODOS}}/g, escapeLatex(data.qtdComodos || '1'))
      .replace(/{{TABELA_ELETRODOMESTICOS}}/g, buildApplianceTableLatex(data))
      .replace(/{{CHECKLIST_ITENS}}/g, buildChecklistLatex(data.checklist))
      .replace(/{{OBSERVACOES_FINAIS}}/g, escapeLatex(data.observacoesFinais || 'Sem observações adicionais.'))
      .replace(/{{FOTOS_IMOVEL_LATEX}}/g, buildPhotoGridLatex(fotosImovelFiles, 'Imóvel'))
      .replace(/{{FOTOS_MEDIDOR_LATEX}}/g, buildPhotoGridLatex(fotosMedidorFiles, 'Medidor'));

    // Salva o arquivo final .tex no diretório temporário
    const texFilePath = path.join(workDir, 'laudo.tex');
    fs.writeFileSync(texFilePath, texContent, 'utf-8');

    const tectonicCmd = getTectonicCommand();
    console.log(`[Tectonic] Iniciando compilação do arquivo: ${texFilePath}`);
    
    // Tectonic compila e faz download automático de pacotes necessários
    await execPromise(`${tectonicCmd} laudo.tex --outdir .`, { cwd: workDir });

    const pdfFilePath = path.join(workDir, 'laudo.pdf');
    if (!fs.existsSync(pdfFilePath)) {
      throw new Error('O arquivo laudo.pdf não foi gerado pelo compilador.');
    }

    const pdfBuffer = fs.readFileSync(pdfFilePath);
    console.log(`[Sucesso] Laudo PDF compilado com sucesso (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // Opção de retorno: se requisitado formato base64 no header/query ou download direto
    if (req.query.format === 'base64') {
      res.json({
        status: 'sucesso',
        filename: `Laudo_${data.numeroVistoria || '1'}_${(data.nomeAutor || 'Autor').replace(/\s+/g, '_')}.pdf`,
        pdfBase64: pdfBuffer.toString('base64'),
        texContent: texContent
      });
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Laudo_${data.numeroVistoria || '1'}.pdf"`);
      res.send(pdfBuffer);
    }

  } catch (error) {
    console.error('[Erro na Compilação LaTeX]:', error);
    res.status(500).json({
      status: 'erro',
      mensagem: 'Falha ao compilar laudo em LaTeX.',
      detalhes: error.message,
      stderr: error.stderr || null
    });
  } finally {
    // Limpeza segura dos arquivos temporários
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (cleanErr) {
      console.error('Erro ao limpar diretório temporário:', cleanErr);
    }
  }
});

// Inicialização de porta para modo standalone / local
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`⚡ Servidor LaTeX rodando na porta ${PORT}`);
  });
}

export default app;
