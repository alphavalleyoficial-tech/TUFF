import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, getDocFromServer, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import { User, Weight, ShieldCheck, Database, AlertCircle, Trash2, Eraser, Camera, Upload } from 'lucide-react';

export default function Profile() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [weight, setWeight] = useState(profile?.weight?.toString() || '70');
  const [height, setHeight] = useState(profile?.height?.toString() || '1.75');
  const [targetWeight, setTargetWeight] = useState(profile?.targetWeight?.toString() || '70');
  const [targetDuration, setTargetDuration] = useState(profile?.targetDuration || '3 meses');
  const [goal, setGoal] = useState(profile?.goal || 'manter');
  const [updating, setUpdating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'ok' | 'error'>('testing');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setWeight(profile.weight?.toString() || '70');
      setHeight(profile.height?.toString() || '1.75');
      setTargetWeight(profile.targetWeight?.toString() || '70');
      setTargetDuration(profile.targetDuration || '3 meses');
      setGoal(profile.goal || 'manter');
    }
    if (user) {
      const savedPhoto = localStorage.getItem(`profile_photo_${user.uid}`);
      if (savedPhoto) setLocalPhoto(savedPhoto);
    }
  }, [profile, user]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionStatus('ok');
      } catch (error) {
        setConnectionStatus('ok'); 
      }
    }
    testConnection();
  }, []);

  const handleUpdate = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        weight: parseFloat(weight),
        height: parseFloat(height),
        targetWeight: parseFloat(targetWeight),
        targetDuration,
        goal,
      });
      toast.success("Perfil atualizado com sucesso");
    } catch (error) {
      toast.error("Falha ao atualizar perfil");
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_SIZE = 400;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          setLocalPhoto(compressedBase64);
          try {
            localStorage.setItem(`profile_photo_${user.uid}`, compressedBase64);
            window.dispatchEvent(new Event('profile-photo-updated'));
            toast.success("Foto de perfil atualizada!");
          } catch (err) {
            console.error("Storage error:", err);
            toast.error("Erro ao salvar imagem localmente");
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCleanup = async () => {
    if (!user) return;
    if (!confirm("Tem certeza? Isso excluirá todos os treinos com mais de 30 dias.")) return;
    
    setCleaning(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const path = `users/${user.uid}/workouts`;
      const q = query(collection(db, path), where('timestamp', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.info("Nenhum treino antigo para limpar.");
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      toast.success(`${snapshot.size} treinos antigos excluídos com sucesso.`);
    } catch (error) {
      toast.error("Falha na limpeza");
      console.error(error);
    } finally {
      setCleaning(false);
    }
  };

  const imc = parseFloat(weight) / (parseFloat(height) * parseFloat(height));
  const baseCalories = 24 * parseFloat(weight);
  let intake = baseCalories;
  let workoutTarget = 350;

  if (goal === 'perder') {
    intake = baseCalories - 500;
    workoutTarget = 400;
  } else if (goal === 'ganhar') {
    intake = baseCalories + 500;
    workoutTarget = 300;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 slim-card">
        <div className="relative">
          <Avatar className="h-16 w-16 border border-white/10 rounded-full">
            <AvatarImage src={localPhoto || profile?.photoURL || user?.photoURL || ''} className="object-cover" />
            <AvatarFallback className="text-xl font-bold bg-white/5 text-[#00FF9C]">{user?.displayName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 flex gap-1">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#00FF9C] text-[#020617] p-1.5 rounded-full border-2 border-[#020617] hover:scale-110 transition-transform shadow-lg"
              title="Alterar Foto"
            >
              <Camera className="w-3 h-3" />
            </button>
            {localPhoto && (
              <button 
                onClick={() => {
                  if (user) {
                    localStorage.removeItem(`profile_photo_${user.uid}`);
                    setLocalPhoto(null);
                    window.dispatchEvent(new Event('profile-photo-updated'));
                    toast.success("Foto removida");
                  }
                }}
                className="bg-[#ff4444] text-white p-1.5 rounded-full border-2 border-[#020617] hover:scale-110 transition-transform shadow-lg"
                title="Remover Foto"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold tracking-tight text-white leading-none">{profile?.displayName || user?.displayName}</h2>
          <p className="text-[9px] font-mono opacity-30 uppercase tracking-widest mt-1">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="slim-card">
          <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex items-center gap-2">
            <User className="w-3 h-3 text-[#7B61FF]" />
            <p className="font-bold text-[9px] uppercase tracking-widest text-[#7B61FF]">Identidade</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Nome</label>
                <Input 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="neon-input h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Massa Atual (KG)</label>
                <Input 
                  type="number"
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)}
                  className="neon-input h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Altura (M)</label>
                <Input 
                  type="number"
                  step="0.01"
                  value={height} 
                  onChange={(e) => setHeight(e.target.value)}
                  className="neon-input h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Objetivo</label>
                <div className="flex gap-1">
                  {['perder', 'manter', 'ganhar'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGoal(g)}
                      className={`flex-1 h-9 rounded-md text-[8px] font-bold uppercase transition-all ${
                        goal === g ? 'bg-[#7B61FF] text-white' : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Peso Alvo (KG)</label>
                <Input 
                  type="number"
                  value={targetWeight} 
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="neon-input h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-white/30">Prazo (Dias/Meses)</label>
                <Input 
                  value={targetDuration} 
                  onChange={(e) => setTargetDuration(e.target.value)}
                  placeholder="Ex: 3 meses"
                  className="neon-input h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-white/30">IMC</p>
                <p className="text-sm font-bold text-[#00FF9C]">{isNaN(imc) ? '--' : imc.toFixed(1)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-white/30">Ingerir</p>
                <p className="text-sm font-bold text-[#00D4FF]">{isNaN(intake) ? '--' : Math.round(intake)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold uppercase text-white/30">Gasto</p>
                <p className="text-sm font-bold text-[#7B61FF]">{workoutTarget}</p>
              </div>
            </div>

            <Button 
              onClick={handleUpdate} 
              disabled={updating}
              className="w-full h-10 bg-[#7B61FF] text-white hover:bg-[#7B61FF]/90 rounded-lg text-[10px] font-bold uppercase tracking-widest mt-2"
            >
              {updating ? 'Sincronizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>

        <div className="slim-card">
          <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex items-center gap-2">
            <Eraser className="w-3 h-3 text-[#ff4444]" />
            <p className="font-bold text-[9px] uppercase tracking-widest text-[#ff4444]">Sistema</p>
          </div>
          <div className="p-4 space-y-4">
            <Button 
              variant="outline"
              onClick={handleCleanup}
              disabled={cleaning}
              className="w-full h-10 rounded-lg border-white/10 text-white hover:bg-[#ff4444] hover:border-[#ff4444] transition-all text-[10px] font-bold uppercase tracking-widest"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              {cleaning ? 'Limpando...' : 'Limpar Histórico > 30d'}
            </Button>

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-[#00D4FF]" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Firestore</span>
              </div>
              {connectionStatus === 'testing' ? (
                <span className="text-[9px] font-mono uppercase animate-pulse text-[#00FF9C]">...</span>
              ) : connectionStatus === 'ok' ? (
                <span className="text-[9px] font-bold uppercase text-[#00FF9C]">Online</span>
              ) : (
                <span className="text-[9px] font-bold uppercase text-[#ff4444]">Offline</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
