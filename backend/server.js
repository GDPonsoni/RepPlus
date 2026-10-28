import 'dotenv/config';
import { createApp } from './app.js';

// Ponto de entrada: localmente sobe o servidor; na Vercel, o app exportado vira a função serverless
const app = createApp();
const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log('Acesse o app no navegador!');
  });
}

export default app;
