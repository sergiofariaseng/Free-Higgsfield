# Free Higgsfield — estúdio pessoal para GitHub + Vercel

Aplicativo em português baseado no projeto do ZIP fornecido. Gera imagens e vídeos pela API Higgsfield e guarda os arquivos no GitHub. Inclui login, seleção de modelos, referências, estimativa de custo, biblioteca com busca/filtros, visualização de imagens/vídeos e acesso ao original.

**A API Higgsfield é paga conforme sua conta e o modelo escolhido.** O aplicativo não oferece créditos gratuitos nem contorna cobrança. Os modelos do catálogo vieram do anexo; disponibilidade e preço reais dependem do provedor.

## Publicação

1. Envie o conteúdo deste diretório para a branch `main` de `sergiofariaseng/Free-Higgsfield`. `package.json`, `app/` e `vercel.json` devem ficar na raiz. É necessário pelo menos um commit em `main` antes de conectar o armazenamento.
2. No GitHub, crie um **fine-grained personal access token**, limitado a esse repositório, com **Repository permissions → Contents → Read and write**. Se sua organização exigir aprovação, aguarde a autorização. Prefira um repositório privado para mídias e prompts privados.
3. Na Vercel, importe o repositório, escolha o framework **Next.js**, raiz `./` e Node.js **24.x** (também exige no mínimo 22). O build é `npm run build`.
4. Antes de fazer o deploy, adicione as variáveis abaixo em **Settings → Environment Variables**, no escopo **Production**. Configure Preview somente se quiser que esses deployments tenham acesso à mesma biblioteca; para isolamento, use outro repositório ou branch de armazenamento.
5. Faça o deploy. Entre usando `APP_PASSWORD`, abra **Configurações** e clique em **Verificar conexões**. O aplicativo cria a branch `studio-storage` a partir de `main` quando necessário.
6. Gere uma imagem pequena. Na biblioteca, aguarde **Salvo no GitHub**. Confira a branch `studio-storage`, pasta `media/images/`, e abra novamente o aplicativo para confirmar a persistência real.

| Variável | O que preencher |
| --- | --- |
| `APP_PASSWORD` | Sua senha de acesso. Pode ser curta; basta não estar vazia. |
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres, diferente da senha. |
| `HF_KEY` | Chave completa copiada do botão **Copy API key** do Higgsfield. Cole o valor inteiro, sem separar. |
| `GITHUB_TOKEN` | Token de escopo restrito descrito acima. |
| `GITHUB_REPOSITORY` | `sergiofariaseng/Free-Higgsfield` |
| `GITHUB_BASE_BRANCH` | `main` (padrão). |
| `GITHUB_STORAGE_BRANCH` | `studio-storage` (padrão; deve ser diferente da branch do código). |
| `CRON_SECRET` | Outro segredo aleatório com pelo menos 32 caracteres. A Vercel o envia ao cron como Bearer token. |

