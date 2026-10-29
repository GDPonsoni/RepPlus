import { asyncHandler, upload, HttpError } from '../http.js';
import { exigirPermissao } from '../auth/permissoes.js';
import { uploadImage, deleteImage } from '../storage.js';
import { ConfigStore, PERSONALIZACAO_PADRAO, OPCOES_PERSONALIZACAO } from './store.js';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const LIMITE_TEXTO = { nome: 40, slogan: 80 };

// Valida os campos de personalização presentes no corpo (nome vazio volta ao padrão; frase vazia some do rodapé)
function lerPersonalizacao(body) {
  const dados = {};
  for (const [campo, limite] of Object.entries(LIMITE_TEXTO)) {
    if (body[campo] === undefined) continue;
    const valor = String(body[campo] ?? '').trim();
    if (valor.length > limite) throw new HttpError(400, `${campo} pode ter no máximo ${limite} caracteres.`);
    dados[campo] = campo === 'nome' ? (valor || PERSONALIZACAO_PADRAO.nome) : valor;
  }
  for (const [campo, opcoes] of Object.entries(OPCOES_PERSONALIZACAO)) {
    if (body[campo] === undefined) continue;
    if (!opcoes.includes(body[campo])) throw new HttpError(400, `Valor inválido em ${campo}. Use: ${opcoes.join(', ')}.`);
    dados[campo] = body[campo];
  }
  if (body.fundoVisibilidade !== undefined) {
    const valor = Number(body.fundoVisibilidade);
    if (!Number.isInteger(valor) || valor < 0 || valor > 60) throw new HttpError(400, 'fundoVisibilidade deve ser um inteiro de 0 a 60.');
    dados.fundoVisibilidade = valor;
  }
  return dados;
}

// Aparência da república: nome, cores, logo, fundo e estilo
export default {
  id: 'configuracao',
  nome: 'Configuração',
  nucleo: true,
  permissoes: {
    'aparencia:gerenciar': { descricao: 'Alterar nome, cores, logo, fundo e estilo da interface', papeis: [] }
  },

  rotas(router) {
    // Leitura livre: a tela precisa das cores e da logo antes mesmo do login
    router.get('/config', asyncHandler(async (req, res) => {
      res.json(await ConfigStore.get());
    }));

    router.post('/config/cores', exigirPermissao('aparencia:gerenciar'), asyncHandler(async (req, res) => {
      const { cores } = req.body;

      if (!cores || typeof cores !== 'object') {
        return res.status(400).json({ error: 'Informe as cores' });
      }

      const camposInvalidos = Object.entries(cores).filter(([, valor]) => !HEX_COLOR_REGEX.test(valor));
      if (camposInvalidos.length > 0) {
        return res.status(400).json({
          error: `Cor inválida em: ${camposInvalidos.map(([campo]) => campo).join(', ')}. Use o formato #RRGGBB.`
        });
      }

      const config = await ConfigStore.get();
      config.cores = { ...config.cores, ...cores };
      await ConfigStore.save(config);
      res.json({ success: true, config });
    }));

    router.put('/config/personalizacao', exigirPermissao('aparencia:gerenciar'), asyncHandler(async (req, res) => {
      const dados = lerPersonalizacao(req.body || {});
      const config = await ConfigStore.get();
      config.personalizacao = { ...config.personalizacao, ...dados };
      res.json({ success: true, config: await ConfigStore.save(config) });
    }));

    router.post('/config/logo', exigirPermissao('aparencia:gerenciar'), upload.single('logo'), asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const config = await ConfigStore.get();
      await deleteImage(config.logo);
      const { path: imagePath } = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      config.logo = imagePath;
      await ConfigStore.save(config);

      res.json({
        success: true,
        logo: config.logo,
        config
      });
    }));

    router.post('/config/background', exigirPermissao('aparencia:gerenciar'), upload.single('image'), asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada' });
      }

      const config = await ConfigStore.get();
      await deleteImage(config.background);
      const { path: imagePath } = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
      config.background = imagePath;
      await ConfigStore.save(config);

      res.json({
        success: true,
        background: config.background,
        config
      });
    }));
  }
};
