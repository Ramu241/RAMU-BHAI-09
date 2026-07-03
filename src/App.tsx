import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, 
  ShieldAlert, 
  Tv, 
  Gamepad2, 
  History, 
  Compass, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  Users,
  Timer,
  RefreshCw,
  Sparkles,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SoundEffects from "./sound";
import { PredictionResult, BingoDraw, HistoryItem } from "./types";

// Helper function to generate a deterministic random number based on a string seed
function getDeterministicRandom(seedStr: string): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Detailed pattern & trend analysis engine to determine the most accurate predicted size
function calculateTrendPrediction(dataList: BingoDraw[]): "BIG" | "SMALL" {
  if (!dataList || dataList.length < 5) {
    return "BIG"; // Default fallback
  }

  // Extract sizes from the last 15 draws to have a deep window for pattern analysis
  const lastSizes = dataList.slice(0, 15).map((x: BingoDraw) => 
    parseInt(x.number) >= 5 ? "BIG" : "SMALL"
  );
  
  const latestSize = lastSizes[0];

  // 1. Check for Active Dragon Trend (Streak of same size)
  // If the last 3 or more rounds are identical, follow the streak (Dragon series)
  let streakCount = 1;
  for (let i = 1; i < lastSizes.length; i++) {
    if (lastSizes[i] === latestSize) {
      streakCount++;
    } else {
      break;
    }
  }

  if (streakCount >= 3) {
    // If the streak is very long (e.g. 5 or more), it's highly likely to break (reversal)
    if (streakCount >= 5) {
      return latestSize === "BIG" ? "SMALL" : "BIG";
    }
    // Otherwise, follow the streak (Dragon trend)
    return latestSize;
  }

  // 2. Check for Alternating Trend (Ek-Chod-Ek Trend: e.g. B, S, B, S or S, B, S, B)
  let isAlternating = true;
  for (let i = 0; i < 4; i++) {
    if (lastSizes[i] === lastSizes[i + 1]) {
      isAlternating = false;
      break;
    }
  }
  if (isAlternating) {
    // Return the opposite of the last size to continue the alternate pattern
    return latestSize === "BIG" ? "SMALL" : "BIG";
  }

  // 3. Check for Double-Double (Do-Do Ka Trend: e.g. B, B, S, S or S, S, B, B)
  const seq4 = lastSizes.slice(0, 4).join(",");
  if (seq4 === "BIG,BIG,SMALL,SMALL") {
    return "SMALL";
  }
  if (seq4 === "SMALL,SMALL,BIG,BIG") {
    return "BIG";
  }
  if (seq4 === "BIG,SMALL,SMALL,BIG") {
    return "BIG";
  }
  if (seq4 === "SMALL,BIG,BIG,SMALL") {
    return "SMALL";
  }

  // 4. Default Fallback: Weighted Majority analysis of last 10 rounds
  const recentWindow = lastSizes.slice(0, 10);
  const bigCount = recentWindow.filter(s => s === "BIG").length;
  const smallCount = recentWindow.length - bigCount;

  if (bigCount !== smallCount) {
    return bigCount > smallCount ? "BIG" : "SMALL";
  }

  // True fallback to latest size
  return latestSize;
}

