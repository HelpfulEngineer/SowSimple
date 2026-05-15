import { Link } from "react-router-dom";
import type { Plant, ZoneRange } from "../types/plant";

const categoryStyles = {
  vegetable: "bg-moss/10 text-pine",
  herb: "bg-clay/10 text-clay",
  flower: "bg-amber-100 text-amber-900"
} as const;

type PlantCardProps = {
  plant: Plant;
  zoneRange: ZoneRange;
  statusLabel?: string;
  variant?: "card" | "list";
};

export function PlantCard({
  plant,
  zoneRange,
  statusLabel,
  variant = "card"
}: PlantCardProps) {
  const hasZoneTiming = plant.plantingWindows.some(
    (window) => window.zoneRange === zoneRange
  );
  const timingText = hasZoneTiming
    ? `Zone ${zoneRange} timing available`
    : "Detailed timing is still being expanded";

  if (variant === "list") {
    return (
      <Link
        to={`/plant/${plant.id}`}
        className="block border-l-4 border-transparent px-4 py-3 transition duration-150 odd:bg-white/70 even:bg-slate-50/80 hover:border-moss/60 hover:bg-moss/10 focus:border-pine focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pine/30 sm:px-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg text-slate-950 sm:text-xl">
                    {plant.name}
                  </p>
                  <span className={`label-chip ${categoryStyles[plant.category]}`}>
                    {plant.category}
                  </span>
                  {statusLabel ? (
                    <span className="label-chip bg-pine text-white">
                      {statusLabel}
                    </span>
                  ) : null}
                </div>

                <p className="summary-clamp mt-1 text-sm leading-5 text-slate-700">
                  {plant.summary}
                </p>
              </div>

              <span className="hidden shrink-0 text-sm font-semibold text-pine sm:inline">
                View Details
              </span>
            </div>

            <div className="mt-2 grid gap-1.5 border-t border-slate-300/80 pt-2 text-xs text-slate-600 sm:grid-cols-[minmax(0,1.4fr)_auto_auto] sm:items-center sm:gap-4 sm:text-sm">
              <p className="font-semibold text-slate-700">{timingText}</p>
              <p>
                <span className="font-semibold text-slate-900">Spacing:</span>{" "}
                {plant.spacing.minInches}-{plant.spacing.maxInches} in
              </p>
              <p>
                <span className="font-semibold text-slate-900">Harvest:</span>{" "}
                {plant.harvest.daysToFirstHarvestMin}-{plant.harvest.daysToFirstHarvestMax} days
              </p>
            </div>
          </div>

          <span className="shrink-0 pt-0.5 text-lg text-slate-400 sm:hidden">
            &gt;
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/plant/${plant.id}`}
      className="surface-card block h-full px-5 py-5 transition duration-150 hover:-translate-y-0.5 hover:border-moss/25 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-pine/35 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-slate-900">{plant.name}</p>
          <span className={`label-chip mt-2 ${categoryStyles[plant.category]}`}>
            {plant.category}
          </span>
        </div>

        {statusLabel ? (
          <span className="label-chip bg-pine text-white">{statusLabel}</span>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-700">{plant.summary}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-700">
        <div className="rounded-2xl bg-slate-900/4 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Spacing
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {plant.spacing.minInches}-{plant.spacing.maxInches} in
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-900/4 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            First harvest
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {plant.harvest.daysToFirstHarvestMin}-{plant.harvest.daysToFirstHarvestMax} days
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-slate-600">{timingText}</p>
    </Link>
  );
}
