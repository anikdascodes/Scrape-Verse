import { getJSON, type TravelOverview } from "@/lib/api";
import TravelView from "@/components/travel-view";

export const dynamic = "force-dynamic";

export default async function TravelPage() {
  const data = await getJSON<TravelOverview>("/api/travel/overview?city=Goa");

  if (!data) {
    return (
      <div className="panel p-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        Worker unreachable — start it with <span className="mono">npm run worker</span>.
      </div>
    );
  }

  return <TravelView data={data} />;
}
