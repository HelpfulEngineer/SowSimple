import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlantDetailPage } from "./pages/PlantDetailPage";
import { getStoredZone, setStoredZone } from "./lib/storage";
import type { USDAZone } from "./lib/zones";

export default function App() {
  const [selectedZone, setSelectedZoneState] = useState<USDAZone>(
    () => getStoredZone() ?? "6"
  );

  useEffect(() => {
    setStoredZone(selectedZone);
  }, [selectedZone]);

  return (
    <HashRouter>
      <Routes>
        <Route
          element={
            <AppLayout
              selectedZone={selectedZone}
              onZoneChange={setSelectedZoneState}
            />
          }
        >
          <Route index element={<HomePage />} />
          <Route path="plant/:plantId" element={<PlantDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
