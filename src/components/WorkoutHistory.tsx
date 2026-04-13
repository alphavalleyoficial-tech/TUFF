import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Activity, 
  Calendar, 
  Flame, 
  Clock, 
  TrendingUp,
  ChevronRight,
  MapPin,
  Trash2
} from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

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

export default function WorkoutHistory() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/workouts`;
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: (doc.data() as any).timestamp?.toDate() || new Date()
      }));
      setWorkouts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    const id = deleteId;
    if (!id || !auth.currentUser) return;
    
    setIsDeleting(true);
    const path = `users/${auth.currentUser.uid}/workouts`;
    try {
      await deleteDoc(doc(db, path, id));
      toast.success('Treino removido');
      setDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
      toast.error('Erro ao remover treino');
    } finally {
      setIsDeleting(false);
    }
  };

  const chartData = workouts.slice().reverse().map(w => ({
    date: format(w.timestamp, 'dd/MM'),
    calories: w.calories
  }));

  if (loading) return <div className="text-center font-mono text-xs animate-pulse py-12 uppercase tracking-widest">Recuperando Registros...</div>;

  return (
    <div className="space-y-4">
      <AlertDialog 
        open={!!deleteId} 
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="rounded-xl border border-white/10 bg-[#0f172a] text-white shadow-2xl backdrop-blur-xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold uppercase tracking-tight text-[#ff4444]">Excluir Treino?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#94a3b8]">
              Esta ação não pode ser desfeita. O registro será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel 
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="flex-1 rounded-lg border-white/10 bg-white/5 text-white text-[10px] uppercase font-bold"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="flex-1 rounded-lg bg-[#ff4444] text-white text-[10px] uppercase font-bold hover:bg-[#ff4444]/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Analytics Chart Slim */}
      {workouts.length > 0 && (
        <div className="slim-card">
          <div className="px-3 py-2 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <p className="font-bold text-[9px] uppercase tracking-widest text-[#00D4FF]">Tendência Calórica</p>
            <TrendingUp className="w-3 h-3 text-[#00D4FF]" />
          </div>
          <div className="p-3">
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.05} vertical={false} />
                  <XAxis hide dataKey="date" />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: 'none', 
                      fontSize: '9px',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: '#00D4FF' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calories" 
                    stroke="#00D4FF" 
                    strokeWidth={2} 
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* History List Slim */}
      <div className="space-y-2">
        <h3 className="font-bold text-[9px] uppercase tracking-widest text-[#94a3b8] px-1">Histórico</h3>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-2">
            {workouts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-[10px] uppercase opacity-30">
                Vazio
              </div>
            ) : (
              workouts.map((workout) => (
                <div key={workout.id} className="slim-card p-3 flex items-center justify-between hover:bg-white/5 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/5 p-2 rounded-lg text-[#00D4FF]">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase text-xs text-white">{workout.type}</span>
                        <span className="text-[9px] font-mono opacity-30">{format(workout.timestamp, 'dd/MM')}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-[#94a3b8] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {Math.floor(workout.duration / 60)}m
                        </span>
                        <span className="text-[9px] font-bold text-[#94a3b8] flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5" /> {Math.round(workout.calories)}
                        </span>
                        {workout.distance > 0 && (
                          <span className="text-[9px] font-bold text-[#94a3b8] flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> {(workout.distance / 1000).toFixed(1)}k
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(workout.id)}
                      className="h-8 w-8 text-[#94a3b8] hover:text-[#ff4444] hover:bg-[#ff4444]/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-4 h-4 opacity-10 group-hover:opacity-100 text-[#00D4FF]" />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
