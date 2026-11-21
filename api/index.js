import { createApp } from '../backend/app.js';

// Entrada na Vercel: o mesmo app Express do Render, como função. O vercel.json manda
// toda /api/* para cá; o site (frontend/) sai direto da CDN da Vercel, sem passar pela função
export default createApp();
