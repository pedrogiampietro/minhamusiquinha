import Dashboard from "./Dashboard";

// Protegido pelo middleware — só usuários logados chegam aqui.
export default function DashboardPage() {
  return <Dashboard />;
}
