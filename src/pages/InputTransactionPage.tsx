import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppMode } from '../contexts/ModeContext';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, serverTimestamp } from '../lib/firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function InputTransactionPage() {
  const { user } = useAuth();
  const { mode, activeGroupId } = useAppMode();
  const navigate = useNavigate();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('식비');
  const [customCategory, setCustomCategory] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('카드');
  
  const [activeTab, setActiveTab] = useState('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expenseCategories = ['식비', '교통/차량', '쇼핑/뷰티', '문화/여가', '건강/운동', '공과금/요금', '주거/통신', '교육', '경조사', ...customExpenseCategories, '직접 입력'];
  const incomeCategories = ['월급', '부수입', '용돈', '상여금', '이자수익', ...customIncomeCategories, '직접 입력'];
  const paymentMethods = ['현금', '카드', '상품권', '이체', '기타'];

  React.useEffect(() => {
    if (!user) return;
    const fetchCategories = async () => {
      try {
        const catDoc = await getDoc(doc(db, `users/${user.uid}/preferences/categories`));
        if (catDoc.exists()) {
          const data = catDoc.data();
          setCustomExpenseCategories(data.expense || []);
          setCustomIncomeCategories(data.income || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchCategories();
  }, [user]);

  const handleDeleteCategory = async (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    // Optimistic UI update
    if (type === 'expense') {
      setCustomExpenseCategories(prev => prev.filter(c => c !== cat));
      if (category === cat) setCategory('식비');
    } else {
      setCustomIncomeCategories(prev => prev.filter(c => c !== cat));
      if (category === cat) setCategory('월급');
    }

    try {
      const catRef = doc(db, `users/${user.uid}/preferences/categories`);
      await updateDoc(catRef, {
        [type]: arrayRemove(cat)
      });
      toast.success('카테고리가 삭제되었습니다.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    if (!amount || isNaN(Number(amount))) return toast.error('올바른 금액을 입력하세요');
    
    const finalCategory = category === '직접 입력' ? customCategory || '기타' : category;

    setIsProcessing(true);
    try {
      if (category === '직접 입력' && customCategory) {
        const catRef = doc(db, `users/${user.uid}/preferences/categories`);
        await setDoc(catRef, {
          [type]: arrayUnion(customCategory)
        }, { merge: true });
        
        // update local state
        if (type === 'expense') setCustomExpenseCategories(p => [...p, customCategory]);
        else setCustomIncomeCategories(p => [...p, customCategory]);
      }

      const txId = crypto.randomUUID();
      const txData = {
        amount: Number(amount),
        type,
        category: finalCategory,
        date,
        description,
        ...(type === 'expense' && { paymentMethod }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (mode === 'personal') {
        await setDoc(doc(db, `users/${user.uid}/transactions`, txId), txData);
      } else {
        if (!activeGroupId) throw new Error("No active group selected");
        await setDoc(doc(db, `groups/${activeGroupId}/transactions`, txId), {
          ...txData,
          createdBy: user.uid,
        });
      }

      toast.success('내역이 성공적으로 저장되었습니다!');
      navigate(mode === 'personal' ? '/' : '/groups');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    } finally {
      setIsProcessing(false);
    }
  };

  const processReceipt = async (file: File) => {
    setIsProcessing(true);
    toast.info('영수증 분석 중...');
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Extract the total amount, date (YYYY-MM-DD), merchant name (as description), and category (from this list only: 식비, 교통/차량, 쇼핑/뷰티, 문화/여가, 건강/운동, 공과금/요금, 주거/통신, 교육, 경조사, 직접 입력) from this receipt. Return ONLY a valid JSON object with keys: amount (number), date (string), description (string), category (string).'
              },
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response.text) {
        const result = JSON.parse(response.text);
        if (result.amount) setAmount(String(result.amount));
        if (result.description) setDescription(result.description);
        if (result.date) setDate(result.date);
        
        if (expenseCategories.includes(result.category)) {
          setCategory(result.category);
        } else {
          setCategory('직접 입력');
          setCustomCategory(result.category || '기타');
        }
        
        setType('expense');
        setActiveTab('manual'); // Switch to manual tab for review and save
        toast.success('영수증 정보가 자동으로 입력되었습니다. 내용을 확인하고 저장해주세요!');
      }
    } catch (error) {
      console.error(error);
      toast.error('영수증 처리에 실패했습니다');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-3 flex flex-col min-h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <h2 className="text-xl font-bold tracking-tight mb-4 px-1">내역 추가</h2>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 h-10 neo-inset bg-transparent border-none p-1 rounded-xl">
          <TabsTrigger value="manual" className="rounded-lg data-[state=active]:neo data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-bold text-sm">직접 추가/수정</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg data-[state=active]:neo data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-bold text-sm gap-2">
            <Camera className="w-4 h-4"/> 영수증 스캔
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="manual" className="mt-0">
          <form onSubmit={handleSubmit} className="space-y-4 px-1">
            <div className="flex neo-inset p-1 rounded-xl">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'expense' ? 'neo text-brand-coral' : 'text-muted-foreground'}`}
                onClick={() => {
                  setType('expense');
                  setCategory('식비');
                }}
              >
                지출
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'income' ? 'neo text-brand-mint' : 'text-muted-foreground'}`}
                onClick={() => {
                  setType('income');
                  setCategory('월급');
                }}
              >
                수입
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="font-bold text-sm text-muted-foreground">금액</Label>
              <Input 
                id="amount" 
                type="number" 
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0" 
                className="text-xl h-10 font-extrabold tracking-tighter text-center neo-inset border-none bg-transparent" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-bold text-sm text-muted-foreground">날짜</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={date}
                  className="neo-inset h-10 border-none bg-transparent font-medium"
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-sm text-muted-foreground">카테고리</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="neo-inset h-10 border-none bg-transparent font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="neo border-none max-h-60">
                    {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => {
                      const isCustom = (type === 'expense' ? customExpenseCategories : customIncomeCategories).includes(cat);
                      return (
                        <SelectItem key={cat} value={cat} className="font-medium flex justify-between items-center group">
                          <span>{cat}</span>
                          {isCustom && (
                            <div 
                              className="ml-2 text-muted-foreground hover:text-brand-coral z-10 p-1 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 text-xs w-6 h-6"
                              onClick={(e) => handleDeleteCategory(cat, e)}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              ✕
                            </div>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {category === '직접 입력' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="customCat" className="font-bold text-sm text-muted-foreground">나만의 카테고리 이름 입력</Label>
                <Input 
                  id="customCat" 
                  placeholder="카테고리명 입력" 
                  className="neo-inset h-10 border-none bg-transparent font-medium"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="desc" className="font-bold text-sm text-muted-foreground">내용 / 사용처</Label>
              <Input 
                id="desc" 
                placeholder="예: 편의점, 택시, 월급..." 
                className="neo-inset h-10 border-none bg-transparent font-medium"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {type === 'expense' && (
              <div className="flex items-center space-x-4 mt-2">
                <Label className="font-bold text-sm text-muted-foreground whitespace-nowrap">결제 수단</Label>
                <div className="flex-1">
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="neo-inset h-10 border-none bg-transparent font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="neo border-none">
                      {paymentMethods.map(method => (
                        <SelectItem key={method} value={method} className="font-medium cursor-pointer">
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button type="submit" disabled={isProcessing} className="w-full h-10 mt-2 text-base font-bold neo-button bg-primary text-white border-none rounded-xl">
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : '저장하기'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 space-y-4 px-1">
          <div className="neo p-4 md:p-6 rounded-2xl">
            <div className="flex flex-col items-center justify-center space-y-4 text-center py-4">
              <div className="w-16 h-16 neo-inset rounded-full flex items-center justify-center text-primary mb-2">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg">자동 영수증 입력</h3>
                <p className="text-sm font-medium text-muted-foreground w-4/5 mx-auto leading-relaxed">
                  영수증 사진을 찍어주시면 AI가 세부 내역을 파악하여 대신 입력해 드립니다.
                </p>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) processReceipt(e.target.files[0]);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="mt-4 w-full h-12 font-bold text-sm flex items-center justify-center neo-button bg-primary text-white hover:bg-primary/90">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
                휴대폰 카메라 또는 앨범 열기
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
