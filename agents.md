# SetlistOS - Guia para Agentes

Este documento consolida o escopo funcional do MVP e a arquitetura atual do repositorio. Use-o como referencia antes de alterar codigo, contratos ou documentacao.

## Visao Geral

SetlistOS e uma aplicacao web para bandas criarem setlists, buscarem musicas no Deezer, adicionarem faixas, reordenarem musicas por drag-and-drop e acompanharem a duracao total do show.

O MVP tambem define um caminho de produto alem do que ja esta implementado: autenticacao, letras, modo apresentacao, sincronizacao manual de letras, metronomo e persistencia de letras. Hoje a aplicacao principal cobre setlists, musicas, busca Deezer, ordenacao e duracao total.

## Arquitetura do Monorepo

O repositorio e um workspace pnpm com TypeScript.

- `artifacts/setlist-app`: aplicacao principal em Next.js App Router. Serve UI e API routes em `/api`.
- `lib/db`: Prisma schema e cliente compartilhado.
- `lib/api-spec`: contrato OpenAPI usado por Orval.
- `lib/api-client-react`: cliente gerado com hooks React Query.
- `lib/api-zod`: schemas Zod gerados a partir do OpenAPI.
- `scripts`: automacoes do workspace.

Stack atual:

- Next.js App Router
- React 19
- React Query via cliente gerado
- PostgreSQL
- Prisma ORM
- Zod
- OpenAPI + Orval
- `@hello-pangea/dnd` para drag-and-drop
- Deezer public search API

## Modulos Principais

### UI Next.js

- `src/app/page.tsx`: entrada da lista de setlists.
- `src/app/setlists/[id]/page.tsx`: detalhe de uma setlist.
- `src/views/Setlists.tsx`: listagem, criacao e exclusao de setlists.
- `src/views/SetlistDetail.tsx`: edicao de nome, lista de musicas, drag-and-drop, remocao e painel de busca Deezer.
- `src/components/DeezerSearch.tsx`: busca debounced no Deezer e acao de adicionar faixa.
- `src/components/*`: componentes locais de UI, alem de muitos componentes base em `src/components/ui`.

### API Next Route Handlers

As rotas principais vivem em `artifacts/setlist-app/src/app/api`.

- `GET /api/healthz`: health check.
- `GET /api/setlists`: lista setlists com `songCount` e `totalDurationMs`.
- `POST /api/setlists`: cria setlist por `name`.
- `GET /api/setlists/:id`: retorna setlist com musicas ordenadas por `position`.
- `PATCH /api/setlists/:id`: renomeia setlist.
- `DELETE /api/setlists/:id`: exclui setlist.
- `POST /api/setlists/:id/songs`: adiciona musica na proxima posicao.
- `DELETE /api/setlists/:id/songs/:songId`: remove musica.
- `PUT /api/setlists/:id/songs/reorder`: atualiza `position` conforme array de IDs.
- `GET /api/deezer/search?q=...`: busca ate 10 faixas no Deezer.

### Integracao Deezer

`artifacts/setlist-app/src/server/deezer.ts` usa a API publica do Deezer, sem credenciais. A busca retorna `id`, `title`, `artist`, `durationMs`, `bpm`, `albumArt` e `album`.

### Banco de Dados

Schema atual em `lib/db/prisma/schema.prisma`:

- `Setlist`: `id`, `name`, `createdAt`, relacao `songs`.
- `SetlistSong`: `id`, `setlistId`, `position`, `title`, `artist`, `durationMs`, `bpm`, `deezerId`, `spotifyId`, `albumArt`.

Nao ha ainda modelos de usuario, autenticacao, letra, sincronizacao, apresentacao ou metronomo.

Arquivos de audio nao devem ser salvos no backend. O backend pode persistir dados da faixa na setlist, letra, sincronia/timestamps e metadados de origem, mas o arquivo usado para preview durante a criacao da letra sincronizada deve permanecer apenas no client.

## Contratos API e Dados

O contrato oficial esta em `lib/api-spec/openapi.yaml`. Sempre atualize o OpenAPI quando adicionar ou alterar endpoints, campos ou codigos de resposta que sejam consumidos pelo frontend gerado.

Contratos atuais:

- `Setlist`: `id`, `name`, `createdAt`, `totalDurationMs`, `songCount`.
- `SetlistWithSongs`: `id`, `name`, `createdAt`, `songs`.
- `SetlistSong`: `id`, `setlistId`, `position`, `title`, `artist`, `durationMs`, `bpm`, `deezerId`, `spotifyId`, `albumArt`.
- `DeezerTrack`: `id`, `title`, `artist`, `durationMs`, `bpm`, `albumArt`, `album`.

Depois de mudar `openapi.yaml`, gere novamente os pacotes de cliente/schemas conforme os scripts do workspace. Nao edite arquivos gerados manualmente.

