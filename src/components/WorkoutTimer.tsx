import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Play, Square, Timer, MapPin, Flame, Activity, Share2, Download, Dumbbell, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { domToPng } from 'modern-screenshot';
import confetti from 'canvas-confetti';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from './ui/alert-dialog';
import { format } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// ... (OperationType and handleFirestoreError remain same)
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const MET = {
  corrida: 9.8,
  caminhada: 3.8,
  muaythai: 10,
  boxe: 8,
  jiujitsu: 10,
  funcional: 6
};

const calculateCalories = (type: string, durationMin: number, weight: number = 70) => {
  const metValue = MET[type as keyof typeof MET] || 5;
  return (metValue * weight * durationMin) / 60;
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function WorkoutTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [pace, setPace] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [lastWorkout, setLastWorkout] = useState<any>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{time: number, distance: number, speed: number}[]>([]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<GeolocationCoordinates | null>(null);
  const lastDistanceRef = useRef(0);
  const wakeLockRef = useRef<any>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Persistence: Check for active session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('active_workout');
    if (savedSession) {
      const { startTime, workoutType, savedDistance } = JSON.parse(savedSession);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSeconds(elapsed);
      setDistance(savedDistance || 0);
      setType(workoutType);
      setRunning(true);
      startGPS(workoutType, true);
    }
  }, []);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          const next = prev + 1;
          
          // Update history data for chart every 5 seconds
          if (next % 5 === 0) {
            const currentDistMeters = distance;
            const distDiff = currentDistMeters - lastDistanceRef.current;
            const speedKmH = (distDiff * 3.6) / 5; // (m / 5s) * 3.6 = km/h
            
            setHistoryData(h => [...h, { 
              time: next, 
              distance: currentDistMeters / 1000,
              speed: Number(speedKmH.toFixed(2))
            }]);
            
            lastDistanceRef.current = currentDistMeters;
          }

          // Periodically save distance to local storage
          if (next % 10 === 0) {
            const saved = localStorage.getItem('active_workout');
            if (saved) {
              const data = JSON.parse(saved);
              localStorage.setItem('active_workout', JSON.stringify({ ...data, savedDistance: distance }));
            }
          }
          return next;
        });
      }, 1000);
      requestWakeLock();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      releaseWakeLock();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running, distance]);

  useEffect(() => {
    if (distance > 0 && seconds > 0) {
      const km = distance / 1000;
      const min = seconds / 60;
      setPace(min / km);
    } else {
      setPace(0);
    }
  }, [seconds, distance]);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      } catch (err: any) {
        // Silence permission errors as they are common in iframe environments
        if (err.name !== 'NotAllowedError') {
          console.error(`${err.name}, ${err.message}`);
        }
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const startGPS = (workoutType: string, isResume = false) => {
    if (workoutType === 'corrida' || workoutType === 'caminhada') {
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            if (lastPosRef.current) {
              const d = getDistance(
                lastPosRef.current.latitude,
                lastPosRef.current.longitude,
                position.coords.latitude,
                position.coords.longitude
              );
              setDistance(prev => prev + d);
            }
            lastPosRef.current = position.coords;
          },
          (error) => toast.error("Erro GPS: " + error.message),
          { enableHighAccuracy: true }
        );
      }
    }
    if (!isResume) {
      localStorage.setItem('active_workout', JSON.stringify({
        startTime: Date.now(),
        workoutType,
        savedDistance: 0
      }));
    }
  };

  const startWorkout = (workoutType: string) => {
    setPendingType(workoutType);
    setStartDialogOpen(true);
  };

  const confirmStartWorkout = () => {
    if (!pendingType) return;
    const workoutType = pendingType;
    setType(workoutType);
    setSeconds(0);
    setDistance(0);
    lastDistanceRef.current = 0;
    setHistoryData([{ time: 0, distance: 0, speed: 0 }]);
    setRunning(true);
    lastPosRef.current = null;
    startGPS(workoutType);
    setStartDialogOpen(false);
    setPendingType(null);
    toast.success(`Sessão iniciada: ${workoutType}`);
  };

  const stopWorkout = () => {
    setStopDialogOpen(true);
  };

  const confirmStopWorkout = async () => {
    setStopDialogOpen(false);
    setRunning(false);
    localStorage.removeItem('active_workout');
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const durationMin = seconds / 60;
    const calories = calculateCalories(type || 'funcional', durationMin);
    const km = distance / 1000;
    const finalPace = km > 0 ? (durationMin / km) : 0;

    const workoutData = {
      userId: auth.currentUser?.uid,
      type: type || 'funcional',
      duration: seconds,
      calories: Math.round(calories * 100) / 100,
      distance: Math.round(distance * 100) / 100,
      pace: Math.round(finalPace * 100) / 100,
      timestamp: new Date(), // Use local date for immediate display in summary
      id: Date.now().toString()
    };

    setLastWorkout(workoutData);
    setShowSummary(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });

    const path = `users/${auth.currentUser?.uid}/workouts`;
    try {
      await addDoc(collection(db, path), { ...workoutData, timestamp: serverTimestamp() });
      toast.success("Treino salvo com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const exportAsImage = async () => {
    if (summaryRef.current) {
      try {
        const dataUrl = await domToPng(summaryRef.current, {
          backgroundColor: '#0f172a',
          scale: 2
        });
        const link = document.createElement('a');
        link.download = `treino-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Resumo salvo na galeria!");
      } catch (error) {
        console.error("Error exporting image:", error);
        toast.error("Erro ao exportar imagem");
      }
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 pb-20">
      <AlertDialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <AlertDialogContent className="rounded-xl border border-white/10 bg-[#0f172a] text-white shadow-2xl backdrop-blur-xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold uppercase tracking-tight text-[#00FF9C]">Iniciar Treino?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#94a3b8]">
              Confirmar início da sessão de <span className="text-white font-bold">{pendingType}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel variant="outline" size="sm" className="flex-1 rounded-lg border-white/10 bg-white/5 text-white text-[10px] uppercase font-bold">Não</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStartWorkout}
              className="flex-1 rounded-lg bg-[#00FF9C] text-[#020617] text-[10px] uppercase font-bold hover:bg-[#00FF9C]/90"
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent className="rounded-xl border border-white/10 bg-[#0f172a] text-white shadow-2xl backdrop-blur-xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold uppercase tracking-tight text-[#ff4444]">Encerrar?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#94a3b8]">
              Deseja salvar os dados da sessão atual no histórico?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel variant="outline" size="sm" className="flex-1 rounded-lg border-white/10 bg-white/5 text-white text-[10px] uppercase font-bold">Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStopWorkout}
              className="flex-1 rounded-lg bg-[#ff4444] text-white text-[10px] uppercase font-bold hover:bg-[#ff4444]/90"
            >
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {showSummary && lastWorkout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <Card className="w-full max-w-[320px] bg-[#0f172a] border border-white/10 rounded-xl overflow-hidden">
              <div ref={summaryRef} className="p-6 space-y-6 bg-[#0f172a]">
                <div className="border-b border-white/5 pb-4 flex justify-between items-end">
                  <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#00FF9C]">Relatório</h2>
                    <p className="text-xl font-black uppercase text-white">{lastWorkout.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-mono opacity-40 text-white">{format(lastWorkout.timestamp, 'dd/MM/yy')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase text-[#94a3b8]">Tempo</p>
                    <p className="text-lg font-bold text-white tabular-nums">{formatTime(lastWorkout.duration)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase text-[#94a3b8]">Distância</p>
                    <p className="text-lg font-bold text-white tabular-nums">{(lastWorkout.distance / 1000).toFixed(2)}km</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase text-[#94a3b8]">Calorias</p>
                    <p className="text-lg font-bold text-white tabular-nums">{Math.round(lastWorkout.calories)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold uppercase text-[#94a3b8]">Pace</p>
                    <p className="text-lg font-bold text-white tabular-nums">{lastWorkout.pace.toFixed(1)}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-white/5 flex gap-2 bg-white/5">
                <Button 
                  onClick={exportAsImage}
                  className="flex-1 h-10 bg-[#00FF9C] text-[#020617] rounded-lg text-[10px] font-bold uppercase"
                >
                  Exportar
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowSummary(false)}
                  className="flex-1 h-10 rounded-lg border-white/10 text-white text-[10px] font-bold uppercase"
                >
                  Fechar
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!running ? (
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(MET).map((t) => (
            <Button
              key={t}
              variant="outline"
              onClick={() => startWorkout(t)}
              className="h-20 flex flex-col gap-2 bg-white/5 border-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <Activity className="w-5 h-5 text-[#00FF9C]" />
              <span className="font-bold uppercase text-[9px] tracking-widest text-white/70">{t}</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Dashboard Header Slim */}
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00FF9C] rounded-full animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-tight text-white">{type}</h3>
            </div>
            <span className="text-[9px] font-bold text-[#00FF9C] opacity-60 uppercase">GPS Ativo</span>
          </div>

          {/* Slim Metrics Grid 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="slim-card p-4">
              <p className="text-label mb-1">Tempo</p>
              <p className="text-value">{formatTime(seconds)}</p>
            </div>

            <div className="slim-card p-4">
              <p className="text-label mb-1">Distância</p>
              <p className="text-value">
                {(distance / 1000).toFixed(2)}
                <span className="text-[10px] opacity-30 ml-1">km</span>
              </p>
            </div>

            <div className="slim-card p-4">
              <p className="text-label mb-1">Pace</p>
              <p className="text-value">
                {pace > 0 ? pace.toFixed(2) : '--'}
                <span className="text-[10px] opacity-30 ml-1">min</span>
              </p>
            </div>

            <div className="slim-card p-4">
              <p className="text-label mb-1">Calorias</p>
              <p className="text-value">
                {Math.round(calculateCalories(type || 'funcional', seconds / 60))}
                <span className="text-[10px] opacity-30 ml-1">kcal</span>
              </p>
            </div>
          </div>

          {/* Compact Chart Strip */}
          {(type === 'corrida' || type === 'caminhada') && (
            <div className="slim-card p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-[#00FF9C]" />
                  <p className="text-[9px] font-bold uppercase text-white/30 tracking-widest">Performance Tática (km/h)</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00FF9C] rounded-full" />
                    <span className="text-[7px] uppercase font-bold text-white/20">Pico</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-[#ff4444] rounded-full" />
                    <span className="text-[7px] uppercase font-bold text-white/20">Queda</span>
                  </div>
                </div>
              </div>
              <div className="h-[100px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="colorPerformance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF9C" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FF9C" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                      itemStyle={{ color: '#00FF9C' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="speed" 
                      stroke="#00FF9C" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPerformance)" 
                      isAnimationActive={true}
                      dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        if (historyData.length < 3) return null;
                        
                        const speeds = historyData.map(d => d.speed);
                        const maxSpeed = Math.max(...speeds);
                        const minSpeed = Math.min(...speeds.filter(s => s > 0) || [0]);
                        
                        if (payload.speed === maxSpeed && maxSpeed > 0) {
                          return (
                            <circle key={`max-${index}`} cx={cx} cy={cy} r={4} fill="#00FF9C" stroke="#020617" strokeWidth={2} />
                          );
                        }
                        if (payload.speed === minSpeed && minSpeed > 0 && minSpeed < maxSpeed) {
                          return (
                            <circle key={`min-${index}`} cx={cx} cy={cy} r={4} fill="#ff4444" stroke="#020617" strokeWidth={2} />
                          );
                        }
                        return null;
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Fluxo de Distância (Original) */}
          <div className="slim-card p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[9px] font-bold uppercase text-white/30 tracking-widest">Fluxo de Distância (km)</p>
              <div className="w-1.5 h-1.5 bg-[#00D4FF] rounded-full animate-pulse" />
            </div>
            <div className="h-[60px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="#00D4FF" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorDist)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Slim Bottom Button */}
          <div className="fixed bottom-4 left-4 right-4 z-50">
            <Button 
              onClick={stopWorkout}
              className="w-full h-12 rounded-lg bg-[#ff4444] text-white text-xs font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Finalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
