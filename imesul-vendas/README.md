# IMESUL Área de Vendas

Aplicação separada do site institucional da IMESUL.

## Desenvolvimento

```bash
npm install
npm run dev -- -p 3100
```

O site institucional roda em `http://localhost:3000` e abre esta aplicação em `http://localhost:3100` por meio do item **Produtos**.

## Variáveis de ambiente

Use `.env.local` em cada projeto quando as URLs de produção estiverem definidas:

- Site institucional: `NEXT_PUBLIC_SALES_SITE_URL`
- Área de Vendas: `NEXT_PUBLIC_INSTITUTIONAL_SITE_URL`
