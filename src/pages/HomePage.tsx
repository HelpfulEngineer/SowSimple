import { useDeferredValue, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAppOutletContext } from "../app/AppLayout";
import { EmptyState } from "../components/EmptyState";
import { FilterChips } from "../components/FilterChips";
import { InstallPrompt } from "../components/InstallPrompt";
import { PlantCard } from "../components/PlantCard";
import { SearchBar } from "../components/SearchBar";
import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { getPlantById, plants } from "../data/plants";
import { formatLongDate, normalizeCalendarDate } from "../lib/date";
import { getPlantsPlantableNow } from "../lib/isPlantableNow";
import {
  searchPlants,
  type PlantCategoryFilter
} from "../lib/searchPlants";
import { getRecentPlantIds } from "../lib/storage";
import { getZoneRange } from "../lib/zones";

const statusOrder: Record<string, number> = {
  "Direct sow now": 0,
  "Transplant now": 1,
  "Start indoors now": 2
};

export function HomePage() {
  const location = useLocation();
  const { selectedZone } = useAppOutletContext();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlantCategoryFilter>("all");
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentPlantIds());

  const today = normalizeCalendarDate(new Date());
  const deferredQuery = useDeferredValue(query);
  const zoneRange = getZoneRange(selectedZone);
  const frost = LAST_FROST_BY_ZONE[zoneRange];
  const plantableNow = getPlantsPlantableNow(plants, zoneRange, today).sort(
    (left, right) =>
      statusOrder[left.label] - statusOrder[right.label] ||
      left.plant.name.localeCompare(right.plant.name)
  );
  const liveLabels = new Map(
    plantableNow.map((match) => [match.plant.id, match.label])
  );
  const filteredPlants = searchPlants(plants, deferredQuery, category);
  const recentPlants = recentIds.flatMap((plantId) => {
    const plant = getPlantById(plantId);
    return plant ? [plant] : [];
  });

  useEffect(() => {
    setRecentIds(getRecentPlantIds());
  }, [location.key]);

  return (
    <div className="space-y-7 pb-6">
      <section className="surface-card px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5">
          <div className="space-y-3">
            <span className="label-chip bg-pine text-white">
              Today in zone {selectedZone}
            </span>
            <h2 className="font-display text-3xl text-slate-900 sm:text-4xl">
              Find what to plant now and when to expect the harvest.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">
              Current recommendations use USDA bucket <strong>{zoneRange}</strong>{" "}
              with an approximate last frost of <strong>{frost.label}</strong>.
              Search the full library, then export planting and harvest reminders
              as a calendar file that still works offline.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            <span className="label-chip bg-slate-900/6 text-slate-700">
              Today: {formatLongDate(today)}
            </span>
            <span className="label-chip bg-slate-900/6 text-slate-700">
              Frost anchor: {frost.label}
            </span>
          </div>

          <SearchBar value={query} onChange={setQuery} />
          <InstallPrompt />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Planting Now
            </p>
            <h2 className="mt-1 font-display text-2xl text-slate-900">
              What can I plant right now?
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Based on zone {selectedZone} and today&apos;s date.
          </p>
        </div>

        {plantableNow.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plantableNow.map((match) => (
              <PlantCard
                key={`${match.plant.id}-${match.label}`}
                plant={match.plant}
                zoneRange={zoneRange}
                statusLabel={match.label}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing is inside a live planting window today."
            description="Try another USDA zone, or open a plant card to browse full timing guidance for spring and fall windows."
          />
        )}
      </section>

      {recentPlants.length > 0 ? (
        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Recently Viewed
            </p>
            <h2 className="mt-1 font-display text-2xl text-slate-900">
              Pick up where you left off
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                zoneRange={zoneRange}
                statusLabel={liveLabels.get(plant.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Browse Library
            </p>
            <h2 className="mt-1 font-display text-2xl text-slate-900">
              All plants
            </h2>
          </div>
          <FilterChips value={category} onChange={setCategory} />
        </div>

        {filteredPlants.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                zoneRange={zoneRange}
                statusLabel={liveLabels.get(plant.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No plants matched that search."
            description="Try a broader term, switch categories, or search by a companion plant like marigold or dill."
          />
        )}
      </section>
    </div>
  );
}
