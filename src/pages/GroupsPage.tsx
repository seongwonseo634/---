import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppMode } from '../contexts/ModeContext';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Plus, ArrowRight, ShieldAlert, CheckCircle2, Circle, Copy } from 'lucide-react';
import { Group, GroupDue, GroupTransaction } from '../types';
import { toast } from 'sonner';
import { format } from 'date-fns';

function GroupsList() {
  const { user } = useAuth();
  const { setActiveGroupId } = useAppMode();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Using memberIds array to query groups where user is a member
    const q = query(
      collection(db, 'groups'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Group[] = [];
      snapshot.forEach(d => {
        data.push({ id: d.id, ...d.data() } as Group);
      });
      setGroups(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateGroup = async () => {
    if (!user || !newGroupName) return;
    setIsCreating(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      const groupData: Omit<Group, 'id'> = {
        name: newGroupName,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      
      await setDoc(groupRef, groupData);
      toast.success('새 모임이 생성되었습니다.');
      setOpen(false);
      setNewGroupName('');
      
      // Auto navigate and set mode
      setActiveGroupId(groupRef.id);
      navigate(`/groups/${groupRef.id}`);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'groups');
    } finally {
      setIsCreating(false);
    }
  };

  const joinExistingGroup = async (groupId: string) => {
    // A simple join function (in real app, use invite codes or links)
    if (!user) return;
    try {
      const gRef = doc(db, 'groups', groupId);
      const snap = await getDoc(gRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.memberIds.includes(user.uid)) {
          await updateDoc(gRef, { memberIds: [...data.memberIds, user.uid] });
          toast.success('모임에 참가했습니다.');
        } else {
          toast.info('이미 소속된 모임입니다.');
        }
        setActiveGroupId(groupId);
        navigate(`/groups/${groupId}`);
      } else {
        toast.error('존재하지 않는 모임입니다.');
      }
    } catch(e) {
      handleFirestoreError(e, OperationType.UPDATE, 'groups');
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto h-full animate-in fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">내 모임</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> 새 모임</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 모임 만들기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">모임 이름</Label>
                <Input id="name" placeholder="예: 2024 동기여행 계좌" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              </div>
              <Button className="w-full" disabled={isCreating} onClick={handleCreateGroup}>
                {isCreating ? '생성 중...' : '모임 생성'}
              </Button>
              <div className="text-center text-xs text-muted-foreground my-2">또는</div>
              <Button variant="outline" className="w-full" onClick={() => {
                const id = window.prompt("참여할 모임 ID를 입력하세요.");
                if (id) joinExistingGroup(id);
              }}>
                초대 코드 입력하기
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 text-muted-foreground font-bold">불러오는 중...</div>
      ) : groups.length === 0 ? (
        <div className="neo-inset rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-70" />
          <h3 className="font-bold text-lg">참여 중인 모임이 없습니다</h3>
          <p className="text-sm font-bold text-muted-foreground mt-2 max-w-[250px] mx-auto opacity-80">
            모임을 만들어 친구, 동료와 회비를 공동으로 관리해 보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div 
              key={g.id} 
              className="neo p-4 flex flex-col cursor-pointer rounded-2xl hover:opacity-80 transition-opacity"
              onClick={() => {
                setActiveGroupId(g.id);
                navigate(`/groups/${g.id}`);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <span className="font-bold text-xl">{g.name}</span>
                  <span className="text-xs font-bold text-muted-foreground flex items-center">
                    <Users className="w-4 h-4 mr-1.5 opacity-80" />
                    멤버 {g.memberIds?.length || 1}명
                  </span>
                </div>
                <div className="p-3 neo-inset rounded-xl text-primary">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [transactions, setTransactions] = useState<GroupTransaction[]>([]);
  const [dues, setDues] = useState<GroupDue[]>([]);
  
  useEffect(() => {
    if (!groupId) return;
    
    // Fetch group info
    const unsubsGroup = onSnapshot(doc(db, 'groups', groupId), (d) => {
      if(d.exists()) setGroup({ id: d.id, ...d.data() } as Group);
    });

    // Fetch transactions
    const qTx = query(collection(db, `groups/${groupId}/transactions`), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    const unsubsTx = onSnapshot(qTx, (snap) => {
      const txs: GroupTransaction[] = [];
      snap.forEach(d => txs.push({ id: d.id, ...d.data() } as GroupTransaction));
      setTransactions(txs);
    });

    // Fetch dues
    const qDues = query(collection(db, `groups/${groupId}/dues`), orderBy('createdAt', 'desc'));
    const unsubsDues = onSnapshot(qDues, (snap) => {
      const ds: GroupDue[] = [];
      snap.forEach(d => ds.push({ id: d.id, ...d.data() } as GroupDue));
      setDues(ds);
    });

    return () => {
      unsubsGroup();
      unsubsTx();
      unsubsDues();
    };
  }, [groupId]);

  if (!group) return <div className="p-8 text-center text-muted-foreground animate-pulse">모임 정보 불러오는 중...</div>;
  
  const isAdmin = user?.uid === group.ownerId;
  const balance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);

  const calculateDutchPay = (txs: GroupTransaction[]) => {
    if (!group.memberIds.length) return "멤버가 없습니다.";
    
    const count = group.memberIds.length;
    const totalExp = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const perPerson = Math.ceil(totalExp / count);
    
    return `[${group.name} 정산 알림]\n총 지출: ${totalExp.toLocaleString()}원\n멤버: ${count}명\n👉 1인당 입금액: ${perPerson.toLocaleString()}원\n\n카카오뱅크 3333-00-000000 홍길동\n빠른 입금 부탁드립니다!`;
  };

  return (
    <div className="p-4 max-w-3xl mx-auto h-full space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between mt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
          <div className="text-sm text-muted-foreground mt-1 flex items-center">
            <Users className="w-3 h-3 mr-1" />
            {group.memberIds.length}명 참여중 • ID: {group.id.substring(0, 6)}
          </div>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="dashboard">내역</TabsTrigger>
          <TabsTrigger value="dues">회비 납부</TabsTrigger>
          <TabsTrigger value="dutch">정산 (더치페이)</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: 내역 (Ledger) */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardContent className="p-6">
              <p className="text-sm font-medium opacity-90">모임 총 잔액</p>
              <p className="text-4xl font-bold mt-2">₩{balance.toLocaleString()}</p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between px-1 mt-6">
            <h3 className="font-semibold text-lg">거래 내역</h3>
          </div>
          
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 bg-card rounded-xl border text-muted-foreground text-sm">
                지출 내역이 없습니다.
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                      {tx.type === 'income' ? '💰' : '💳'}
                    </div>
                    <div>
                      <p className="font-semibold">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.date} • {tx.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.type === 'income' ? 'text-brand-teal' : 'text-brand-coral'}`}>
                      {tx.type === 'income' ? '+' : '-'}₩{tx.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: 회비 납부 현황 (Dues) */}
        <TabsContent value="dues" className="space-y-4">
           {isAdmin && (
             <Button variant="outline" className="w-full border-dashed" onClick={async () => {
               const title = window.prompt("회비 항목의 이름을 입력하세요 📝\n(예: 5월 정기 회비)");
               const amountStr = window.prompt("1인당 청구할 금액을 입력하세요 💰\n(예: 30000)");
               if(!title || !amountStr) return;
               const amount = parseInt(amountStr);
               if(isNaN(amount)) return toast.error("올바른 금액을 입력하세요");
               
               try {
                 await addDoc(collection(db, `groups/${groupId}/dues`), {
                   title,
                   amount,
                   dueDate: format(new Date(), 'yyyy-MM-dd'),
                   createdBy: user?.uid,
                   createdAt: serverTimestamp()
                 });
                 toast.success("회비 항목이 추가되었습니다.");
               } catch(e) {
                 handleFirestoreError(e, OperationType.CREATE, 'dues');
               }
             }}>
               <Plus className="w-4 h-4 mr-2" />
               새로운 회비 청구하기
             </Button>
           )}

           {dues.length === 0 ? (
             <div className="text-center py-10 bg-card rounded-xl border text-muted-foreground text-sm">
                청구된 회비 항목이 없습니다.
             </div>
           ) : (
             <div className="space-y-4">
               {dues.map(due => (
                 <Card key={due.id}>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-base flex justify-between">
                       <span>{due.title}</span>
                       <span className="text-primary">₩{due.amount.toLocaleString()}</span>
                     </CardTitle>
                     <CardDescription>총무 관리용 체크리스트</CardDescription>
                   </CardHeader>
                   <CardContent>
                     {/* For a real app we'd fetch subcollection 'payments' but we simulate user checkboxes here for demo */}
                     <div className="space-y-2">
                       {group.memberIds.map(uid => (
                         <div key={uid} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                           <span className="text-sm font-medium">{uid === user?.uid ? "나 (ME)" : `User ${uid.substring(0,4)}`}</span>
                           <Button variant="ghost" size="sm" className="h-8" onClick={() => isAdmin ? toast.success('납부 상태 변경 기능 (구현 예정)') : toast.info('총무만 상태를 변경할 수 있습니다.')}>
                             <div className="flex items-center text-xs">
                               <Circle className="w-4 h-4 text-muted-foreground mr-1" /> 미납
                             </div>
                           </Button>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           )}
        </TabsContent>

        {/* TAB 3: 정산 (Dutch Pay) */}
        <TabsContent value="dutch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>자동 더치페이 계산결과</CardTitle>
              <CardDescription>멤버 수에 맞게 총 지출을 1/N 배분합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-xl whitespace-pre-line text-sm font-mono leading-relaxed mb-4">
                {calculateDutchPay(transactions)}
              </div>
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(calculateDutchPay(transactions));
                  toast.success("클립보드에 복사되었습니다. 카카오톡에 붙여넣으세요!");
                }}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                정산 메시지 복사하기
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Routes>
      <Route index element={<GroupsList />} />
      <Route path=":groupId/*" element={<GroupDetail />} />
    </Routes>
  );
}
