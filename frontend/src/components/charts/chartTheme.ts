import { useIsDark } from "../../theme";

const LIGHT = {
  surface: "#ffffff",
  series1: "#2a78d6",
  series2: "#eb6834",
  grid: "#d0dbf0",
  axis: "#b5c6e8", 
  muted: "#4a5f99",
  ink: "#020f33", 
};

const DARK: typeof LIGHT = {
  surface: "#020f33", 
  series1: "#3987e5",
  series2: "#d95926",
  grid: "#0a1f55", 
  axis: "#1a3780", 
  muted: "#8a9ccb",
  ink: "#e8effc", 
};

export type ChartColors = typeof LIGHT;

export function useChartColors(): ChartColors {
  return useIsDark() ? DARK : LIGHT;
}
