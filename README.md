# SHR Gesso · Gestão de serviços

Painel privado em azul escuro e branco, com a logo aprovada. Código preparado para GitHub e hospedagem na Vercel. Não depende de Supabase, Firebase, serviços de e-mail, banco externo ou CDN de interface. O único pacote de produção é o SDK oficial do Vercel Blob.

## O que o painel faz

- Visão geral com próximos compromissos, orçamentos pendentes, saldo a receber e entregas.
- Calendário mensal, navegação entre meses, seleção de dia e serviços de vários dias.
- Ficha de serviço com cliente, telefone, e-mail opcional, endereço, tipo, descrição, medidas, materiais, início, término, valor combinado, sinal/recebido acumulado e observações.
- Até 8 fotos privadas do local por ficha, em JPG, PNG ou WebP, até 3 MB por foto.
- Situações: pendente, aprovado, agendado, em execução, concluído, recusado e cancelado.
- Alerta visual de sobreposição de horários. A decisão continua com a empresa, pois pode haver mais de uma equipe.
- Busca, filtros, clientes agrupados por telefone e histórico de serviços.
- Controle de valores aprovados, recebido e saldo. Exportação CSV do resultado filtrado, com proteção contra fórmulas em campos de texto.
- Link para conversar com o cliente pelo WhatsApp e abrir a localização. Nada é enviado automaticamente.
- Impressão da ficha pelo navegador (incluindo opção Salvar como PDF) e arquivo de calendário .ics em horário de Brasília.
- Login por senha, ativação inicial com código, troca de senha, encerramento de sessões antigas e limite persistente de tentativas de login.
- Interface responsiva para celular e computador, sem dados fictícios em produção.

## Publicar usando somente GitHub e Vercel

1. Crie um repositório **privado** chamado `shr-gesso` na conta desejada do GitHub. Envie o conteúdo desta pasta, incluindo `package-lock.json`, mas nunca `node_modules`, `.local-data`, `.env` ou `.vercel`.
2. Na Vercel, escolha **Add New → Project**, importe o repositório e use uma conta/equipe com permissão para criar projetos.
3. Escolha Framework Preset **Other**, Install Command `npm install`, Output Directory `public`. Não há etapa de build de frontend. O arquivo `vercel.json` configura a função Node.js e os cabeçalhos.
4. Na Vercel, crie um armazenamento **Vercel Blob privado** e conecte-o ao projeto. Use a credencial injetada automaticamente: `BLOB_STORE_ID` com identidade OIDC ou `BLOB_READ_WRITE_TOKEN`. Não use um store público. O SDK recebe `access: 'private'` em todas as operações.
5. Em Settings → Environment Variables, crie `SESSION_SECRET` e `ADMIN_SETUP_KEY` com duas chaves **diferentes**, aleatórias e longas. Gere cada uma executando `openssl rand -hex 32`. Configure Production; configure Preview somente se desejar também testar ali.
6. Faça um novo deploy após conectar o armazenamento e definir as variáveis.
7. Abra o site, informe seu nome, o código `ADMIN_SETUP_KEY` e crie uma senha de pelo menos 12 caracteres. A ativação funciona uma única vez. O código de ativação não é a senha de uso diário.
8. Valide em produção: entrar, criar um serviço, anexar uma foto, recarregar, abrir em outro aparelho, editar, exportar CSV e sair da conta. Confirme que uma janela anônima não consegue ler registros nem fotos.

A função roda em São Paulo (`gru1`). As futuras mudanças enviadas ao branch de produção do GitHub devem ser publicadas automaticamente pela integração Git da Vercel.

## Desenvolvimento local

Requer Node.js 22 ou superior.

```sh
npm ci
npm run dev
```

Abra `http://127.0.0.1:3000`. O terminal mostra um código de ativação exclusivo para o ambiente local. Os dados de desenvolvimento ficam na pasta `.local-data`, ignorada pelo Git. As chaves locais são geradas automaticamente e ficam somente ali. Este servidor escuta apenas em 127.0.0.1 e não deve ser usado como hospedagem pública.

```sh
npm run check
npm test
```

Os testes usam um diretório temporário separado, sem modificar seus dados. Verificam ativação, acesso restrito, cadastro, validação de campos e datas, atualização com ETag, leitura privada de fotos, troca de senha, revogação de sessões, exclusão, proteção de origem e limite de tentativas de acesso.

## Armazenamento e segurança

- `records/<uuid>.json`: uma ficha por arquivo privado, com ETag para impedir sobrescrita silenciosa quando dois aparelhos editam ao mesmo tempo.
- `photos/<uuid>/<uuid>.<ext>`: fotos privadas lidas por uma rota autenticada.
- `system/admin.json`: nome, hash scrypt com salt e versão de sessão do administrador.
- `system/limits/<HMAC-do-IP>.json`: limite de 10 tentativas por 15 minutos, incluindo ativação, login e mudança de senha. O IP não fica salvo em texto.
- Sessão assinada, duração de 12 horas, cookie HttpOnly, SameSite=Strict e Secure em produção.
- Nenhuma senha ou chave no frontend ou no repositório. CSP sem scripts de terceiros, bloqueio de enquadramento e validação de dados no servidor.
- As fotos são verificadas por assinatura do arquivo e tamanho. Não são aceitos SVG, HTML ou arquivos arbitrários no upload.
- Serviços excluídos ficam marcados como excluídos nos arquivos privados e somem da aplicação. A exclusão não é apagamento físico; fotos retiradas e uploads de fichas abandonadas também continuam no armazenamento até manutenção explícita. Considere isso ao atender pedidos de eliminação de dados e ao acompanhar uso.
- O administrador único atende à operação inicial. Não há múltiplos usuários, permissões por funcionário ou recuperação automática por e-mail. Se perder a senha, um responsável autorizado precisa fazer manutenção do arquivo de configuração no armazenamento privado. Nunca tornar esse arquivo público.
- Este é um painel interno: o administrador cadastra os atendimentos. Não há formulário público de autoagendamento de clientes.
- Financeiro registra o total recebido manualmente. Não há cobrança integrada, nota fiscal, conciliação bancária, gestão de despesas nem histórico individual de parcelas.

Vercel Blob é armazenamento de arquivos, não um banco relacional. Esta implementação usa uma ficha por arquivo para manter tudo na Vercel, conforme solicitado. A listagem lê os arquivos das fichas; acompanhe consumo e latência quando o volume crescer. Não use o filesystem temporário de Functions para dados reais. Não há fallback silencioso para dados locais quando a aplicação está em produção.

## Verificação realizada

Os testes de integração automatizados passaram usando o adaptador local. O fluxo também foi exercitado em Chromium: ativação, cadastro com foto, persistência após recarga, calendário, edição, histórico de clientes, saldo financeiro, exportação CSV, navegação em 390 px e descarte de edição. Não houve erros no console do navegador. O SDK do Blob foi conferido para leitura privada e escrita condicional por `ifMatch`. A operação real do Blob e o comportamento de cookies/Functions na Vercel ainda precisam de validação após o provisionamento e o primeiro deploy. Não houve teste de produção porque a criação do projeto foi bloqueada por permissão.
