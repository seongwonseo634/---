import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Wallet, Activity, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, where, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { PersonalTransaction } from '../types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'week'>('month');

  useEffect(() => {
    if (!user) return;

    const startDate = format(timeRange === 'month' ? startOfMonth(new Date()) : startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const endDate = format(timeRange === 'month' ? endOfMonth(new Date()) : endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const q = query(
      collection(db, `users/${user.uid}/transactions`),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PersonalTransaction[];
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/transactions`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, timeRange]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, `users/${user?.uid}/transactions`, id));
      toast.success('내역이 삭제되었습니다.');
    } catch (error) {
      console.error(error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = income - expense;

  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

  const chartData = Object.keys(expensesByCategory).map(key => ({
    name: key,
    value: expensesByCategory[key]
  })).sort((a, b) => b.value - a.value);

  const COLORS = ['#20c997', '#3b82f6', '#ff6b6b', '#f59e0b', '#8b5cf6'];

  return (
    <div className="p-4 space-y-6">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">요약 및 통계</h2>
        <div className="neo-inset p-1 rounded-xl flex items-center">
          <button 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'week' ? 'neo text-primary' : 'text-muted-foreground'}`}
            onClick={() => setTimeRange('week')}
          >
            이번 주
          </button>
          <button 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'month' ? 'neo text-primary' : 'text-muted-foreground'}`}
            onClick={() => setTimeRange('month')}
          >
            이번 달
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 neo bg-primary text-primary-foreground p-6 rounded-2xl">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-sm font-bold opacity-90 text-primary-foreground/80">내 계좌 총 잔액</p>
              <p className="text-4xl font-extrabold tracking-tighter">
                ₩{balance.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-white/20 rounded-2xl shadow-sm">
              <Wallet className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="neo p-4 flex items-center space-x-3 rounded-2xl">
          <div className="p-2 neo-inset text-brand-mint rounded-xl">
            <ArrowDownRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold">수입</p>
            <p className="text-lg font-bold">₩{income.toLocaleString()}</p>
          </div>
        </div>

        <div className="neo p-4 flex items-center space-x-3 rounded-2xl">
          <div className="p-2 neo-inset text-brand-coral rounded-xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold">지출</p>
            <p className="text-lg font-bold">₩{expense.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Donut Chart */}
      <div className="neo rounded-2xl p-4">
        <h3 className="text-base font-bold flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <span>카테고리별 지출 분석</span>
        </h3>
        <div className="neo-inset rounded-xl p-4">
          {chartData.length > 0 ? (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={5}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => `₩${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: 'var(--neo-bg)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm font-bold text-muted-foreground">
              이번 달 지출이 없습니다
            </div>
          )}
          
          <div className="space-y-4 mt-6">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-bold">{item.name}</span>
                </div>
                <div className="text-sm font-bold">₩{item.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Recent Transactions List */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-bold tracking-tight px-1">최근 내역</h3>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground font-bold">불러오는 중...</div>
        ) : transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="neo rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl neo-inset ${tx.type === 'income' ? 'text-brand-mint' : 'text-muted-foreground'}`}>
                    {tx.type === 'income' ? <ArrowDownRight className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-base">{tx.description || tx.category}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">
                      {tx.date} • {tx.category} {tx.paymentMethod ? `• ${tx.paymentMethod}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`text-lg font-bold ${tx.type === 'income' ? 'text-brand-mint' : ''}`}>
                    {tx.type === 'income' ? '+' : '-'}₩{tx.amount.toLocaleString()}
                  </div>
                  <button onClick={() => handleDelete(tx.id)} className="p-2 text-muted-foreground hover:text-brand-coral transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-bold text-muted-foreground text-center py-4 neo-inset rounded-xl p-4">내역이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
