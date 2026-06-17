# IMESUL Distribuição — Site Institucional Premium

## 🚀 Como rodar

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## 📁 Estrutura

```
imesul/
├── app/
│   ├── globals.css        ← Estilos globais, variáveis CSS, utilitários
│   ├── layout.jsx         ← Layout raiz (meta, fontes)
│   └── page.jsx           ← Página principal + inicialização do Lenis
├── components/
│   ├── Navbar.jsx         ← Menu fixo + barra de progresso
│   ├── Hero.jsx           ← Seção hero fullscreen com parallax GSAP
│   ├── ProductShowcase.jsx ← Grid com todas as 8 categorias
│   ├── ProductSection.jsx  ← Seções individuais de cada produto (GSAP)
│   ├── WhyChoose.jsx      ← Diferenciais / benefícios
│   ├── CTA.jsx            ← Call to action final
│   └── Footer.jsx         ← Rodapé completo
├── data/
│   └── products.js        ← ← EDITE AQUI: produtos, links, WhatsApp
└── public/
    └── images/products/   ← ← COLOQUE AS IMAGENS AQUI
```

---

## 🖼️ Onde trocar as imagens

Coloque os arquivos em `/public/images/products/` com esses nomes:

| Arquivo           | Onde aparece                    |
|-------------------|---------------------------------|
| `hero-tubos.jpg`  | Fundo do Hero (imagem principal)|
| `tubos.jpg`       | Card e seção de Tubos           |
| `chapas.jpg`      | Card e seção de Chapas          |
| `telhas.jpg`      | Card e seção de Telhas          |
| `perfis.jpg`      | Card e seção de Perfis          |
| `cantoneiras.jpg` | Card e seção de Cantoneiras     |
| `metalon.jpg`     | Card e seção de Metalon         |
| `bobinas.jpg`     | Card e seção de Bobinas         |
| `tintas.jpg`      | Card e seção de Tintas          |
| `loja-imesul.jpg` | Fundo do CTA final              |

**Dica:** Use imagens com pelo menos 1920×1080px para o hero e 800×600px para os produtos.

---

## 📝 Onde trocar textos

Tudo em `data/products.js`:

- **`products`** — Nome, subtítulo, descrição, specs de cada produto
- **`benefits`** — Os 4 diferenciais (Grande estoque, Qualidade, etc.)
- **`navLinks`** — Links do menu superior
- **`whatsapp.number`** — Número do WhatsApp (formato: 5567999999999)
- **`whatsapp.message`** — Mensagem padrão ao clicar no botão

---

## 🔗 Onde trocar links

Em `data/products.js`, objeto `navLinks`:

```js
{ label: "DOURADOS", href: "https://grupoimesul.com.br/dourados/", external: true },
{ label: "LOJA CAMPO GRANDE", href: "https://grupoimesul.com.br/campogrande/", external: true },
// etc.
```

---

## 📞 Onde trocar o WhatsApp

Em `data/products.js`:

```js
export const whatsapp = {
  number: "5567999999999", // ← Troque aqui (DDI + DDD + número, sem espaços)
  message: "Olá! Gostaria de fazer um orçamento.",
};
```

---

## 🎨 Paleta de cores

Definida em `tailwind.config.js` e `app/globals.css`:

| Variável          | Cor       | Uso                    |
|-------------------|-----------|------------------------|
| `--red`           | #D42B2B   | Destaque, CTAs         |
| `--blue`          | #0A1628   | Fundo principal        |
| `--blue-mid`      | #0D1F3C   | Fundo cards            |
| `--steel`         | #8BA0B4   | Textos secundários     |
| `--white`         | #F0F4F8   | Textos principais      |

---

## 🏗️ Build para produção

```bash
npm run build
npm start
```

---

## Stack

- **Next.js 14** — Framework React
- **Tailwind CSS** — Estilização utilitária
- **GSAP + ScrollTrigger** — Animações de scroll
- **Lenis** — Smooth scroll
- **Framer Motion** — Animações React
