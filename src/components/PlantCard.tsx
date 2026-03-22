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
};

export function PlantCard({
  plant,
  zoneRange,
  statusLabel
}: PlantCardProps) {
  const hasZoneTiming = plant.plantingWindows.some(
    (window) => window.zoneRange === zoneRange
  );

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

      <p className="mt-4 text-sm text-slate-600">
        {hasZoneTiming
          ? `Zone ${zoneRange} timing available`
          : "Detailed timing is still being expanded"}
      </p>
    </Link>
  );
}
