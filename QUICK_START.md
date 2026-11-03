# ⚡ Guia Rápido

## 🚀 3 Passos para Começar

### 1. Instale o Node.js
https://nodejs.org/ (versão LTS)

### 2. Configure e execute
Copie o `.env.example` para `.env` e preencha ao menos o `DATABASE_URL` (banco no Neon; veja o [README](README.md)). Depois rode:
```bash
npm install
npm run db:migrar
npm start
```

### 3. Acesse
```
http://localhost:3000
```
No celular, no mesmo Wi-Fi, use o endereço `http://192.168.x.x:3000` que aparece no terminal ao subir (veja [Testar no celular](README.md#-testar-no-celular)).

## ⚙️ Configure em 5 Min

1. **👤 Menu do canto superior direito → Moradores**
   - Cadastre todos os moradores (só o apelido é obrigatório) e marque **"É da suíte?"** para quem mora na suíte.

2. **🧹 Escala de Limpeza → Ajustes → Cômodos e Tarefas**
   - Cadastre os cômodos (ex.: Sala, Cozinha, Lavanderia, Sacada) e defina a **ordem na rotação**.
   - No banheiro da suíte, marque **"Apenas suíte?"**.
   - Não cadastre "FOLGA" como cômodo: as folgas são calculadas sozinhas.

3. **🧹 Escala de Limpeza → Atual**
   - Toque em **"Gerar Nova Escala"**.

4. **⚙️ Menu do canto → Ajustes** (opcional)
   - **Nome e Estilo**: nome da república e visual.
   - **Logo, Fundo e Cores**: logo da casa e cores.
   - **Módulos**: desligue o que a casa não usa (ex.: Atas, Finanças).

## 🎮 Usar Toda Semana

```
Segunda: gera a escala da semana (a semana vira à 0h de segunda, horário de Brasília)
Durante: marca infrações se necessário (✕ no card da pessoa)
Próxima: cada um vai para o cômodo seguinte da sequência
```

## 🆘 Problemas?

| Erro | Solução |
|------|---------|
| `Defina DATABASE_URL` | Crie o `.env` na raiz do projeto (copie o `.env.example`) |
| Porta em uso | Rode com outra porta: `PORT=3001 npm start` |
| Celular não abre o app | Confira se está no mesmo Wi-Fi e libere a porta no firewall do computador (`sudo ufw allow 3000/tcp`) |
| Cofre não destranca no celular | O cofre precisa de https: use o endereço publicado no Render |
| "Envio de imagens não configurado" | Preencha as variáveis `R2_*` no `.env` (veja [docs/deploy.md](docs/deploy.md)) |
| Erro de tabela ou coluna inexistente | Rode `npm run db:migrar` |
| Sem módulos | `npm install` na raiz do projeto |
| "Há N vagas para M pessoas" ao gerar | Ative mais integrantes ou desmarque cômodos obrigatórios |

**Pronto!** 🎉

---
Para arquitetura, APIs, modelo de dados e publicação (Render, Neon, R2), consulte a pasta [`docs/`](docs/README.md).