## Estado das Features

### Implementado

- Criar setlist por nome.
- Listar setlists.
- Excluir setlists.
- Renomear setlist.
- Buscar musicas no Deezer.
- Importar titulo, artista, duracao, BPM, Deezer ID e capa do album.
- Adicionar musica a setlist.
- Remover musica.
- Reordenar musicas por drag-and-drop.
- Calcular duracao total por setlist.
- Persistir setlists e musicas no PostgreSQL.
- Exibir estados basicos de loading/erro na UI.

### Parcial ou Pendente

- Autenticacao e usuario.
- Descricao de setlist.
- Artista opcional para musica manual; hoje `artist` e obrigatorio no contrato de adicionar musica.
- Insercao manual de musica fora do Deezer.
- Letras automaticas e manuais.
- Persistencia de letras.
- Letras sincronizadas.
- Modo apresentacao.
- Metronomo.
- Feedback mais completo de sucesso/erro para todas as acoes.

## Requisitos Funcionais do MVP

### 1. Autenticacao e Usuario

#### RF-001 - Cadastro de usuario

O sistema deve permitir que o usuario crie uma conta utilizando:

- Email
- Senha

#### RF-002 - Login

O sistema deve permitir autenticacao via:

- Email + senha

#### RF-003 - Persistencia de sessao

O sistema deve manter o usuario autenticado entre sessoes.

### 2. Gerenciamento de Setlists

#### RF-004 - Criar setlist

O usuario deve ser capaz de criar uma nova setlist contendo:

- Nome
- Descricao opcional

#### RF-005 - Editar setlist

O usuario deve poder editar:

- Nome
- Ordem das musicas

#### RF-006 - Excluir setlist

O sistema deve permitir deletar uma setlist.

#### RF-007 - Listar setlists

O sistema deve exibir todas as setlists do usuario.

### 3. Gerenciamento de Musicas

#### RF-008 - Adicionar musica a setlist

O usuario deve poder adicionar musicas contendo:

- Nome da musica
- Artista opcional

#### RF-009 - Reordenar musicas

O usuario deve poder alterar a ordem das musicas dentro da setlist.

#### RF-010 - Remover musica

O usuario deve poder remover musicas da setlist.

### 4. Letras

#### RF-011 - Buscar letra automaticamente

O sistema deve buscar letras automaticamente via API externa quando possivel.

#### RF-012 - Insercao manual de letra

O usuario deve poder inserir ou editar manualmente a letra da musica.

#### RF-013 - Persistencia local de letras

O sistema deve permitir armazenar letras localmente. Para evolucao de produto, prefira persistencia no banco quando houver conta/usuario; browser storage pode ser usado apenas como fallback temporario ou modo offline.

### 5. Modo Apresentacao

#### RF-014 - Iniciar modo apresentacao

O usuario deve poder iniciar uma setlist em modo apresentacao.

#### RF-015 - Exibir letra em tempo real

O sistema deve exibir a letra da musica atual em tela cheia.

#### RF-016 - Navegacao entre musicas

O usuario deve poder:

- Avancar para proxima musica
- Voltar para musica anterior

### 6. Sincronizacao de Letra

#### RF-017 - Sincronizar letra manualmente

O usuario deve poder sincronizar trechos da letra com o tempo manualmente.

#### RF-018 - Reproducao de tempo

O sistema deve exibir um contador de tempo durante a execucao.

#### RF-019 - Exibir letra sincronizada

O sistema deve destacar a linha atual da musica conforme o tempo.

### 7. Metronomo

#### RF-020 - Iniciar metronomo

O usuario deve poder ativar um metronomo com:

- BPM configuravel

#### RF-021 - Contagem inicial

O sistema deve executar uma contagem inicial, por exemplo 1, 2, 3, 4, antes do inicio.

### 8. Integracoes

#### RF-022 - Buscar musicas via API externa

O sistema deve buscar musicas utilizando integracao com API externa. A integracao atual e Deezer.

#### RF-023 - Importar dados da musica

O sistema deve preencher automaticamente:

- Nome
- Artista

Hoje tambem importa duracao, BPM, capa do album e Deezer ID.

### 9. Persistencia

#### RF-024 - Salvar dados do usuario

O sistema deve persistir:

- Setlists
- Musicas
- Letras

#### RF-025 - Carregar dados automaticamente

O sistema deve recuperar os dados ao abrir o app.

### 10. Estados e Feedback

#### RF-026 - Feedback de acoes

O sistema deve informar sucesso/erro para:

- Criacao
- Edicao
- Exclusao

## Feature 4 - Letras e Letras Sincronizadas

Esta e uma feature central do produto e deve ser implementada de forma incremental, sem quebrar a gestao atual de setlists.

### Objetivo

