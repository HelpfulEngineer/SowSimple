import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAppOutletContext } from "../app/AppLayout";
import { EmptyState } from "../components/EmptyState";
import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { getPlantById } from "../data/plants";
import { calculateHarvestWindow } from "../lib/calculateHarvestWindow";
import {
  formatDateInput,
  formatDateRange,
  formatLongDate,
  normalizeCalendarDate,
  parseDateInput
} from "../lib/date";
import { downloadICS, generateICSFile } from "../lib/generateICS";
import {
  CALCULATOR_METHODS,
  METHOD_LABELS,
  getLastFrostAnchor,
  getWindowStatus,
  resolvePlantingMethodWindow,
  type PlantingMethodKey
} from "../lib/resolvePlantingWindow";
import { pushRecentPlantId } from "../lib/storage";
import { getZoneRange } from "../lib/zones";
import type { PlantingWindow } from "../types/plant";

const seasonOrder: Record<string, number> = {
  spring: 0,
  summer: 1,
  fall: 2
};

const categoryStyles = {
  vegetable: "bg-moss/10 text-pine",
  herb: "bg-clay/10 text-clay",
  flower: "bg-amber-100 text-amber-900"
} as const;

const displayMethodOrder: PlantingMethodKey[] = [
  "startIndoors",
  "transplantOutdoors",
  "directSow"
];

const preferredMethodOrder: PlantingMethodKey[] = [
  "directSow",
  "transplantOutdoors",
  "startIndoors"
];

type CalculatedPlan = {
  method: PlantingMethodKey;
  plantingDate: Date;
};

function orderedWindows(windows: PlantingWindow[]) {
  return [...windows].sort(
    (left, right) => seasonOrder[left.season] - seasonOrder[right.season]
  );
}

function getSupportedMethodLabels(windows: PlantingWindow[]) {
  return displayMethodOrder
    .filter((methodKey) => windows.some((window) => Boolean(window[methodKey])))
    .map((methodKey) => METHOD_LABELS[methodKey]);
}

function getBestMethodLabel(windows: PlantingWindow[]) {
  const method = preferredMethodOrder.find((methodKey) =>
    windows.some((window) => Boolean(window[methodKey]))
  );

  return method ? METHOD_LABELS[method] : "Timing expanding";
}

function getStatusClass(status: string) {
  if (status === "Open now") {
    return "label-chip justify-self-start bg-pine text-white";
  }

  if (status === "Upcoming") {
    return "label-chip justify-self-start bg-amber-100 text-amber-900";
  }

  return "label-chip justify-self-start bg-slate-100 text-slate-700";
}