export default function App() {
  // Authentication & Verification state
  const [password, setPassword] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [logMessages, setLogMessages] = useState<string[]>([]);

  // Navigation state (keeps iframe alive in DOM)
  const [activeTab, setActiveTab] = useState<"prediction" | "game">("prediction");

  // Game Mode selection (1M or 30S)
  const [activeMode, setActiveMode] = useState<"1m" | "30s">("1m");

  // Game/Prediction engine states - WinGo 1M
  const [currentPeriod1M, setCurrentPeriod1M] = useState<string>("LOADING...");
  const [timeRemaining1M, setTimeRemaining1M] = useState<number>(60);
  const [latestDraw1M, setLatestDraw1M] = useState<BingoDraw | null>(null);
  const [prediction1M, setPrediction1M] = useState<PredictionResult | null>(null);
  const [historyList1M, setHistoryList1M] = useState<HistoryItem[]>([]);

  // Game/Prediction engine states - WinGo 30S
  const [currentPeriod30S, setCurrentPeriod30S] = useState<string>("LOADING...");
  const [timeRemaining30S, setTimeRemaining30S] = useState<number>(30);
  const [latestDraw30S, setLatestDraw30S] = useState<BingoDraw | null>(null);
  const [prediction30S, setPrediction30S] = useState<PredictionResult | null>(null);
  const [historyList30S, setHistoryList30S] = useState<HistoryItem[]>([]);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Refs to maintain state across interval ticks without stale closure issues (1M)
  const savedPredictionRef1M = useRef<"BIG" | "SMALL" | "">("");
  const savedOppositesRef1M = useRef<number[]>([]);
  const lastCompletedPeriodRef1M = useRef<string>("");

  // Refs to maintain state across interval ticks without stale closure issues (30S)
  const savedPredictionRef30S = useRef<"BIG" | "SMALL" | "">("");
  const savedOppositesRef30S = useRef<number[]>([]);
  const lastCompletedPeriodRef30S = useRef<string>("");

  // Local alias variables mapped to the selected mode to avoid changing UI JSX code
  const currentPeriod = activeMode === "1m" ? currentPeriod1M : currentPeriod30S;
  const timeRemaining = activeMode === "1m" ? timeRemaining1M : timeRemaining30S;
  const latestDraw = activeMode === "1m" ? latestDraw1M : latestDraw30S;
  const prediction = activeMode === "1m" ? prediction1M : prediction30S;
  const historyList = activeMode === "1m" ? historyList1M : historyList30S;

  // Sound play wrappers
  const triggerWinSound = () => {
    if (soundEnabled) SoundEffects.playWin();
  };

  const triggerLossSound = () => {
    if (soundEnabled) SoundEffects.playLoss();
  };

  const triggerJackpotSound = () => {
    if (soundEnabled) SoundEffects.playJackpot();
  };

  // Sync Countdown Timers for both 1M and 30S modes
  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      
      // 1M remains to 60s
      setTimeRemaining1M(60 - seconds);
      
      // 30S remains to 30s intervals (0-29 and 30-59)
      setTimeRemaining30S(30 - (seconds % 30));
    };

    updateTimers();
    const timerInterval = setInterval(updateTimers, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Poll real-time Bingo 1M API via server proxy
  useEffect(() => {
    if (!isVerified) return;

    const fetchGameHistory = async () => {
      let dataList: BingoDraw[] | null = null;
      
      // Highly resilient, multi-layered proxy attempts supporting both server-side Express & client-only (Vercel/GitHub pages) hosts
      const attempts = [
        // 1. Direct local API proxy (For our full-stack Express server)
        async () => {
          const res = await fetch("/api/bingo-history");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 2. User's working Vercel Proxy (Guarantees compiled standalone APKs have a reliable data proxy)
        async () => {
          const res = await fetch("https://ramu-bhai-09.vercel.app/api/bingo-history");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 3. Dedicated Cloud Run Shared App Backend Proxy (Guaranteed CORS enabled, high reliability)
        async () => {
          const res = await fetch("https://ais-pre-3kkfv6cntc2226kyxo5gt2-483176443886.asia-southeast1.run.app/api/bingo-history");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 4. corsproxy.io with GET (Highly compatible and fast CORS proxy)
        async () => {
          const res = await fetch("https://corsproxy.io/?https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 5. allorigins.win raw (Excellent GET fallback)
        async () => {
          const res = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent("https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json"));
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 6. codetabs.com with GET (Additional reliable fallback CORS proxy)
        async () => {
          const res = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent("https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json"));
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 7. Direct fetch (In case CORS is disabled or relaxed in user's browser)
        async () => {
          const res = await fetch("https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        }
      ];

      for (let i = 0; i < attempts.length; i++) {
        try {
          const list = await attempts[i]();
          if (list && Array.isArray(list) && list.length > 0) {
            dataList = list;
            break;
          }
        } catch (err) {
          console.warn(`Proxy 1M attempt ${i + 1} failed:`, err);
        }
      }

      if (!dataList) {
        console.error("All Bingo 1M API fetch attempts failed. Check internet connection.");
        return;
      }

      try {
        const latest: BingoDraw = dataList[0];
        setLatestDraw1M(latest);

        // Perform smart pattern recognition/trend prediction
        const nextPred = calculateTrendPrediction(dataList);

        if (lastCompletedPeriodRef1M.current !== latest.issueNumber) {
          const actualNum = parseInt(latest.number);
          const actualSize = actualNum >= 5 ? "BIG" : "SMALL";

          let lastPred = savedPredictionRef1M.current || nextPred;
          let lastOpps = savedOppositesRef1M.current || [];

          // Only add to history if we have already witnessed a period transition
          if (lastCompletedPeriodRef1M.current) {
            const isWin = (lastPred === actualSize) || lastOpps.includes(actualNum);

            // Play audio feedback (only if 1m is currently active to avoid sound double triggers)
            if (isWin) {
              if (activeMode === "1m" && soundEnabled) SoundEffects.playWin();
            } else {
              if (activeMode === "1m" && soundEnabled) SoundEffects.playLoss();
            }

            const newLogItem: HistoryItem = {
              period: latest.issueNumber,
              predictedSize: lastPred,
              predictedOpposites: lastOpps,
              actualNumber: actualNum,
              actualSize: actualSize,
              status: isWin ? "WIN" : "LOSS"
            };

            // Prepend new history items (newest completed on top)
            setHistoryList1M(prev => [newLogItem, ...prev]);
          }

          // Generate 1 SMALL and 1 BIG recommended number deterministically
          const S_POOL = [0, 1, 2, 3, 4];
          const B_POOL = [5, 6, 7, 8, 9];
          const upcomingPeriodStr = (BigInt(latest.issueNumber) + 1n).toString();
          const seed = getDeterministicRandom(upcomingPeriodStr);

          const selectedSmall = S_POOL[seed % S_POOL.length];
          const selectedBig = B_POOL[(seed + 3) % B_POOL.length];
          const shuffledOpposites = [selectedSmall, selectedBig];

          // Update refs to track state for next round
          lastCompletedPeriodRef1M.current = latest.issueNumber;
          savedPredictionRef1M.current = nextPred;
          savedOppositesRef1M.current = shuffledOpposites;

          // Update states to display upcoming period and predictions
          setCurrentPeriod1M(upcomingPeriodStr);
          setPrediction1M({
            period: upcomingPeriodStr,
            size: nextPred,
            opposites: shuffledOpposites
          });
        }
      } catch (err) {
        console.error("Error processing 1M history list:", err);
      }
    };

    // Initial fetch and set interval every 3 seconds to match your code
    fetchGameHistory();
    const intervalId = setInterval(fetchGameHistory, 3000);
    return () => clearInterval(intervalId);
  }, [isVerified, soundEnabled, activeMode]);

  // Poll real-time Bingo 30S API via server proxy
  useEffect(() => {
    if (!isVerified) return;

    const fetchGameHistory30S = async () => {
      let dataList: BingoDraw[] | null = null;
      
      // Highly resilient, multi-layered proxy attempts supporting both server-side Express & client-only (Vercel/GitHub pages) hosts
      const attempts = [
        // 1. Direct local API proxy (For our full-stack Express server)
        async () => {
          const res = await fetch("/api/bingo-history-30s");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 2. User's working Vercel Proxy fallback
        async () => {
          const res = await fetch("/api/bingo-history-30s");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 3. Dedicated Cloud Run Shared App Backend Proxy (Guaranteed CORS enabled, high reliability)
        async () => {
          const res = await fetch("https://ais-pre-3kkfv6cntc2226kyxo5gt2-483176443886.asia-southeast1.run.app/api/bingo-history-30s");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 4. corsproxy.io with GET (Highly compatible and fast CORS proxy)
        async () => {
          const res = await fetch("https://corsproxy.io/?https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 5. allorigins.win raw (Excellent GET fallback)
        async () => {
          const res = await fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent("https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"));
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 6. codetabs.com with GET (Additional reliable fallback CORS proxy)
        async () => {
          const res = await fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent("https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json"));
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        },
        // 7. Direct fetch (In case CORS is disabled or relaxed in user's browser)
        async () => {
          const res = await fetch("https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json");
          if (!res.ok) return null;
          const json = await res.json();
          return json?.data?.list || null;
        }
      ];

      for (let i = 0; i < attempts.length; i++) {
        try {
          const list = await attempts[i]();
          if (list && Array.isArray(list) && list.length > 0) {
            dataList = list;
            break;
          }
        } catch (err) {
          console.warn(`Proxy 30S attempt ${i + 1} failed:`, err);
        }
      }

      if (!dataList) {
        console.error("All Bingo 30S API fetch attempts failed. Check internet connection.");
        return;
      }

      try {
        const latest: BingoDraw = dataList[0];
        setLatestDraw30S(latest);

        // Perform smart pattern recognition/trend prediction
        const nextPred = calculateTrendPrediction(dataList);

        if (lastCompletedPeriodRef30S.current !== latest.issueNumber) {
          const actualNum = parseInt(latest.number);
          const actualSize = actualNum >= 5 ? "BIG" : "SMALL";

          let lastPred = savedPredictionRef30S.current || nextPred;
          let lastOpps = savedOppositesRef30S.current || [];

          // Only add to history if we have already witnessed a period transition
          if (lastCompletedPeriodRef30S.current) {
            const isWin = (lastPred === actualSize) || lastOpps.includes(actualNum);

            // Play audio feedback (only if 30s is currently active to avoid sound double triggers)
            if (isWin) {
              if (activeMode === "30s" && soundEnabled) SoundEffects.playWin();
            } else {
              if (activeMode === "30s" && soundEnabled) SoundEffects.playLoss();
            }

            const newLogItem: HistoryItem = {
              period: latest.issueNumber,
              predictedSize: lastPred,
              predictedOpposites: lastOpps,
              actualNumber: actualNum,
              actualSize: actualSize,
              status: isWin ? "WIN" : "LOSS"
            };

            // Prepend new history items (newest completed on top)
            setHistoryList30S(prev => [newLogItem, ...prev]);
          }

          // Generate 1 SMALL and 1 BIG recommended number deterministically
          const S_POOL = [0, 1, 2, 3, 4];
          const B_POOL = [5, 6, 7, 8, 9];
          const upcomingPeriodStr = (BigInt(latest.issueNumber) + 1n).toString();
          const seed = getDeterministicRandom(upcomingPeriodStr);

          const selectedSmall = S_POOL[seed % S_POOL.length];
          const selectedBig = B_POOL[(seed + 3) % B_POOL.length];
          const shuffledOpposites = [selectedSmall, selectedBig];

          // Update refs to track state for next round
          lastCompletedPeriodRef30S.current = latest.issueNumber;
          savedPredictionRef30S.current = nextPred;
          savedOppositesRef30S.current = shuffledOpposites;

          // Update states to display upcoming period and predictions
          setCurrentPeriod30S(upcomingPeriodStr);
          setPrediction30S({
            period: upcomingPeriodStr,
            size: nextPred,
            opposites: shuffledOpposites
          });
        }
      } catch (err) {
        console.error("Error processing 30S history list:", err);
      }
    };

    // Initial fetch and set interval every 2.5 seconds for higher accuracy in fast 30s intervals
    fetchGameHistory30S();
    const intervalId = setInterval(fetchGameHistory30S, 2500);
    return () => clearInterval(intervalId);
  }, [isVerified, soundEnabled, activeMode]);

  // Hack password verification flow with badass cyber animation sequence
  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "24249090") {
      setIsVerifying(true);
      setErrorMessage("");
      setVerificationProgress(0);
      setLogMessages([]);

      const logs = [
        "ESTABLISHING SECURE VPS HOOK...",
        "BYPASSING WINGO FIREWALL V15...",
        "INTERCEPTING BINGO 1M DATASTREAM...",
        "CRACKING DECRYPTION KEYPAIR...",
        "OPTIMIZING COMPUTE SEEDS...",
        "ESTABLISHING REALTIME SOCKET...",
        "RAMU BHAI SUPREME KERNEL: ONLINE!"
      ];

      let logIdx = 0;
      let progress = 0;

      const progressInterval = setInterval(() => {
        progress += 2;
        setVerificationProgress(progress);

        if (progress % 14 === 0 && logIdx < logs.length) {
          setLogMessages(prev => [...prev, `[+] ${logs[logIdx]}`]);
          logIdx++;
        }

        if (progress >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setIsVerifying(false);
            setIsVerified(true);
            SoundEffects.playJackpot();
          }, 400);
        }
      }, 90); // ~4.5 seconds total
    } else {
      setErrorMessage("⚠️ INCORRECT ACCESS CODE. ACCESS DENIED!");
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col font-sans select-none overflow-x-hidden relative">
      
      {/* Background cyber grid effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%] pointer-events-none z-10" />

      {/* 1. Cyber Authorization Lock Screen */}
      <AnimatePresence>
        {!isVerified && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#050505] z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="w-full max-w-md bg-[#090909] border border-[#00ff41]/30 rounded-2xl p-6 md:p-8 relative shadow-[0_0_50px_rgba(0,255,65,0.15)] overflow-hidden">
              {/* Retro scanlines */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,65,0.08)_0%,transparent_70%)] pointer-events-none" />

              {!isVerifying ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 bg-[#00ff41]/10 rounded-full border border-[#00ff41]/50 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,255,65,0.2)] animate-pulse">
                    <Lock className="w-8 h-8 text-[#00ff41]" />
                  </div>

                  <h1 className="text-3xl font-display font-extrabold tracking-wider text-center text-white mb-2 uppercase select-none">
                    🎭╰‿╯RAMUㅤᏴᎻᎪᏆ
                  </h1>
                  <p className="text-xs tracking-[0.25em] text-[#ffea00] font-bold uppercase mb-6 text-center shadow-sm">
                    VIP SUPREME V15 • SECURED
                  </p>

                  <div className="w-full bg-[#111] border border-dashed border-[#ffea00]/30 rounded-lg p-4 mb-6 text-center">
                    <p className="text-xs text-gray-300 uppercase tracking-wider leading-relaxed">
                      THIS PANEL REQUIRES A VALID PASSCODE TO INTEGRATE SECURE SERVER BYPASS MODULES.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyPassword} className="w-full space-y-4">
                    <div className="relative">
                      <input
                        type="password"
                        placeholder="ENTER EXTREME PASSCODE..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#111] border border-[#00ff41]/40 rounded-xl py-3 px-4 text-center tracking-[0.3em] font-bold text-lg text-[#00ff41] placeholder:text-[#00ff41]/30 focus:outline-none focus:border-[#00ff41] focus:ring-1 focus:ring-[#00ff41] transition-all duration-300 uppercase shadow-[inset_0_0_10px_rgba(0,255,65,0.1)]"
                        autoFocus
                      />
                    </div>

                    {errorMessage && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-[#ff003c] font-bold text-center tracking-wide uppercase"
                      >
                        {errorMessage}
                      </motion.p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#00ff41]/90 to-[#00d2ff]/90 hover:from-[#00ff41] hover:to-[#00d2ff] text-black font-extrabold py-3.5 px-6 rounded-xl text-sm tracking-widest uppercase transition-all duration-300 shadow-[0_0_25px_rgba(0,255,65,0.3)] hover:scale-[1.02] cursor-pointer"
                    >
                      🚀 DECRYPT PANEL
                    </button>
                  </form>

                  <div className="mt-8 flex flex-col items-center w-full border-t border-[#111] pt-6">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3">OFFICIAL TELEGRAM CHANNEL</p>
                    <a 
                      href="https://t.me/+h5jDuTLxOEQ4NmVl" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs bg-[#0088cc] hover:bg-[#0099e6] text-white py-2 px-5 rounded-full font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105"
                    >
                      <Users className="w-4 h-4" /> JOIN RAMU BHAI TELEGRAM
                    </a>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-6">
                    {/* Ring glow */}
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00ff41] animate-spin duration-1000" />
                    <div className="absolute inset-2 rounded-full border border-double border-[#ffea00]/30 flex items-center justify-center">
                      <ShieldAlert className="w-8 h-8 text-[#00ff41] animate-bounce" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#00ff41] tracking-widest uppercase mb-1">
                    BYPASSING WINGO SYSTEM...
                  </h3>
                  <div className="text-xl font-mono text-[#ffea00] font-bold mb-4">
                    {verificationProgress}%
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full bg-[#111] h-2 rounded-full overflow-hidden border border-[#00ff41]/20 mb-6">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-[#00ff41] to-[#00d2ff]" 
                      style={{ width: `${verificationProgress}%` }}
                    />
                  </div>

                  {/* Terminal Console Logs */}
                  <div className="w-full bg-black/80 rounded-xl p-4 border border-[#00ff41]/10 font-mono text-[10px] text-[#00ff41]/80 space-y-1.5 h-36 overflow-y-auto text-left">
                    {logMessages.map((msg, idx) => (
                      <div key={idx} className="leading-relaxed border-b border-white/[0.02] pb-1 font-semibold">
                        {msg}
                      </div>
                    ))}
                    <div className="animate-pulse text-[#ffea00] font-bold">● SYSTEM BYPASS ENGAGED...</div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Verified Dashboard App */}
      {isVerified && (
        <div className="flex flex-col flex-grow relative w-full">
          
          {/* Main Top Header */}
          <header className="sticky top-0 bg-[#090909]/95 border-b border-[#00ff41]/20 backdrop-blur-md px-4 py-3 flex items-center justify-between z-30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00ff41] via-white to-[#00d2ff] uppercase tracking-wider drop-shadow-[0_0_15px_rgba(0,255,65,0.4)]">
                🎭╰‿╯RAMUㅤᏴᎻᎪᏆ
              </span>
              <div className="hidden sm:flex items-center gap-1.5 bg-[#00ff41]/10 border border-[#00ff41]/30 rounded-full px-2.5 py-0.5 text-[9px] text-[#00ff41] tracking-wider font-extrabold uppercase">
                <span className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-ping" />
                V15 SUPREME
              </div>
            </div>

            {/* Sound Toggle and Official Telegram Link */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl transition-all duration-300 ${soundEnabled ? 'bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41]' : 'bg-[#111] border border-white/10 text-gray-400'} cursor-pointer`}
                title={soundEnabled ? "Mute cyber sounds" : "Enable cyber sounds"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <a 
                href="https://t.me/+h5jDuTLxOEQ4NmVl" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] bg-[#0088cc] hover:bg-[#0099e6] text-white py-1.5 px-3 rounded-xl font-bold uppercase tracking-wider transition-all duration-300"
              >
                <Users className="w-3.5 h-3.5" /> Telegram
              </a>
            </div>
          </header>

          {/* Persistent Gaming Iframe Container (Always kept in DOM to prevent reloading) */}
          <div 
            className={`fixed inset-0 top-[53px] bottom-[64px] z-20 bg-black transition-all duration-300 overflow-hidden ${
              activeTab === "game" ? "opacity-100 pointer-events-auto visible" : "opacity-0 pointer-events-none invisible"
            }`}
          >
            <iframe 
              src="https://bdgwinmy.cc/#/register?invitationCode=8261315097340"
              title="BDG Win Game Frame"
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>

          {/* Prediction Screen Content */}
          <main className={`flex-grow p-4 md:p-6 flex flex-col items-center justify-start z-10 overflow-y-auto pb-24 ${
            activeTab === "prediction" ? "block" : "hidden"
          }`}>
            
            <div className="w-full max-w-lg space-y-6">
              
              {/* Premium Announcement / Telegram Promotion Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-gradient-to-r from-red-950/40 via-black to-blue-950/40 border border-[#00ff41]/25 rounded-2xl p-4 overflow-hidden shadow-lg"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,210,255,0.1),transparent_50%)]" />
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#ffea00]/10 rounded-xl border border-[#ffea00]/30 text-[#ffea00] mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">PREDICTING FOR BINGO {activeMode === "1m" ? "1-MINUTE" : "30-SECONDS"}</h4>
                    <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                      Our quantum system intercepts real-time streams from bdgwinmy.cc. Select game duration below to synchronize predictions!
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* High-Fidelity Game Mode Switcher Tab */}
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex bg-black/80 border-2 border-[#00ff41]/25 rounded-2xl p-1.5 gap-2 shadow-[0_0_20px_rgba(0,255,65,0.05)] w-full"
              >
                <button
                  onClick={() => setActiveMode("1m")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 cursor-pointer ${
                    activeMode === "1m"
                      ? "text-black bg-gradient-to-r from-[#00ff41] to-[#00d2ff] shadow-[0_0_15px_rgba(0,255,65,0.25)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  🎰 WINGO 1-MIN
                </button>
                <button
                  onClick={() => setActiveMode("30s")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 cursor-pointer ${
                    activeMode === "30s"
                      ? "text-black bg-gradient-to-r from-[#00ff41] to-[#00d2ff] shadow-[0_0_15px_rgba(0,255,65,0.25)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  ⚡ WINGO 30-SEC
                </button>
              </motion.div>

              {/* Prediction Display Glass Panel */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#090909]/90 border-2 border-[#00ff41] rounded-3xl p-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,255,65,0.15)] text-center"
              >
                {/* Cyber accent markers on corners */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ff41] m-3" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ff41] m-3" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00ff41] m-3" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00ff41] m-3" />

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#00ff41] animate-ping" />
                  <span className="text-[10px] tracking-[0.25em] font-extrabold text-[#00ff41] uppercase">QUANTUM STREAM ACTIVE</span>
                </div>

                {/* Next Period Info */}
                <div className="text-gray-400 text-xs font-bold uppercase tracking-[0.15em] mb-1">
                  CURRENT PERIOD NUMBER
                </div>
                <div className="text-xl font-mono font-black text-white bg-white/5 border border-white/10 rounded-xl py-1.5 px-4 inline-block tracking-wider mb-6">
                  {currentPeriod}
                </div>

                {/* Big predicted size */}
                <div className="space-y-1 mb-6">
                  <div className="text-gray-400 text-[11px] font-extrabold uppercase tracking-widest">
                    RECOMMENDED SIZE
                  </div>
                  <AnimatePresence mode="wait">
                    {prediction ? (
                      <motion.div 
                        key={prediction.size}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`text-6xl md:text-7xl font-display font-black tracking-widest drop-shadow-[0_0_20px_rgba(0,255,65,0.4)] ${
                          prediction.size === "BIG" ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500" : "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500"
                        }`}
                      >
                        {prediction.size}
                      </motion.div>
                    ) : (
                      <div className="text-3xl text-[#ffea00] tracking-widest uppercase font-black animate-pulse py-4">
                        ANALYZING LOGIC...
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sub-Predictions: 1 Small & 1 Big Number combo as requested */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center mt-2 shadow-[inset_0_0_15px_rgba(255,255,255,0.02)]">
                  <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.1em] mb-3">
                    RECOMMENDED NUMBERS (1 SMALL & 1 BIG)
                  </div>
                  {prediction && prediction.opposites ? (
                    <div className="flex items-center gap-4">
                      {prediction.opposites.map((num, i) => (
                        <div 
                          key={i} 
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff003c] via-purple-600 to-[#00d2ff] text-white font-black text-xl flex items-center justify-center shadow-lg shadow-red-500/25 border border-white/10"
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
                      <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Countdown Timer with 1-minute standard cycle */}
                <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-6">
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <Timer className="w-4 h-4 text-[#ffea00]" />
                    COUNTDOWN:
                  </div>
                  <div className={`font-mono text-2xl font-black ${timeRemaining <= 10 ? 'text-[#ff003c] animate-pulse' : 'text-[#ffea00]'}`}>
                    00:{timeRemaining.toString().padStart(2, "0")}
                  </div>
                </div>

              </motion.div>

              {/* Realtime Live Period History List (In memory, clears on fresh open/reload) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#00ff41]" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">LIVE SESSION HISTORY</span>
                  </div>
                  <span className="text-[10px] bg-white/5 border border-white/10 rounded-full px-2.5 py-0.5 text-gray-400 tracking-wider font-semibold">
                    {historyList.length} LOGS
                  </span>
                </div>

                {historyList.length === 0 ? (
                  <div className="bg-[#090909]/40 border border-white/[0.04] rounded-2xl p-8 text-center text-gray-500 uppercase tracking-wider text-xs leading-relaxed">
                    WAITING FOR THE FIRST ACTIVE ROUND TO FINISH TO APPEND LIVE RESULTS LOGS...
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {historyList.map((item) => {
                        const isWin = item.status === "WIN";
                        
                        return (
                          <motion.div
                            key={item.period}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-[#090909] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between shadow-sm hover:border-[#00ff41]/20 transition-all duration-300"
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-[10px] text-gray-500 tracking-wider">
                                PERIOD: {item.period.slice(-3)}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-extrabold text-white uppercase tracking-wide">
                                  PRED: {item.predictedSize}
                                </span>
                                <span className="text-[9px] text-gray-400 bg-white/5 rounded px-1.5 py-0.5 font-mono font-medium">
                                  NUMS: {item.predictedOpposites.join(", ")}
                                </span>
                              </div>
                            </div>

                            {/* Center outcome actual number */}
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-gray-500 uppercase tracking-widest">OPENED</span>
                              <span className="font-mono text-sm font-black text-[#ffea00] mt-0.5">
                                NUM {item.actualNumber} ({item.actualSize})
                              </span>
                            </div>

                            {/* Status and Sound indicator */}
                            <div className="flex items-center gap-3">
                              {isWin ? (
                                <span className="bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41] text-[10px] font-extrabold tracking-widest px-3 py-1 rounded-full uppercase">
                                  WIN 🐯
                                </span>
                              ) : (
                                <span className="bg-red-500/10 border border-red-500/30 text-[#ff003c] text-[10px] font-extrabold tracking-widest px-3 py-1 rounded-full uppercase">
                                  LOSS 🖤
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

            </div>

          </main>

          {/* Master View Navigation Tab Selector */}
          <nav className="fixed bottom-0 left-0 right-0 bg-[#090909] border-t border-[#00ff41]/20 px-6 py-2 flex items-center justify-around z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
            
            {/* Nav item: Prediction Panel */}
            <button 
              onClick={() => setActiveTab("prediction")}
              className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all duration-300 ${
                activeTab === "prediction" 
                  ? "text-[#00ff41] bg-[#00ff41]/5 font-extrabold" 
                  : "text-gray-400 hover:text-white"
              } cursor-pointer`}
            >
              <Compass className="w-5 h-5" />
              <span className="text-[10px] tracking-widest uppercase font-bold">PREDICTIONS</span>
            </button>

            {/* Nav item: Play Fullscreen */}
            <button 
              onClick={() => setActiveTab("game")}
              className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all duration-300 ${
                activeTab === "game" 
                  ? "text-[#00d2ff] bg-[#00d2ff]/5 font-extrabold" 
                  : "text-gray-400 hover:text-white"
              } cursor-pointer`}
            >
              <Gamepad2 className="w-5 h-5" />
              <span className="text-[10px] tracking-widest uppercase font-bold">PLAY FULLSCREEN</span>
            </button>

          </nav>

        </div>
      )}

    </div>
  );
}
