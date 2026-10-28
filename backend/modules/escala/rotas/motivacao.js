import { asyncHandler, upload } from '../../../core/http.js';
import { exigirPermissao } from '../../../core/auth/permissoes.js';
import { uploadImage, listGalleryImages, deleteImageByFilename, getKeyFromUrl } from '../../../core/storage.js';
import { ConfigStore } from '../../../core/configuracao/store.js';

// Galeria de imagens motivacionais: uma delas aparece em destaque na escala da semana

export // Escolhe uma imagem aleatória da galeria, evitando repetir a atual quando há outra opção
const sortearMotivacaoDestaque = async (config) => {
  const galeria = await listGalleryImages({ exclude: [config.logo, config.background].filter(Boolean) });
  if (galeria.length === 0) return config.motivacaoDestaque || null;

  const candidatos = galeria.filter(imagem => imagem.path !== config.motivacaoDestaque);
  const pool = candidatos.length > 0 ? candidatos : galeria;
  const escolhido = pool[Math.floor(Math.random() * pool.length)];
  return escolhido.path;
};

export function rotasMotivacao(router) {
  // Upload de imagem motivacional
  router.post('/upload-motivacao-image', exigirPermissao('motivacao:gerenciar'), upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }
    const { filename, path: imagePath } = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ filename, path: imagePath });
  }));

  router.get('/uploads/motivacao', exigirPermissao('escala:ver'), asyncHandler(async (req, res) => {
    const config = await ConfigStore.get();
    const imagens = await listGalleryImages({ exclude: [config.logo, config.background].filter(Boolean) });

    res.json(imagens.sort((a, b) => b.filename.localeCompare(a.filename)));
  }));

  router.post('/config/motivacao-destaque', exigirPermissao('motivacao:gerenciar'), asyncHandler(async (req, res) => {
    const { path: imagemPath } = req.body;

    if (!imagemPath || typeof imagemPath !== 'string' || !getKeyFromUrl(imagemPath)) {
      return res.status(400).json({ error: 'Informe uma imagem válida' });
    }

    const config = await ConfigStore.get();
    config.motivacaoDestaque = imagemPath;
    await ConfigStore.save(config);

    res.json({
      success: true,
      motivacaoDestaque: config.motivacaoDestaque,
      config
    });
  }));

  router.delete('/uploads/motivacao/:filename', exigirPermissao('motivacao:gerenciar'), asyncHandler(async (req, res) => {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'Arquivo inválido' });
    }

    await deleteImageByFilename(filename);

    const config = await ConfigStore.get();
    if (getKeyFromUrl(config.motivacaoDestaque) === filename) {
      config.motivacaoDestaque = null;
      await ConfigStore.save(config);
    }

    res.json({ success: true });
  }));
}
