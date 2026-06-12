import { createContext, useContext, useEffect, useState } from "react";
import type { WeightUnit, EnergyUnit } from "@/utils/units";

const WEIGHT_KEY = "ac-weight-unit";
const ENERGY_KEY = "ac-energy-unit";

interface UnitsContextValue {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  energyUnit: EnergyUnit;
  setEnergyUnit: (unit: EnergyUnit) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

function readWeightUnit(): WeightUnit {
  try {
    const stored = localStorage.getItem(WEIGHT_KEY);
    if (stored === "kg" || stored === "lbs") return stored;
  } catch (_) {}
  return "kg";
}

function readEnergyUnit(): EnergyUnit {
  try {
    const stored = localStorage.getItem(ENERGY_KEY);
    if (stored === "kcal" || stored === "kJ") return stored;
  } catch (_) {}
  return "kcal";
}

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(readWeightUnit);
  const [energyUnit, setEnergyUnitState] = useState<EnergyUnit>(readEnergyUnit);

  useEffect(() => {
    try { localStorage.setItem(WEIGHT_KEY, weightUnit); } catch (_) {}
  }, [weightUnit]);

  useEffect(() => {
    try { localStorage.setItem(ENERGY_KEY, energyUnit); } catch (_) {}
  }, [energyUnit]);

  function setWeightUnit(unit: WeightUnit) { setWeightUnitState(unit); }
  function setEnergyUnit(unit: EnergyUnit) { setEnergyUnitState(unit); }

  return (
    <UnitsContext.Provider value={{ weightUnit, setWeightUnit, energyUnit, setEnergyUnit }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used inside UnitsProvider");
  return ctx;
}
