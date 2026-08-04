import { createContext, useContext, useEffect, useState } from "react";
import { weightUnitFor, type UnitSystem, type WeightUnit } from "@/utils/units";

const SYSTEM_KEY = "ac-unit-system";
/** Pre-2026-08 key, migrated once: users who displayed lbs get imperial. */
const LEGACY_WEIGHT_KEY = "ac-weight-unit";
const LEGACY_ENERGY_KEY = "ac-energy-unit";

interface UnitsContextValue {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
  /** Derived weight unit for the active system: kg (metric) | lbs (imperial) */
  weightUnit: WeightUnit;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

function readSystem(): UnitSystem {
  try {
    const stored = localStorage.getItem(SYSTEM_KEY);
    if (stored === "metric" || stored === "imperial") return stored;
    // One-time migration from the old per-unit preferences.
    if (localStorage.getItem(LEGACY_WEIGHT_KEY) === "lbs") return "imperial";
  } catch {
    /* storage unavailable */
  }
  return "metric";
}

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [system, setSystemState] = useState<UnitSystem>(readSystem);

  useEffect(() => {
    try {
      localStorage.setItem(SYSTEM_KEY, system);
      localStorage.removeItem(LEGACY_WEIGHT_KEY);
      localStorage.removeItem(LEGACY_ENERGY_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [system]);

  function setSystem(next: UnitSystem) {
    setSystemState(next);
  }

  return (
    <UnitsContext.Provider value={{ system, setSystem, weightUnit: weightUnitFor(system) }}>
      {children}
    </UnitsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook belong together
export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used inside UnitsProvider");
  return ctx;
}
