export interface PredictionResult {
  period: string;
  size: "BIG" | "SMALL";
  opposite: number;
  matching: number;
}

export interface BingoDraw {
  issueNumber: string;
  number: string;
  openTime?: string;
}

export interface HistoryItem {
  period: string;
  predictedSize: "BIG" | "SMALL";
  predictedOpposite: number;
  predictedMatching: number;
  actualNumber: number;
  actualSize: "BIG" | "SMALL";
  status: "JACKPOT" | "WIN" | "LOSS";
}
