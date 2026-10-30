import 'dotenv/config';
import os from 'os';
import { createApp } from './app.js';

// Ponto de entrada: localmente sobe o servidor; na Vercel, o app exportado vira a função serverless
const app = createApp();
const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    // Endereços para abrir no celular conectado ao mesmo Wi-Fi
    Object.values(os.networkInterfaces()).flat()
      .filter(rede => rede && rede.family === 'IPv4' && !rede.internal)
      .forEach(rede => console.log(`No celular (mesmo Wi-Fi): http://${rede.address}:${PORT}`));
  });
}

export default app;
