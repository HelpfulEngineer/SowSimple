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

function orderedWindows(windows: PlantingWindow[]) {
  return [...windows].sort(
    (left, right) => seasonOrder[left.season] - seasonOrder[right.season]
  );
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
      return;
    }

    setPlantingDate(formatDateInput(today));
    setHarvestWindow(calculateHarvestWindow(today, plant.harvest));
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
    });
  }

  function handleExport() {
    if (!harvestWindow || !method) return;

    const parsedDate = parseDateInput(plantingDate);
    if (!parsedDate) return;

    const blob = generateICSFile(`${currentPlant.id}-${method}.ics`, [
      {
        title: `${currentPlant.name}: ${METHOD_LABELS[method]}`,
        description: `Plant in zone ${selectedZone}. Reference frost anchor: ${frost.label}.`,
        startDate: parsedDate
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

    downloadICS(`${currentPlant.id}-${method}-plan`, blob);
  }

  return (
    <div className="space-y-7 pb-6">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <Link
          to="/"
          className="action-button-secondary min-h-11 px-4 py-2 text-sm"
        >
          Back to home
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

          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            <span className="label-chip bg-slate-900/6 text-slate-700">
              Zone bucket {zoneRange}
            </span>
            <span className="label-chip bg-slate-900/6 text-slate-700">
              Frost anchor {frost.label}
            </span>
            <span className="label-chip bg-slate-900/6 text-slate-700">
              Spacing {plant.spacing.minInches}-{plant.spacing.maxInches} in
            </span>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] bg-slate-900/4 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Spacing range
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {plant.spacing.minInches}-{plant.spacing.maxInches} inches
                </p>
              </div>
              <div className="rounded-[1.75rem] bg-slate-900/4 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Pruning and cut-back
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {plant.pruning.shortGuide}
                </p>
              </div>
            </div>
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
            </div>

            {relevantWindows.length > 0 ? (
              <div className="space-y-4">
                {relevantWindows.map((window) => (
                  <article
                    key={`${window.zoneRange}-${window.season}-${window.notes ?? "default"}`}
                    className="surface-card px-5 py-5 sm:px-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="label-chip bg-pine text-white">
                          {window.season}
                        </span>
                        {window.notes ? (
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                            {window.notes}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm text-slate-500">
                        Last frost anchor {formatLongDate(anchor)}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {(["startIndoors", "transplantOutdoors", "directSow"] as const)
                        .filter((methodKey) => Boolean(window[methodKey]))
                        .map((methodKey) => {
                          const resolved = resolvePlantingMethodWindow(
                            anchor,
                            window[methodKey]
                          );

                          if (!resolved) return null;

                          const status = getWindowStatus(
                            today,
                            resolved.start,
                            resolved.end
                          );

                          return (
                            <div
                              key={methodKey}
                              className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {METHOD_LABELS[methodKey]}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-700">
                                    {formatDateRange(resolved.start, resolved.end)}
                                  </p>
                                </div>
                                <span
                                  className={
                                    status === "Open now"
                                      ? "label-chip bg-pine text-white"
                                      : status === "Upcoming"
                                        ? "label-chip bg-amber-100 text-amber-900"
                                        : "label-chip bg-slate-100 text-slate-700"
                                  }
                                >
                                  {status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </article>
                ))}
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
              <div className="grid gap-3">
                {plant.companions.map((companion) => (
                  <article
                    key={`${plant.id}-${companion.plantId}`}
                    className="surface-card px-5 py-5 sm:px-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-900">
                        {companion.name}
                      </h4>
                      <span
                        className={
                          companion.confidence === "practical"
                            ? "label-chip bg-pine text-white"
                            : "label-chip bg-clay/12 text-clay"
                        }
                      >
                        {companion.confidence}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {companion.reason}
                    </p>
                  </article>
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
                  First {plant.category === "flower" ? "blooms" : "harvest"}
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
                  <div className="mt-5 space-y-3 rounded-[1.75rem] bg-slate-900/4 p-4">
                    <div>
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
                    <div>
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
                    <button
                      type="button"
                      className="action-button-secondary w-full"
                      onClick={handleExport}
                    >
                      Export to calendar
                    </button>
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
