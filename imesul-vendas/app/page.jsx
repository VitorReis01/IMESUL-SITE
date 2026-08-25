import ProjectSelector from "../components/ProjectSelector";

// Mantem a rota no servidor e delega o estado comercial ao componente cliente. O rodape agora
// e renderizado dentro do ProjectSelector (precisa saber se o orcamento guiado esta aberto).
export default function Home() {
  return <ProjectSelector />;
}