A autenticação segue o [SDK oficial Higgsfield](https://github.com/higgsfield-ai/higgsfield-client): `HF_KEY` tem prioridade. Também são aceitos `HF_API_KEY` + `HF_API_SECRET`, ou os nomes antigos `HF_API_KEY_ID` + `HF_API_KEY_SECRET`; pares incompletos não são combinados entre formatos.

Não coloque chaves em variáveis `NEXT_PUBLIC_*`, código-fonte ou arquivos do GitHub. A tela de configurações mostra o estado das conexões, nunca os valores das chaves. Trocar senha ou segredo de sessão invalida os logins anteriores. O limitador de tentativas de login é por instância; para proteção adicional distribuída, configure uma regra de rate limiting no Vercel Firewall para `/api/auth/login`.

## Onde ficam os arquivos

Na branch de armazenamento:

```text
media/
  images/2026-10/<id-da-geracao>-0.png
  videos/2026-10/<id-da-geracao>-0.mp4
.studio/state.json
```

`media/` contém as mídias. `.studio/state.json` contém prompts, parâmetros, fila, custos estimados e preferências, sem credenciais. Cada mídia e sua entrada no catálogo são publicadas no mesmo commit. Atualizações simultâneas usam compare-and-swap do Git, com nova leitura em caso de conflito; nunca há force-push. O catálogo tem limite de 4 MB e a interface lista até 1.000 gerações recentes.

A branch `studio-storage` tem deploy desabilitado em `vercel.json`, para que salvar uma imagem não gere um novo deploy. Se mudar o nome da branch, atualize também esse arquivo. Não faça merge dessa branch na `main`.

A biblioteca exige login mesmo para repositórios públicos. Quando o repositório é público, seus arquivos também são públicos no GitHub. Em repositórios privados, o servidor solicita ao GitHub um endereço temporário de leitura e redireciona o navegador; o token de API nunca é enviado ao cliente. Vídeos são servidos diretamente pelo GitHub, evitando passar o arquivo inteiro por uma resposta da Vercel. Links temporários podem ser compartilhados por quem os recebe até expirarem.

Excluir uma mídia remove a versão atual e sua entrada na biblioteca. O histórico Git continua contendo versões antigas; exclusão não significa apagamento definitivo nem diminuição imediata do tamanho do repositório. O registro de custo é preservado mesmo após remover a mídia.

## Processamento na Vercel

Não há SQLite, disco persistente, `setInterval` de servidor ou processo permanente. A fila fica no GitHub. Cada chamada autenticada a `/api/process` executa e aguarda uma etapa: envio, consulta ou salvamento de um arquivo. Uma trava persistente evita processamento concorrente. Após interrupções, uma nova chamada retoma o trabalho.

Com a interface aberta, a fila sincroniza a cada 15 segundos durante atividade, depois de concluir a chamada anterior. O cron padrão de `vercel.json` executa diariamente às 03:00 UTC (00:00 em São Paulo), compatível com a frequência permitida no plano Hobby, e tenta até quatro etapas por execução dentro do orçamento de tempo. Ele é uma recuperação de baixa frequência, não uma garantia de conclusão imediata com o navegador fechado. Lotes ou filas grandes podem precisar de várias execuções: mantenha a biblioteca aberta até confirmar o salvamento. Para operação contínua com a aba fechada, use um plano Vercel que permita mais frequência e altere o agendamento para `*/5 * * * *` ou outro intervalo compatível. Configure `CRON_SECRET` também nessa implantação.

O provedor pode levar minutos para gerar um vídeo; o aplicativo nunca espera o vídeo inteiro dentro de uma única função. Quando o envio ao provedor acontece mas sua confirmação se perde, o job fica com uma mensagem de envio sem confirmação. **Não há reenvio automático**, evitando uma segunda cobrança. Confira o histórico no Higgsfield antes de iniciar outra geração.

## Limites

- **40 MB por arquivo gerado**, verificados durante o download. Arquivos maiores não são gravados no GitHub; o resultado permanece com aviso e link temporário do provedor para download manual.
- **4 MB por anexo de referência**, para respeitar o limite de corpo das funções Vercel. O limite aparece antes do envio. JPEG, PNG, WebP, GIF, MP4 e WAV são os formatos aceitos pelo adaptador do anexo.
- Máximo de 20 gerações ativas e de 4 resultados solicitados por envio. A simultaneidade é configurável de 1 a 10, respeitando também o limite do Higgsfield.
- Custos são estimativas em USD, não faturas. O limite em 30 dias considera a fila; modelos sem estimativa antecipada ficam bloqueados quando há um limite ativo. Os indicadores de dia e mês usam UTC.
- GitHub funciona aqui como armazenamento de uso pessoal. Há limites de API e crescimento do histórico; grandes acervos de vídeo devem migrar para armazenamento de objetos. O aplicativo informa erros de limite/acesso sem marcar arquivos não salvos como concluídos.
- Downloads podem abrir uma nova aba conforme o navegador. Use **Salvar como** no visualizador de mídia para baixar o original.

## Desenvolvimento

```bash
npm ci
cp .env.example .env.local
# Preencha .env.local com seus valores, sem commitá-lo.
npm run dev
```

Cada tarefa de nuvem já tem seu próprio ambiente isolado; reutilize o checkout existente, sem criar worktrees adicionais. Dependências ficam em `node_modules`; o servidor deve ser iniciado novamente em cada sessão.

```bash
npm test
npm run typecheck
npm run build
npm start
```

Os testes automatizados simulam as APIs de GitHub e Higgsfield para verificar persistência, conflitos, retomada, proteção contra envio duplicado, orçamento, limites, sessão e isolamento das chaves. **Eles não comprovam uma geração paga real nem um deploy na Vercel.** Valide essas integrações com suas credenciais seguindo o passo 6 de publicação.

A geração real precisa de acesso a `api.higgsfield.ai`, aos domínios de upload/resultado retornados pelo provedor, `api.github.com` e `raw.githubusercontent.com`. Se o ambiente de desenvolvimento restringir a rede, autorize esses destinos pelas configurações dele. A autenticação Git do ambiente de nuvem não substitui o token de Contents que a Vercel usará em produção.

Os utilitários de descoberta e verificação de modelos herdados do anexo fazem requisições externas e não fazem parte de `npm test`. Leia-os antes de executar com credenciais reais.
