interface ScsPlainData {
  A: number[][];
  b: number[];
  c: number[];
}

interface ScsCone {
  q: number[];
}

interface ScsResult {
  x: number[];
  y: number[];
  s: number[];
}

class ScsSettings {}

interface ScsSolver {
  solve(
    data: ScsPlainData,
    cone: ScsCone,
    settings: ScsSettings,
  ): Promise<ScsResult>;
  setDefaultSettings(settings: ScsSettings): void;
  ScsSettings: typeof ScsSettings;
}

declare function createSCS(): Promise<ScsSolver>;