export function PlantDetailPage() {
  const { plantId } = useParams();
  const { selectedZone } = useAppOutletContext();
  const plant = getPlantById(plantId ?? "");
  const [today] = useState(() => normalizeCalendarDate(new Date()));
  const zoneRange = getZoneRange(selectedZone);
  const frost = LAST_FROST_BY_ZONE[zoneRange];
  const anchor = getLastFrostAnchor(zoneRange, today.getFullYear());
  const relevantWindows = plant
    ? orderedWindows(
        plant.plantingWindows.filter((window) => window.zoneRange === zoneRange)
      )
    : [];
  const calculatorMethods = plant
    ? CALCULATOR_METHODS.filter((method) =>
        plant.plantingWindows.some((window) => Boolean(window[method]))
      )
    : [];
  const calculatorMethodsKey = calculatorMethods.join("|");

  const [method, setMethod] = useState<PlantingMethodKey | "">(
    calculatorMethods[0] ?? ""
  );
  const [plantingDate, setPlantingDate] = useState(formatDateInput(today));
  const [harvestWindow, setHarvestWindow] = useState(
    plant && calculatorMethods[0]
      ? calculateHarvestWindow(today, plant.harvest)
      : null
  );
  const [calculatedPlan, setCalculatedPlan] = useState<CalculatedPlan | null>(
    plant && calculatorMethods[0]
      ? { method: calculatorMethods[0], plantingDate: today }
      : null
  );

  useEffect(() => {
    if (!plant) return;
    pushRecentPlantId(plant.id);
  }, [plant]);

  useEffect(() => {
    setMethod((currentMethod) => {
      if (currentMethod && calculatorMethods.includes(currentMethod)) {
        return currentMethod;
      }

      return calculatorMethods[0] ?? "";
    });
  }, [calculatorMethodsKey]);

  useEffect(() => {
    if (!plant || calculatorMethods.length === 0) {
      setHarvestWindow(null);
      setCalculatedPlan(null);
      return;
    }

    const nextMethod = calculatorMethods[0];
    setPlantingDate(formatDateInput(today));
    setHarvestWindow(calculateHarvestWindow(today, plant.harvest));
    setCalculatedPlan(
      nextMethod ? { method: nextMethod, plantingDate: today } : null
    );
  }, [calculatorMethodsKey, plant, today]);

  if (!plant) {
    return (
      <EmptyState
        title="That plant is not in the library."
        description="Go back to the home page and browse the plant list to open an available detail card."
      />
    );
  }

  const currentPlant = plant;

  function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedDate = parseDateInput(plantingDate);
    if (!parsedDate || !method) return;

    startTransition(() => {
      setHarvestWindow(calculateHarvestWindow(parsedDate, currentPlant.harvest));
      setCalculatedPlan({ method, plantingDate: parsedDate });
    });
  }

  function handleExport() {
    if (!harvestWindow || !calculatedPlan) return;

    const blob = generateICSFile(`${currentPlant.id}-${calculatedPlan.method}.ics`, [
      {
        title: `${currentPlant.name}: ${METHOD_LABELS[calculatedPlan.method]}`,
        description: `Plant in zone ${selectedZone}. Reference frost anchor: ${frost.label}.`,
        startDate: calculatedPlan.plantingDate
      },
      {
        title: `${currentPlant.name}: harvest window opens`,
        description: `Earliest harvest estimate starts ${formatLongDate(
          harvestWindow.harvestStartMin
        )}. Most likely opening range is ${formatDateRange(
          harvestWindow.harvestStartMin,
          harvestWindow.harvestStartMax
        )}.`,
        startDate: harvestWindow.harvestStartMin
      },
      {
        title: `${currentPlant.name}: harvest window closes`,
        description: `Latest harvest estimate ends ${formatLongDate(
          harvestWindow.harvestEndMax
        )}. Full closing range is ${formatDateRange(
          harvestWindow.harvestEndMin,
          harvestWindow.harvestEndMax
        )}.`,
        startDate: harvestWindow.harvestEndMax
      }
    ]);

    downloadICS(`${currentPlant.id}-${calculatedPlan.method}-plan`, blob);
  }

  const companionGroups = [
    {
      confidence: "practical",
      title: "Practical",
      description:
        "Evidence-backed, insect-support, or clear space-sharing companions.",
      companions: currentPlant.companions.filter(
        (companion) => companion.confidence === "practical"
      )
    },
    {
      confidence: "traditional",
      title: "Traditional",
      description:
        "Common garden pairings with more folklore or gardener-experience support.",
      companions: currentPlant.companions.filter(
        (companion) => companion.confidence === "traditional"
      )
    }
  ].filter((group) => group.companions.length > 0);
  const supportedMethodLabels = getSupportedMethodLabels(relevantWindows);
  const bestMethodLabel = getBestMethodLabel(relevantWindows);
  const firstYieldLabel =
    plant.category === "flower" ? "First blooms" : "First harvest";

  return (
    <div className="space-y-7 pb-6">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <Link
          to="/"
          className="action-button-secondary min-h-11 px-4 py-2 text-sm"
        >
          Back to results
        </Link>
        <span>Zone {selectedZone}</span>
      </div>

      <section className="surface-card px-5 py-6 sm:px-7 sm:py-7">
        <div className="space-y-4">
          <span className={`label-chip ${categoryStyles[plant.category]}`}>
            {plant.category}
          </span>
          <div className="space-y-3">
            <h2 className="font-display text-4xl text-slate-900 sm:text-5xl">
              {plant.name}
            </h2>
            <p className="max-w-3xl text-base leading-7 text-slate-700">
              {plant.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-[1.25rem] bg-slate-900/4 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Category
              </p>
              <p className="mt-1 font-semibold capitalize text-slate-950">
                {plant.category}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-900/4 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Zone bucket
              </p>
              <p className="mt-1 font-semibold text-slate-950">{zoneRange}</p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-900/4 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Spacing
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {plant.spacing.minInches}-{plant.spacing.maxInches} in
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-slate-900/4 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {firstYieldLabel}
              </p>
              <p className="mt-1 font-semibold text-slate-950">
                {plant.harvest.daysToFirstHarvestMin}-{plant.harvest.daysToFirstHarvestMax} days
              </p>
            </div>
            <div className="col-span-2 rounded-[1.25rem] bg-pine px-4 py-3 text-white sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                Best method
              </p>
              <p className="mt-1 font-semibold">{bestMethodLabel}</p>
            </div>
          </div>

          {plant.seasonalityNotes?.length ? (
            <div className="flex flex-wrap gap-2">
              {plant.seasonalityNotes.map((note) => (
                <span
                  key={note}
                  className="label-chip bg-slate-100 text-slate-700"
                >
                  {note}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-7">
          <section className="surface-card px-5 py-6 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Care Note
            </p>
            <h3 className="mt-1 font-display text-2xl text-slate-900">
              Pruning and cut-back
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {plant.pruning.shortGuide}
            </p>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Zone Timing
              </p>
              <h3 className="mt-1 font-display text-2xl text-slate-900">
                Planting guidance for zone {selectedZone}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Indoor seed-start dates are reference guidance only. Harvest
                calculations use outdoor sowing or transplant dates.
              </p>
              <p className="mt-3 max-w-3xl rounded-2xl border border-moss/20 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600">
                Timing is approximate by USDA bucket and frost anchor. Treat
                this as a planning range, then adjust for your local soil,
                weather, and microclimate.
              </p>
            </div>

            {relevantWindows.length > 0 ? (
              <div className="surface-card overflow-hidden">
                <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Supported methods:{" "}
                      <span className="text-slate-600">
                        {supportedMethodLabels.join(", ")}
                      </span>
                    </p>
                    <span className="text-sm text-slate-500">
                      Frost anchor {formatLongDate(anchor)}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-200/80">
                  {relevantWindows.map((window, windowIndex) => {
                    const rows = displayMethodOrder.flatMap((methodKey) => {
                      const resolved = resolvePlantingMethodWindow(
                        anchor,
                        window[methodKey]
                      );

                      if (!resolved) return [];

                      return [
                        {
                          methodKey,
                          resolved,
                          status: getWindowStatus(
                            today,
                            resolved.start,
                            resolved.end
                          )
                        }
                      ];
                    });

                    return (
                      <article
                        key={`${window.zoneRange}-${window.season}-${windowIndex}`}
                        className="bg-white/75"
                      >
                        <div className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:px-6">
                          <div>
                            <span className="label-chip bg-pine text-white capitalize">
                              {window.season}
                            </span>
                            {window.notes ? (
                              <p className="mt-3 text-sm leading-6 text-slate-600">
                                {window.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
                            <div className="hidden grid-cols-[1fr_1.35fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid">
                              <span>Method</span>
                              <span>Date range</span>
                              <span>Status</span>
                            </div>

                            <div className="divide-y divide-slate-200">
                              {rows.map(({ methodKey, resolved, status }) => (
                                <div
                                  key={`${window.season}-${methodKey}`}
                                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_1.35fr_auto] sm:items-center sm:gap-3"
                                >
                                  <p className="font-semibold text-slate-950">
                                    {METHOD_LABELS[methodKey]}
                                  </p>
                                  <p className="text-slate-700">
                                    {formatDateRange(
                                      resolved.start,
                                      resolved.end
                                    )}
                                  </p>
                                  <span className={getStatusClass(status)}>
                                    {status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Timing notes are still being expanded for this zone."
                description="This plant remains searchable and harvest calculations still work when planting method guidance is available."
              />
            )}
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Companions
              </p>
              <h3 className="mt-1 font-display text-2xl text-slate-900">
                Positive companion planting notes
              </h3>
            </div>

            {plant.companions.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {companionGroups.map((group) => (
                  <section
                    key={group.confidence}
                    className="surface-card overflow-hidden"
                  >
                    <div className="border-b border-slate-200/80 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="font-semibold text-slate-900">
                          {group.title}
                        </h4>
                        <span
                          className={
                            group.confidence === "practical"
                              ? "label-chip bg-pine text-white"
                              : "label-chip bg-clay/12 text-clay"
                          }
                        >
                          {group.companions.length}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {group.description}
                      </p>
                    </div>

                    <div className="divide-y divide-slate-200/80">
                      {group.companions.map((companion) => (
                        <Link
                          key={`${plant.id}-${companion.plantId}`}
                          to={`/plant/${companion.plantId}`}
                          className="block px-5 py-4 transition hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pine/30 sm:px-6"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {companion.name}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">
                                {companion.reason}
                              </p>
                            </div>
                            <span className="shrink-0 pt-1 text-sm font-semibold text-pine">
                              View
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Companion notes coming soon"
                description="The app only shows positive companion pairings. This entry does not have a stored pairing yet."
              />
            )}
          </section>
        </div>

        <div className="space-y-7">
          <section className="surface-card px-5 py-6 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              {plant.category === "flower" ? "Bloom Timing" : "Harvest Timing"}
            </p>
            <h3 className="mt-1 font-display text-2xl text-slate-900">
              Estimated production window
            </h3>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.5rem] bg-slate-900/4 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {firstYieldLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {plant.harvest.daysToFirstHarvestMin}-{plant.harvest.daysToFirstHarvestMax} days
                  after planting
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-slate-900/4 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Ongoing window
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {plant.harvest.windowLengthDaysMin}-{plant.harvest.windowLengthDaysMax} days
                </p>
              </div>
            </div>
            {plant.harvest.notes ? (
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {plant.harvest.notes}
              </p>
            ) : null}
          </section>

          <section className="surface-card px-5 py-6 sm:px-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                Calculator
              </p>
              <h3 className="font-display text-2xl text-slate-900">
                Predict the harvest window
              </h3>
            </div>

            {calculatorMethods.length > 0 ? (
              <>
                <form className="mt-5 space-y-4" onSubmit={handleCalculate}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">
                      Planting method
                    </span>
                    <select
                      value={method}
                      onChange={(event) =>
                        setMethod(event.target.value as PlantingMethodKey)
                      }
                      className="field-shell"
                    >
                      {calculatorMethods.map((methodOption) => (
                        <option key={methodOption} value={methodOption}>
                          {METHOD_LABELS[methodOption]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800">
                      Planting date
                    </span>
                    <input
                      type="date"
                      value={plantingDate}
                      onChange={(event) => setPlantingDate(event.target.value)}
                      className="field-shell"
                    />
                  </label>

                  <button type="submit" className="action-button-primary w-full">
                    Calculate harvest window
                  </button>
                </form>

                {harvestWindow ? (
                  <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-pine/20 bg-white">
                    <div className="bg-pine px-4 py-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                        Last calculated plan
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {calculatedPlan
                          ? METHOD_LABELS[calculatedPlan.method]
                          : "Planting plan"}
                      </p>
                      {calculatedPlan ? (
                        <p className="mt-1 text-sm text-white/80">
                          Planting date {formatLongDate(calculatedPlan.plantingDate)}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 p-4">
                      <div className="rounded-[1.25rem] bg-slate-900/4 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Window opens
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatDateRange(
                            harvestWindow.harvestStartMin,
                            harvestWindow.harvestStartMax
                          )}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] bg-slate-900/4 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Window closes
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatDateRange(
                            harvestWindow.harvestEndMin,
                            harvestWindow.harvestEndMax
                          )}
                        </p>
                      </div>

                      <p className="text-sm leading-6 text-slate-600">
                        Calendar export creates reminders for the planting date,
                        harvest window opening, and harvest window closing.
                      </p>

                      <button
                        type="button"
                        className="action-button-primary w-full"
                        onClick={handleExport}
                      >
                        Export this plan
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No calculator methods available yet"
                description="This entry needs outdoor sowing or transplant guidance before the date-based harvest calculator can run."
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
