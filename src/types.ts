export interface PredictionResult {
  period: string;
  size: "BIG" | "SMALL";
  opposites: number[];
}

export interface BingoDraw {
  issueNumber: string;
  number: string;
  openTime?: string;
}

export interface HistoryItem {
  period: string;
  predictedSize: "BIG" | "SMALL";
  predictedOpposites: number[];
  actualNumber: number;
  actualSize: "BIG" | "SMALL";
  status: "WIN" | "LOSS";
}
