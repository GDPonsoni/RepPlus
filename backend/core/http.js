import multer from 'multer';

// Erro com status HTTP: um handler pode fazer `throw new HttpError(404, 'Não encontrado')`
// em vez de montar a resposta na mão
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Converte handlers assíncronos: erros caem aqui em vez de derrubar o processo
export const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch((err) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro ao acessar o banco de dados' });
});

const ALLOWED_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;

// Upload de imagens em memória (limite de 5MB e tipos permitidos); o arquivo vai para o R2
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_EXTENSIONS.test(file.originalname)) {
      cb(new Error('Tipo de arquivo não permitido. Envie png, jpg, jpeg, webp ou gif.'));
      return;
    }
    cb(null, true);
  }
});

// Middleware de erro (converte falhas de upload — tamanho/tipo — em resposta JSON 400)
export const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const mensagens = {
      LIMIT_FILE_SIZE: 'Arquivo muito grande. O limite é 5MB.'
    };
    return res.status(400).json({ error: mensagens[err.code] || err.message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Requisição inválida' });
  }
  next();
};
