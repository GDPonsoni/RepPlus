import 'dotenv/config';
import os from 'os';
import { createApp } from './app.js';

// Ponto de entrada: sobe o servidor (localmente e no Render, que informa a porta em PORT)
const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  // Endereços para abrir no celular conectado ao mesmo Wi-Fi
  if (process.env.RENDER) return;
  Object.values(os.networkInterfaces()).flat()
    .filter(rede => rede && rede.family === 'IPv4' && !rede.internal)
    .forEach(rede => console.log(`No celular (mesmo Wi-Fi): http://${rede.address}:${PORT}`));
});
