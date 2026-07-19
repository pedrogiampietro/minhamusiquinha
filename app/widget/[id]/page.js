import Widget from "./Widget";

// Página pública (sem Clerk) embutida no OBS como Browser Source.
export default async function WidgetPage({ params }) {
  const { id } = await params;
  return <Widget id={id} />;
}
