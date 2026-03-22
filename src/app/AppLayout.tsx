import { Link, Outlet, useOutletContext } from "react-router-dom";
import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { ZonePicker } from "../components/ZonePicker";
import { getZoneRange, type USDAZone } from "../lib/zones";
import appIcon from "../data/Sprout_whitebackground.png";
import wordmark from "../data/SowSimple_wordmark_cropped.png";

export type AppOutletContext = {
  selectedZone: USDAZone;
  onZoneChange: (zone: USDAZone) => void;
};

type AppLayoutProps = AppOutletContext;

export function AppLayout({
  selectedZone,
  onZoneChange
}: AppLayoutProps) {
  const zoneRange = getZoneRange(selectedZone);
  const frost = LAST_FROST_BY_ZONE[zoneRange];

  return (
    <div className="min-h-screen pb-10">
      <header className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden">
          <div className="grid gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-3">
              <Link to="/" className="inline-flex items-center gap-3 sm:gap-5">
                <img
                  src={appIcon}
                  alt=""
                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-pine/15 sm:h-14 sm:w-14"
                />
                <img
                  src={wordmark}
                  alt="Sow Simple"
                  className="h-14 w-auto sm:h-16 lg:h-20"
                />
              </Link>
              <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
                Quick planting windows, spacing, pruning notes, and harvest
                reminders for a small home garden.
              </p>
            </div>

            <div className="rounded-[1.75rem] bg-slate-900/4 p-4">
              <ZonePicker value={selectedZone} onChange={onZoneChange} />
              <p className="mt-3 text-sm text-slate-600">
                Using planting bucket <span className="font-semibold">{zoneRange}</span>.
                Approximate last frost:{" "}
                <span className="font-semibold">{frost.label}</span>.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Outlet context={{ selectedZone, onZoneChange }} />
      </main>

      <footer className="mx-auto mt-10 max-w-6xl px-4 text-sm text-slate-600 sm:px-6 lg:px-8">
        <p>
          Planting dates are approximate household reference guides. Local
          weather still wins.
        </p>
      </footer>
    </div>
  );
}

export function useAppOutletContext() {
  return useOutletContext<AppOutletContext>();
}
