"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

const chapters = [
  {
    number: "01",
    eyebrow: "NOSSA HISTÓRIA",
    title: "50 anos de história",
    text: "Há mais de 50 anos a IMESUL fornece aço e soluções para construção, indústria, serralheria e agronegócio em Mato Grosso do Sul.",
    image: "/images/company/historia-imesul.jpg",
    imageAlt: "Vista aérea da unidade da IMESUL em Dourados",
  },
  {
    number: "02",
    eyebrow: "ONDE TUDO COMEÇOU",
    title: "Matriz em Dourados",
    text: "A história da IMESUL começou em Dourados e cresceu acompanhando o desenvolvimento da região.",
    image: "/images/company/matriz-dourados.jpg",
    imageAlt: "Matriz da IMESUL vista do alto em Dourados",
  },
  {
    number: "03",
    eyebrow: "CONFIANÇA CONSTRUÍDA",
    title: "+1 milhão de clientes atendidos",
    text: "Ao longo das décadas, milhares de profissionais, empresas, construtoras, serralheiros e produtores rurais confiaram na IMESUL.",
    metric: "+1M",
    metricLabel: "CLIENTES ATENDIDOS",
    image: "/images/company/clientes-imesul.jpg",
    imageAlt: "Estrutura da IMESUL integrada à região de Dourados",
  },
  {
    number: "04",
    eyebrow: "PRONTA ENTREGA",
    title: "Estrutura e estoque",
    text: "Tubos, chapas, perfis, telhas, laminados e acessórios disponíveis para atender desde pequenas demandas até grandes projetos.",
    image: "/images/company/estrutura-estoque.jpg",
    imageAlt: "Vista aproximada da estrutura industrial da IMESUL",
  },
  {
    number: "05",
    eyebrow: "CREDIBILIDADE IMESUL",
    title: "Por que escolher a IMESUL",
    highlights: [
      "50 anos de mercado",
      "Estoque próprio",
      "Atendimento especializado",
      "Entrega regional",
      "Mais de 1 milhão de clientes atendidos",
      "Campo Grande e Dourados",
    ],
  },
];

function StoryVisual({ chapter, index }) {
  if (chapter.highlights) {
    return (
      <div className="story-credibility" aria-label="Diferenciais da IMESUL">
        <span className="story-visual__index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <p className="story-credibility__label">A confiança de quem constrói</p>
        <ul>
          {chapter.highlights.map((highlight) => (
            <li key={highlight}>
              <span aria-hidden="true">✓</span>
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="story-visual">
      <span className="story-visual__index">{String(index + 1).padStart(2, "0")}</span>
      <div className="story-visual__grid" />
      <Image
        src={chapter.image}
        alt={chapter.imageAlt}
        fill
        sizes="(max-width: 767px) 92vw, 58vw"
        className="story-photo"
      />
      <div className="story-photo__shade" />
      {chapter.metric && (
        <div className="story-metric">
          <strong>{chapter.metric}</strong>
          <span>{chapter.metricLabel}</span>
        </div>
      )}
    </div>
  );
}

export default function CompanyStory() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const updatePosition = (nextProgress) => {
      const nextX =
        window.innerWidth >= 768 ? -nextProgress * 5 * window.innerWidth : 0;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${nextX}px, 0, 0)`;
      }
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${nextProgress})`;
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => updatePosition(self.progress),
      onRefresh: (self) => updatePosition(self.progress),
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} id="nossa-historia" className="company-story">
      <div className="company-story__sticky">
        <div className="company-story__topline">
          <span>IMESUL / TRAJETÓRIA</span>
          <span className="company-story__topline-rule" />
          <span>MATO GROSSO DO SUL</span>
        </div>

        <div
          ref={trackRef}
          className="company-story__track"
        >
          {chapters.map((chapter, index) => (
            <article className="story-panel" key={chapter.title}>
              <div className="story-panel__content">
                <span className="story-panel__number">{chapter.number} / 06</span>
                <p className="story-panel__eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
                {chapter.text && (
                  <p className="story-panel__text">{chapter.text}</p>
                )}
              </div>
              <StoryVisual chapter={chapter} index={index} />
            </article>
          ))}

          <article className="story-panel story-panel--video">
            <video
              className="story-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Estrutura da fábrica da IMESUL em Dourados"
            >
              <source src="/videos/fabrica-dourados-hero.mp4" type="video/mp4" />
            </video>
            <div className="story-video__shade" />
            <div className="story-video__content">
              <span className="story-panel__number">06 / 06</span>
              <p className="story-panel__eyebrow">POR DENTRO DA IMESUL</p>
              <h2>Aço que movimenta projetos</h2>
              <p className="story-panel__text">
                Conheça de perto a estrutura da IMESUL e veja como o aço chega
                até quem constrói.
              </p>
            </div>
          </article>
        </div>

        <div className="company-story__progress" aria-hidden="true">
          <span ref={progressRef} />
        </div>
      </div>
    </section>
  );
}
