import { asyncHandler, upload } from '../http.js';
import { exigirPermissao } from '../auth/permissoes.js';
import { uploadImage, deleteImage } from '../storage.js';
import { ConfigStore } from './store.js';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// Aparência da república: cores, logo e fundo
export default {
  id: 'configuracao',
  nome: 'Configuração',
  nucleo: true,
  permissoes: {
    'aparencia:gerenciar': { descricao: 'Alterar cores, logo e fundo', papeis: [] }
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