Permitir que cada musica da setlist tenha letra associada, preferencialmente sincronizada por tempo, para uso durante ensaio ou apresentacao.

### Fonte automatica: LRCLIB

Use LRCLIB como primeira integracao para buscar letras. O fluxo esperado:

1. Ao abrir ou selecionar uma musica, buscar por `title`, `artist`, `album` quando existir e `durationMs`.
2. Priorizar resultado com letra sincronizada (`syncedLyrics` em formato LRC) quando disponivel.
3. Se nao houver letra sincronizada, aceitar letra nao sincronizada (`plainLyrics`) como base.
4. Salvar metadados da origem: provedor, status, timestamp de importacao e, se houver, identificador externo.
5. Evitar chamadas repetidas desnecessarias usando cache local ou persistencia.

### Modelo de dados sugerido

Adicionar em iteracao futura:

- `Lyrics`: vinculada a `SetlistSong` ou a uma entidade canonica de musica.
- Campos sugeridos: `songId`, `provider`, `providerId`, `plainText`, `syncedLrc`, `sourceStatus`, `createdAt`, `updatedAt`.
- Para sincronizacao editavel, considerar uma estrutura de linhas: `lineIndex`, `text`, `startMs`, `endMs`.

Decisao pendente: se letras pertencem a cada entrada da setlist (`SetlistSong`) ou a uma musica reutilizavel global. O modelo atual nao tem tabela `Song`; por isso, a primeira implementacao pode vincular a `SetlistSong` para reduzir mudanca estrutural.

### Fallback manual descrito pelo usuario

Quando LRCLIB nao encontrar letra adequada, retornar letra incompleta, retornar apenas letra sem sincronizacao, ou quando o usuario quiser corrigir o material:

- Exibir editor manual de letra.
- Permitir colar ou digitar a letra inteira.
- Permitir editar linhas importadas da LRCLIB.
- Permitir selecionar ou informar audio apenas no client para preview local, sem upload e sem persistencia do arquivo.
- Permitir criar sincronizacao manual por linha durante uma reproducao com contador.
- Botao esperado: marcar o tempo da linha atual enquanto o contador roda.
- Permitir ajustar timestamps manualmente depois da marcacao.
- Salvar a versao manual como fonte preferencial para aquela musica.

### Comportamento de apresentacao

- Modo tela cheia para a musica atual.
- Destaque da linha ativa conforme `currentTimeMs`.
- Navegacao entre musicas da setlist.
- Quando nao houver sincronizacao, mostrar letra completa em modo leitura.
- Quando nao houver letra, mostrar estado vazio com acao para buscar ou inserir manualmente.

### API futura sugerida

Endpoints possiveis:

- `GET /api/setlists/:id/songs/:songId/lyrics`
- `PUT /api/setlists/:id/songs/:songId/lyrics`
- `POST /api/setlists/:id/songs/:songId/lyrics/search`
- `PUT /api/setlists/:id/songs/:songId/lyrics/sync`

Atualize `lib/api-spec/openapi.yaml` antes de usar hooks gerados no frontend.

## Escopo do MVP

O MVP deve focar em:

- Criacao e gestao de setlists.
- Busca e importacao de musicas via Deezer.
- Letras basicas.
- Busca automatica de letras via LRCLIB.
- Fallback manual para letra e sincronizacao.
- Sincronizacao manual.
- Modo apresentacao simples.
- Metronomo basico.

## Fora do Escopo do MVP

- IA avancada de sincronizacao automatica.
- Partituras.
- Multiusuario em tempo real.
- WebSockets.
- Analise de solos.
- Streaming de audio completo.

## Diretrizes para Agentes Futuros

- Trate `artifacts/setlist-app` como aplicacao principal.
- Preserve o contrato OpenAPI como fonte para clientes gerados.
- Nao edite arquivos gerados em `lib/api-client-react/src/generated` ou `lib/api-zod/src/generated`; regenere a partir do spec.
- Ao alterar dados persistidos, atualize `lib/db/prisma/schema.prisma` e documente migracao/push esperado.
- Use validacao Zod nos route handlers para entradas novas.
- Mantenha rotas de API sob `/api` para compatibilidade com o servidor Next.
- Ao implementar Letras, mantenha fallback manual como requisito de primeira classe, nao como detalhe secundario.
- Nao crie armazenamento, upload ou endpoint para arquivos de audio; preview de audio para sincronizacao manual e responsabilidade exclusiva do client.
- Evite acoplar letras exclusivamente ao Deezer ID ou a qualquer ID de provedor, porque musicas podem ser inseridas manualmente ou vir de outras fontes.
- Antes de mexer em UI, verifique os componentes e estilos existentes para manter consistencia visual.
- Nao remova nem reverta mudancas de outros agentes sem instrucao explicita.
