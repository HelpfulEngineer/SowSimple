import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useOutletContext
} from "react-router-dom";
import { LAST_FROST_BY_ZONE } from "../data/frostDates";
import { ZonePicker } from "../components/ZonePicker";
import { getZoneRange, type USDAZone } from "../lib/zones";
import appIcon from "../data/Sprout_whitebackground.png";
import wordmark from "../data/SowSimple_wordmark_transparent.png";

export type AppOutletContext = {
  selectedZone: USDAZone;
  onZoneChange: (zone: USDAZone) => void;
};

type AppLayoutProps = AppOutletContext;

export function AppLayout({
  selectedZone,
  onZoneChange
}: AppLayoutProps) {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement | null>(null);
  const [isNavOpen, setNavOpen] = useState(false);
  const zoneRange = getZoneRange(selectedZone);
  const frost = LAST_FROST_BY_ZONE[zoneRange];
  const activeSection = location.pathname.startsWith("/gardens")
    ? "Garden Bed Tracker"
    : "Plant Details";

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) return;

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setNavOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNavOpen]);

  return (
    <div className="min-h-screen pb-10">
      <header className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 lg:px-8">
        <div className="surface-card overflow-hidden">
          <div className="relative flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-5">
            <div ref={navRef} className="relative">
              <button
                type="button"
                onClick={() => setNavOpen((open) => !open)}
                className="action-button-secondary h-12 w-12 rounded-2xl p-0"
                aria-expanded={isNavOpen}
                aria-controls="app-section-nav"
              >
                <span className="sr-only">
                  {isNavOpen ? "Close navigation" : "Open navigation"}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-5 w-6 flex-col justify-between"
                >
                  <span className="h-0.5 rounded-full bg-slate-800" />
                  <span className="h-0.5 rounded-full bg-slate-800" />
                  <span className="h-0.5 rounded-full bg-slate-800" />
                </span>
              </button>

              {isNavOpen ? (
                <nav
                  id="app-section-nav"
                  className="absolute left-0 top-full z-40 mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-soft"
                  aria-label="App sections"
                >
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      isActive
                        ? "block border-l-4 border-pine bg-moss/10 px-4 py-4 text-slate-950"
                        : "block border-l-4 border-transparent px-4 py-4 text-slate-800 hover:bg-slate-50"
                    }
                  >
                    <span className="block font-semibold">Plant Details</span>
                    <span className="mt-1 block text-sm text-slate-600">
                      Search, timing, harvest, and care notes.
                    </span>
                  </NavLink>
                  <NavLink
                    to="/gardens"
                    className={({ isActive }) =>
                      isActive
                        ? "block border-l-4 border-pine bg-moss/10 px-4 py-4 text-slate-950"
                        : "block border-l-4 border-transparent px-4 py-4 text-slate-800 hover:bg-slate-50"
                    }
                  >
                    <span className="block font-semibold">
                      Garden Bed Tracker
                    </span>
                    <span className="mt-1 block text-sm text-slate-600">
                      Beds, nicknames, shapes, and planted locations.
                    </span>
                  </NavLink>
                </nav>
              ) : null}
            </div>

            <p className="text-sm font-semibold text-slate-700">
              {activeSection}
            </p>
          </div>

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
