"use client";

import { LazyMotion } from "framer-motion";

const loadMotionFeatures = () =>
  import("./motionFeatures").then((module) => module.default);

// Disponibiliza animacoes de DOM e carrega os recursos depois do HTML inicial.
export default function MotionProvider({ children }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {children}
    </LazyMotion>
  );
}
