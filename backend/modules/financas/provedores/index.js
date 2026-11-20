import demo from './demo.js';
import pluggy from './pluggy.js';

// Provedores de Open Finance. Para integrar um novo (ou ligar a Pluggy de verdade), basta um
// objeto com este contrato — a sincronização, as regras e as telas não mudam:
//
//   {
//     id: 'pluggy', nome: 'Pluggy', descricao: '...',
//     configurado(): boolean,                       // credenciais presentes (variáveis de ambiente)
//     comoConfigurar: '...',                        // texto exibido quando não está configurado
//     campos: [{ id, rotulo, ajuda, obrigatorio, avancado }], // opcional: o que o app pede ao conectar (vira `dados`)
//     async widget() -> { script, opcoes },         // opcional: widget do provedor (Pluggy Connect) que devolve o itemId
//     async conectar(dados) -> { externoId, instituicao },
//                                                   // dados vindos do app (ex.: itemId do widget Pluggy Connect)
//     async contas(conexao) -> [{ externoId, nome, instituicao, tipo, saldo }],
//                                                   // tipo: corrente | cartao | caixinha | investimento; saldo em centavos
//     async transacoes(conexao, conta, desde) -> [{ externoId, data, descricao, valor }],
//                                                   // desde/data: AAAA-MM-DD; valor em centavos (saída negativa)
//     async desconectar(conexao)                    // opcional
//   }

export const PROVEDORES = Object.fromEntries([demo, pluggy].map(provedor => [provedor.id, provedor]));

export const listarProvedores = () => Object.values(PROVEDORES)
  .filter(provedor => !provedor.oculto?.())
  .map(({ id, nome, descricao, comoConfigurar, configurado, campos = [], widget }) => ({ id, nome, descricao, comoConfigurar, campos, widget: Boolean(widget), disponivel: configurado() }));
