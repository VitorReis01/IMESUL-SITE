# Guia de contribuição

Este repositório contém dois projetos Next.js independentes: `imesul` (site institucional) e
`imesul-vendas` (site de vendas). Cada um tem build, deploy e `node_modules` próprios.

## Stack e restrições

- React, Next.js, JSX e Tailwind CSS.
- Não converter arquivos para TypeScript.
- Não instalar dependências novas sem autorização prévia.
- Não usar shadcn/ui sem autorização prévia.
- Não usar canvas, WebGL, Three.js ou efeitos visuais pesados sem autorização prévia.

## Identidade visual

Preservar a identidade visual da IMESUL: estética industrial premium, limpa e moderna, com fundo
azul/grafite escuro, branco e vermelho usado apenas como detalhe. Evitar efeitos infantis, neon
exagerado, partículas soltas, ou animações poluídas.

## Ao editar código

- Entender os arquivos existentes antes de alterar.
- Alterar somente os arquivos necessários para a tarefa em questão.
- Não mexer no site de vendas (`imesul-vendas`) quando a tarefa for sobre o institucional
  (`imesul`), e vice-versa, salvo pedido explícito envolvendo os dois.
- Não alterar `Navbar`, `Hero`, `Footer`, `CompanyStory` ou `ProductScrollExperience` sem pedido
  explícito.
- Rodar `npm run lint` e `npm run build` no projeto afetado antes de considerar uma mudança
  pronta.

## Workflow

- Não executar commit automaticamente — validar a mudança primeiro.
- Ao final de uma mudança, reportar: arquivos alterados, resumo técnico, validação feita
  (lint/build/testes) e pendências.
