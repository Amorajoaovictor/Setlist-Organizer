# SetlistOS Todo List

Esta lista organiza o backlog funcional e tecnico da aplicacao a partir do estado atual do repositorio e dos requisitos do MVP.

## Arquitetura e Contratos

- [ ] Manter `lib/api-spec/openapi.yaml` sincronizado com toda mudanca de API.
- [ ] Regenerar `lib/api-client-react` e `lib/api-zod` depois de alterar o OpenAPI.
- [ ] Definir estrategia de migracoes Prisma para evolucao do schema.
- [ ] Decidir quando remover ou arquivar o Express legado em `artifacts/api-server`.
- [ ] Padronizar tratamento de erros da API com codigos e mensagens consistentes.

## Autenticacao e Usuario

- [ ] Criar modelo de usuario no Prisma.
- [ ] Implementar cadastro com email e senha.
- [ ] Implementar login com email e senha.
- [ ] Implementar persistencia de sessao.
- [ ] Associar setlists ao usuario autenticado.
- [ ] Filtrar listagem para exibir apenas setlists do usuario.

## Setlists

- [x] Criar setlist por nome.
- [x] Listar setlists.
- [x] Renomear setlist.
- [x] Excluir setlist.
- [x] Calcular quantidade de musicas.
- [x] Calcular duracao total.
- [ ] Adicionar campo de descricao opcional.
- [ ] Melhorar feedback de sucesso/erro nas acoes.
- [ ] Confirmar comportamento de exclusao quando houver letras associadas.

## Musicas

- [x] Buscar faixas no Spotify.
- [x] Importar titulo, artista, duracao, capa e Spotify ID.
- [x] Adicionar musica a setlist.
- [x] Remover musica.
- [x] Reordenar musicas por drag-and-drop.
- [ ] Permitir adicionar musica manualmente sem Spotify.
- [ ] Permitir artista opcional para musica manual.
- [ ] Avaliar criacao de entidade `Song` reutilizavel, separada de `SetlistSong`.
- [ ] Validar que remocao de musica respeita a setlist informada.

## Feature 4: Letras

- [ ] Definir modelo Prisma para letras vinculadas a `SetlistSong` ou a uma entidade `Song`.
- [ ] Criar endpoints de leitura e escrita de letras.
- [ ] Atualizar OpenAPI com contratos de letras.
- [ ] Criar UI para visualizar letra da musica.
- [ ] Criar editor manual para colar, digitar e corrigir letra.
- [ ] Persistir letra manual como fonte preferencial da musica.
- [ ] Guardar metadados de origem da letra.

## LRCLIB

- [ ] Implementar cliente server-side para LRCLIB.
- [ ] Buscar por titulo, artista, album e duracao quando disponiveis.
- [ ] Priorizar `syncedLyrics` quando existir.
- [ ] Usar `plainLyrics` quando nao houver letra sincronizada.
- [ ] Tratar resultados ausentes, ambiguos ou incompletos.
- [ ] Cachear ou persistir resultado para evitar chamadas repetidas.
- [ ] Permitir ao usuario substituir resultado importado por versao manual.

## Sincronizacao Manual de Letras

- [ ] Parsear LRC em linhas com timestamps.
- [ ] Criar estrutura editavel de linhas sincronizadas.
- [ ] Implementar contador de tempo para marcacao manual.
- [ ] Permitir marcar timestamp da linha atual durante reproducao.
- [ ] Permitir ajustar timestamps manualmente.
- [ ] Destacar linha ativa conforme tempo atual.
- [ ] Salvar sincronizacao manual.
- [ ] Manter letra nao sincronizada como fallback de leitura.

## Modo Apresentacao

- [ ] Criar rota ou tela de apresentacao para uma setlist.
- [ ] Exibir musica atual em tela cheia.
- [ ] Exibir letra sincronizada com linha ativa.
- [ ] Exibir letra completa quando nao houver sincronizacao.
- [ ] Navegar para proxima musica.
- [ ] Navegar para musica anterior.
- [ ] Exibir estado vazio quando a musica nao tiver letra.

## Metronomo

- [ ] Definir onde BPM sera salvo: por musica, por setlist ou apenas sessao.
- [ ] Implementar metronomo com BPM configuravel.
- [ ] Implementar contagem inicial.
- [ ] Integrar metronomo ao modo apresentacao.
- [ ] Avaliar persistencia de BPM por musica.

## Persistencia

- [x] Persistir setlists no PostgreSQL.
- [x] Persistir musicas de setlist no PostgreSQL.
- [ ] Persistir letras.
- [ ] Persistir sincronizacao de letras.
- [ ] Persistir dados por usuario apos autenticacao.
- [ ] Avaliar browser storage apenas como fallback temporario/offline.

## Qualidade e Validacao

- [ ] Adicionar testes para route handlers de setlists.
- [ ] Adicionar testes para parser de LRC.
- [ ] Adicionar testes para cliente LRCLIB com mocks.
- [ ] Adicionar testes de UI para fluxo de criar setlist e adicionar musica.
- [ ] Rodar `pnpm run typecheck` antes de concluir mudancas de codigo.
