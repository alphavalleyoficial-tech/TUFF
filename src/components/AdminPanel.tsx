import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { localDb } from '../lib/localDb';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Users, Shield, ShieldOff, Clock, User as UserIcon, Search, Link as LinkIcon, Copy, Share2, LogOut } from 'lucide-react';
import { Input } from './ui/input';

export default function AdminPanel() {
  const { setGuestAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!auth.currentUser) {
      // Load from local storage for Guest Admin
      const localUsers = localDb.getUsers();
      setUsers(localUsers);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', userId), {
          ativo: !currentStatus
        });
      }
      
      // Always update local DB for consistency in this session/device
      localDb.updateUserStatus(userId, !currentStatus);
      
      // Refresh local state if not using onSnapshot (Guest Admin mode)
      if (!auth.currentUser) {
        setUsers(localDb.getUsers());
      }
      
      toast.success(currentStatus ? "Usuário bloqueado" : "Usuário desbloqueado");
    } catch (error) {
      toast.error("Erro ao alterar status do usuário");
      console.error(error);
    }
  };

  const formatUsageTime = (minutes: number = 0) => {
    const d = Math.floor(minutes / (60 * 24));
    const h = Math.floor((minutes % (60 * 24)) / 60);
    const m = minutes % 60;
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    
    return parts.join(' ');
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateInvite = async () => {
    const inviteUrl = window.location.origin;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copiado!");
    } catch (err) {
      toast.error("Erro ao copiar link");
    }
  };

  const handleShare = async () => {
    const inviteUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TUFFTRAINER',
          text: 'Venha treinar comigo no TUFFTRAINER!',
          url: inviteUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Erro ao compartilhar:", err);
        }
      }
    } else {
      handleGenerateInvite();
    }
  };

  if (loading) return <div className="text-center font-mono text-xs animate-pulse py-12 uppercase tracking-widest">Carregando Painel Admin...</div>;

  return (
    <div className="space-y-4">
      {/* Header with Exit Button */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#ff4444]" />
          <h2 className="text-sm font-black uppercase tracking-tighter text-white">Painel de Controle</h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            setGuestAdmin(false);
            auth.signOut();
            toast.success("Sessão encerrada");
          }}
          className="h-8 text-[10px] font-bold uppercase tracking-widest text-[#ff4444] hover:bg-[#ff4444]/10"
        >
          <LogOut className="w-3 h-3 mr-2" />
          Sair
        </Button>
      </div>

      {/* Invite Section */}
      <div className="slim-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-3 h-3 text-[#00FF9C]" />
          <h3 className="font-bold text-[9px] uppercase tracking-widest text-white/50">Convite de Usuários</h3>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateInvite}
            className="flex-1 h-10 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest"
          >
            <Copy className="w-3 h-3 mr-2" />
            Gerar Link de Convite
          </Button>
          <Button 
            onClick={handleShare}
            className="h-10 w-10 bg-[#00FF9C] text-[#020617] hover:bg-[#00FF9C]/90 rounded-xl flex items-center justify-center p-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="slim-card p-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-[#94a3b8]" />
        <Input 
          placeholder="Buscar usuários..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none text-xs h-6 focus-visible:ring-0 p-0 placeholder:text-white/20"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-[9px] uppercase tracking-widest text-[#94a3b8]">Gestão de Usuários</h3>
          <Badge variant="outline" className="text-[8px] border-white/10 text-[#00FF9C]">{users.length} Total</Badge>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="space-y-2 pr-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="slim-card p-3 flex items-center justify-between hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-[#7B61FF]/20 text-[#7B61FF]' : 'bg-white/5 text-[#94a3b8]'}`}>
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-xs text-white">{u.displayName}</span>
                      {u.role === 'admin' && (
                        <Badge className="bg-[#7B61FF] text-white text-[7px] h-3 px-1 uppercase">Admin</Badge>
                      )}
                      {!u.ativo && (
                        <Badge className="bg-[#ff4444] text-white text-[7px] h-3 px-1 uppercase">Bloqueado</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-bold text-[#94a3b8] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {formatUsageTime(u.usageTime)}
                      </span>
                      <span className="text-[9px] font-mono opacity-30">{u.email}</span>
                    </div>
                  </div>
                </div>

                {u.id !== auth.currentUser?.uid && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleUserStatus(u.id, u.ativo !== false)}
                    className={`h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                      u.ativo !== false 
                        ? 'text-[#ff4444] hover:bg-[#ff4444]/10' 
                        : 'text-[#00FF9C] hover:bg-[#00FF9C]/10'
                    }`}
                  >
                    {u.ativo !== false ? (
                      <><ShieldOff className="w-3 h-3 mr-1" /> Bloquear</>
                    ) : (
                      <><Shield className="w-3 h-3 mr-1" /> Ativar</>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
