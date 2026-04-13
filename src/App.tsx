import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { loginWithGoogle, logout } from './lib/firebase';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Badge } from './components/ui/badge';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dumbbell, 
  History, 
  User as UserIcon, 
  LogOut, 
  Play, 
  Timer, 
  MapPin, 
  Flame,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import WorkoutTimer from './components/WorkoutTimer';
import WorkoutHistory from './components/WorkoutHistory';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './lib/firebase';
import { localDb } from './lib/localDb';

function Dashboard() {
  const { user, profile, isGuestAdmin, setGuestAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(isGuestAdmin ? 'admin' : 'train');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
      setGuestAdmin(false);
      toast.success("Sessão encerrada");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // Usage Tracking
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          usageTime: increment(1)
        });
        // Sync to local DB
        localDb.incrementUsage(user.uid);
      } catch (error) {
        console.error("Error updating usage time:", error);
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`profile_photo_${user.uid}`);
      setPhotoUrl(saved || profile?.photoURL || user?.photoURL || null);
    }

    const handlePhotoUpdate = () => {
      if (user) {
        const saved = localStorage.getItem(`profile_photo_${user.uid}`);
        setPhotoUrl(saved || profile?.photoURL || user?.photoURL || null);
      }
    };

    window.addEventListener('profile-photo-updated', handlePhotoUpdate);
    return () => window.removeEventListener('profile-photo-updated', handlePhotoUpdate);
  }, [user, profile]);

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] font-sans selection:bg-[#00FF9C] selection:text-[#020617]">
      {/* Header */}
      <header className="border-b border-white/5 px-4 h-14 flex justify-between items-center bg-[#020617]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#00FF9C] p-1.5 rounded-md">
            <Dumbbell className="w-4 h-4 text-[#020617]" />
          </div>
          <h1 className="font-black tracking-tighter text-sm uppercase leading-none">
            TUFF<span className="text-[#00FF9C]">TRAINER</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-bold text-[#00FF9C] uppercase tracking-widest">Online</span>
          </div>
          <Avatar className="h-8 w-8 border border-white/10 rounded-full">
            <AvatarImage src={photoUrl || ''} className="object-cover" />
            <AvatarFallback className="bg-[#0f172a] text-[#00FF9C] text-[10px] font-bold">{user?.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 hover:bg-white/5">
            <LogOut className="w-4 h-4 text-[#94a3b8]" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex justify-center">
            <TabsList className="bg-white/5 border border-white/5 p-0.5 rounded-lg h-9">
              <TabsTrigger value="train" className="data-[state=active]:bg-[#00FF9C] data-[state=active]:text-[#020617] rounded-md px-4 py-1 font-bold uppercase text-[10px] tracking-widest transition-all">
                Treinar
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[#00D4FF] data-[state=active]:text-[#020617] rounded-md px-4 py-1 font-bold uppercase text-[10px] tracking-widest transition-all">
                Histórico
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-[#020617] rounded-md px-4 py-1 font-bold uppercase text-[10px] tracking-widest transition-all">
                Perfil
              </TabsTrigger>
              {(profile?.role === 'admin' || isGuestAdmin) && (
                <TabsTrigger value="admin" className="data-[state=active]:bg-[#ff4444] data-[state=active]:text-[#020617] rounded-md px-4 py-1 font-bold uppercase text-[10px] tracking-widest transition-all">
                  Admin
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="train" className="mt-0">
                <WorkoutTimer />
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                <WorkoutHistory />
              </TabsContent>
              <TabsContent value="profile" className="mt-0">
                <Profile />
              </TabsContent>
              {(profile?.role === 'admin' || isGuestAdmin) && (
                <TabsContent value="admin" className="mt-0">
                  <AdminPanel />
                </TabsContent>
              )}
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

function Login() {
  const { setGuestAdmin } = useAuth();
  const [clickCount, setClickCount] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalStep, setTerminalStep] = useState<'user' | 'pass'>('user');
  const [tempUser, setTempUser] = useState('');

  const handleLogoClick = () => {
    const next = clickCount + 1;
    setClickCount(next);
    if (next >= 5) {
      setShowTerminal(true);
      setClickCount(0);
    }
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (terminalStep === 'user') {
      if (terminalInput === 'David') {
        setTempUser('David');
        setTerminalStep('pass');
        setTerminalInput('');
      } else if (terminalInput === 'alphavalleyoficial@gmail.com') {
        // Direct access for master email via terminal too
        setGuestAdmin(true);
        toast.success("Acesso Admin Liberado");
      } else {
        setTerminalInput('');
        toast.error("Usuário não reconhecido");
      }
    } else {
      if (tempUser === 'David' && terminalInput === '735981467203') {
        setGuestAdmin(true);
        toast.success("Acesso David Liberado");
      } else {
        setTerminalInput('');
        setTerminalStep('user');
        toast.error("Senha incorreta");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans overflow-hidden relative">
      {/* Decorative Neon Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00FF9C]/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00D4FF]/10 blur-[120px] rounded-full" />
      
      <Card className="w-full max-w-md bg-[#0f172a]/50 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10">
        <CardHeader className="space-y-1 border-b border-white/5">
          <div className="flex justify-center mb-6">
            <button 
              onClick={handleLogoClick}
              className="bg-[#00FF9C] p-4 rounded-2xl shadow-[0_0_30px_rgba(0,255,156,0.4)] transition-transform active:scale-90"
            >
              <Dumbbell className="w-10 h-10 text-[#020617]" />
            </button>
          </div>
          <CardTitle className="text-4xl font-black tracking-tighter text-center uppercase text-[#00FF9C]">TUFFTRAINER</CardTitle>
          <CardDescription className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[#94a3b8]">
            Tactical Fitness System // v2.0 Neon
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-10 pb-10 space-y-8">
          <AnimatePresence mode="wait">
            {!showTerminal ? (
              <motion.div 
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-sm text-center text-[#94a3b8] leading-relaxed px-4">
                  Acesse a plataforma de monitoramento tático e eleve seu desempenho ao nível profissional.
                </p>
                <Button 
                  onClick={() => loginWithGoogle()} 
                  className="w-full h-14 bg-[#00FF9C] text-[#020617] hover:bg-[#00FF9C]/90 rounded-2xl font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,156,0.3)] transition-all active:scale-95"
                >
                  Conectar via Google
                </Button>
              </motion.div>
            ) : (
              <motion.div 
                key="terminal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-black/80 p-6 rounded-2xl border border-[#00FF9C]/30 font-mono text-[10px]"
              >
                <div className="flex justify-between items-center mb-4 border-b border-[#00FF9C]/20 pb-2">
                  <span className="text-[#00FF9C] animate-pulse">TERMINAL_SECURE_V2</span>
                  <button onClick={() => setShowTerminal(false)} className="text-[#ff4444] hover:underline">SAIR</button>
                </div>
                <form onSubmit={handleTerminalSubmit} className="space-y-4">
                  <div>
                    <p className="text-[#00FF9C]/60 mb-1 uppercase tracking-widest">
                      {terminalStep === 'user' ? '> IDENTIFICAÇÃO' : '> CHAVE_ACESSO'}
                    </p>
                    <input 
                      autoFocus
                      type={terminalStep === 'pass' ? 'password' : 'text'}
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      className="w-full bg-transparent border-none text-[#00FF9C] focus:ring-0 p-0 placeholder:text-[#00FF9C]/10"
                      placeholder={terminalStep === 'user' ? "USUÁRIO OU EMAIL" : "••••••••••••"}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="text-[#00FF9C] hover:bg-[#00FF9C]/10 px-2 py-1 rounded border border-[#00FF9C]/20">
                      EXECUTAR
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="pt-6 border-t border-white/5 flex justify-between text-[8px] font-mono uppercase tracking-widest text-[#94a3b8]">
            <span>Status: Operacional</span>
            <span>Criptografia: Militar</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AppContent() {
  const { user, loading, isGuestAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center font-mono uppercase tracking-[0.3em] text-[10px] text-[#00FF9C]">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.98, 1, 0.98] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-2 border-[#00FF9C] border-t-transparent rounded-full animate-spin" />
          Sincronizando Sistemas...
        </motion.div>
      </div>
    );
  }

  return (user || isGuestAdmin) ? <Dashboard /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
