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

  // Game/Prediction engine states
  const [currentPeriod, setCurrentPeriod] = useState<string>("LOADING...");
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [latestDraw, setLatestDraw] = useState<BingoDraw | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Real-time custom in-memory history (not saved to localStorage as requested)
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  
  // Cache to store predictions for specific period numbers
  const predictionsCache = useRef<{ [key: string]: PredictionResult }>({});
  // Track processed period numbers to avoid duplicate history inserts
  const processedPeriods = useRef<Set<string>>(new Set());
  // Store previous active period to trigger prediction generation on state changes
  const lastActivePeriodRef = useRef<string>("");

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

  // Sync 1-Minute game countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const seconds = now.getSeconds();
      const remaining = 60 - seconds;
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Poll real-time Bingo 1M API via server proxy
  useEffect(() => {
    if (!isVerified) return;

    const fetchGameHistory = async () => {
      try {
        const response = await fetch("/api/bingo-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageSize: 10, pageNo: 1 }),
        });
        
        if (!response.ok) throw new Error("API Proxy responded with error");
        
        const json = await response.json();
        if (json && json.data && json.data.list && json.data.list.length > 0) {
          const latest: BingoDraw = json.data.list[0];
          setLatestDraw(latest);

          // The active period is the latest completed period issueNumber + 1
          const nextActivePeriod = (BigInt(latest.issueNumber) + 1n).toString();
          setCurrentPeriod(nextActivePeriod);

          // Maintain predictions inside cache
          let currentPred = predictionsCache.current[nextActivePeriod];
          if (!currentPred) {
            // Generate stable prediction for the new active period
            // Algorithm uses the last 5 results to keep the win logic robust
            const last5Sizes = json.data.list.slice(0, 5).map((draw: BingoDraw) => 
              parseInt(draw.number) >= 5 ? "BIG" : "SMALL"
            );
            const bigCount = last5Sizes.filter((s: string) => s === "BIG").length;
            const predSize = bigCount >= 3 ? "BIG" : "SMALL";

            // Determine pools based on predicted size
            const bigPool = [5, 6, 7, 8, 9];
            const smallPool = [0, 1, 2, 3, 4];
            
            // Generate 1 matching number and 1 opposite number as requested:
            // "बिग के साथ दो नंबर ऑपोजिट आ रहा तो एक नंबर ऑपोजिट है और एक नंबर उसके साथ ही आए"
            const matchingPool = predSize === "BIG" ? bigPool : smallPool;
            const oppositePool = predSize === "BIG" ? smallPool : bigPool;

            const predMatching = matchingPool[Math.floor(Math.random() * matchingPool.length)];
            const predOpposite = oppositePool[Math.floor(Math.random() * oppositePool.length)];

            currentPred = {
              period: nextActivePeriod,
              size: predSize,
              opposite: predOpposite,
              matching: predMatching
            };
            predictionsCache.current[nextActivePeriod] = currentPred;
          }
          setPrediction(currentPred);

          // Check if previous rounds have finished and need history calculation
          // Loop through the list to check if we missed any period completions
          json.data.list.forEach((draw: BingoDraw) => {
            const finishedPeriod = draw.issueNumber;
            
            if (!processedPeriods.current.has(finishedPeriod)) {
              const cachedPred = predictionsCache.current[finishedPeriod];
              if (cachedPred) {
                const actualNum = parseInt(draw.number);
                const actualSize = actualNum >= 5 ? "BIG" : "SMALL";
                
                let outcomeStatus: "JACKPOT" | "WIN" | "LOSS" = "LOSS";
                if (actualNum === cachedPred.matching || actualNum === cachedPred.opposite) {
                  outcomeStatus = "JACKPOT";
                  triggerJackpotSound();
                } else if (actualSize === cachedPred.size) {
                  outcomeStatus = "WIN";
                  triggerWinSound();
                } else {
                  outcomeStatus = "LOSS";
                  triggerLossSound();
                }

                const newHistoryItem: HistoryItem = {
                  period: finishedPeriod,
                  predictedSize: cachedPred.size,
                  predictedOpposite: cachedPred.opposite,
                  predictedMatching: cachedPred.matching,
                  actualNumber: actualNum,
                  actualSize: actualSize,
                  status: outcomeStatus
                };

                setHistoryList(prev => {
                  // Avoid duplicates
                  if (prev.some(item => item.period === finishedPeriod)) return prev;
                  return [newHistoryItem, ...prev];
                });
                
                processedPeriods.current.add(finishedPeriod);
              }
            }
          });
        }
      } catch (err) {
        console.error("Error polling Bingo API:", err);
      }
    };

    // Initial fetch and set interval every 4 seconds
    fetchGameHistory();
    const intervalId = setInterval(fetchGameHistory, 4000);
    return () => clearInterval(intervalId);
  }, [isVerified, soundEnabled]);

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
              activeTab === "game" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none hidden"
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
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">PREDICTING FOR BINGO 1-MINUTE</h4>
                    <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                      Our system intercepts real-time issue streams from bdgwinmy.cc. Follow predictions below to secure jackpot multi-folds!
                    </p>
                  </div>
                </div>
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

                {/* Sub-Predictions: 1 Matching and 1 Opposite Number as requested */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  
                  {/* Matching Number Block */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col items-center">
                    <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">
                      MATCHING NUMBER
                    </div>
                    {prediction ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00ff41] to-[#00d2ff] text-black font-black text-lg flex items-center justify-center shadow-md shadow-[#00ff41]/20">
                        {prediction.matching}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                    )}
                  </div>

                  {/* Opposite Number Block */}
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col items-center">
                    <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5">
                      OPPOSITE NUMBER
                    </div>
                    {prediction ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ff003c] to-amber-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-red-500/20">
                        {prediction.opposite}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                    )}
                  </div>

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
                  <div className="bg-[#090909]/40 border border-white/[0.04] rounded-2xl p-8 text-center text-gray-500 uppercase tracking-wider text-xs">
                    WAITING FOR ACTIVE ROUND TO FINISH FOR RESULTS...
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {historyList.map((item) => {
                        const isJackpot = item.status === "JACKPOT";
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
                                PRD: {item.period.slice(-4)}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-extrabold text-white uppercase tracking-wide">
                                  PRED: {item.predictedSize}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] text-gray-400 bg-white/5 rounded px-1.5 py-0.5">
                                    M:{item.predictedMatching}
                                  </span>
                                  <span className="text-[9px] text-gray-400 bg-white/5 rounded px-1.5 py-0.5">
                                    O:{item.predictedOpposite}
                                  </span>
                                </div>
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
                              {isJackpot ? (
                                <span className="bg-gradient-to-r from-amber-500 to-[#ffea00] text-black text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase shadow-md shadow-amber-500/10">
                                  🎰 JACKPOT
                                </span>
                              ) : isWin ? (
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
