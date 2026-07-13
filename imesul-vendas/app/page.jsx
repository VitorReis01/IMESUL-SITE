import ProjectSelector from "../components/ProjectSelector";
import SalesFooter from "../components/SalesFooter";

// Mantem a rota no servidor e delega o estado comercial ao componente cliente.
export default function Home() {
  return (
    <>
      <ProjectSelector />
      <SalesFooter />
    </>
  );
}
