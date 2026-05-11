import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../lib/firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Power, Settings as SettingsIcon, Bell, CircleHelp, Download, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleExport = async () => {
    if (!user) return;
    try {
      toast.info('데이터를 준비 중입니다...');
      const q = query(collection(db, `users/${user.uid}/transactions`));
      const snap = await getDocs(q);
      const headers = ['id', 'date', 'type', 'category', 'description', 'amount'];
      const rows = snap.docs.map(document => {
        const data = document.data();
        return headers.map(h => {
          let v = h === 'id' ? document.id : data[h];
          return `"${String(v || '').replace(/"/g, '""')}"`;
        }).join(',');
      });
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `가계부_연동데이터_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV 파일이 다운로드 되었습니다. 구글 스프레드시트에서 열어보세요!');
    } catch (e) {
      console.error(e);
      toast.error('내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsSyncing(true);
    toast.info('데이터를 동기화하는 중입니다...');
    
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 1) throw new Error("파일이 비어있습니다");
      
      const parseCSVRow = (str: string) => {
          const result = [];
          let cur = '';
          let inQuote = false;
          for (let i = 0; i < str.length; i++) {
              if (str[i] === '"') inQuote = !inQuote;
              else if (str[i] === ',' && !inQuote) { result.push(cur); cur = ''; }
              else cur += str[i];
          }
          result.push(cur);
          return result.map(v => v.replace(/^"|"$/g, '').trim());
      };

      const headers = parseCSVRow(lines[0]);
      
      const q = query(collection(db, `users/${user.uid}/transactions`));
      const snap = await getDocs(q);
      const existingIds = new Set(snap.docs.map(d => d.id));
      const csvIds = new Set();
      
      const batch = writeBatch(db);
      let count = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        if (row.length < headers.length) continue;
        
        const obj: any = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);
        
        if (!obj.date || !obj.amount) continue;
        let id = obj.id || crypto.randomUUID();
        csvIds.add(id);

        const docRef = doc(db, `users/${user.uid}/transactions`, id);
        batch.set(docRef, {
          amount: Number(obj.amount),
          type: obj.type || 'expense',
          category: obj.category || '기타',
          description: obj.description || '',
          date: obj.date,
          createdAt: new Date() // simplification for sync
        }, { merge: true });
        count++;
      }

      // Handle deletions for IDs that exist in DB but not in CSV
      // Assuming user exported, deleted row in sheet, and imported.
      existingIds.forEach(id => {
        if (!csvIds.has(id)) {
          batch.delete(doc(db, `users/${user.uid}/transactions`, id));
        }
      });

      await batch.commit();
      toast.success(`구글시트 연동 완료! ${count}개의 데이터가 성공적으로 동기화되었습니다.`);
    } catch (err) {
      console.error(err);
      toast.error('동기화 중 오류가 발생했습니다. 올바른 형식의 CSV 파일인지 확인해주세요.');
    } finally {
      setIsSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 space-y-6 pb-12">
      <h2 className="text-2xl font-bold tracking-tight mb-6 px-1">설정</h2>
      
      <div className="neo p-6 rounded-2xl mb-8 mt-4">
        <div className="flex items-center space-x-5">
          <Avatar className="w-20 h-20 neo-inset p-1 ring-4 ring-primary/20">
            <AvatarImage src={user?.photoURL || ''} className="rounded-full" />
            <AvatarFallback className="text-xl font-bold rounded-full bg-transparent">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold">{user?.displayName || 'User'}</h3>
            <p className="text-sm font-bold text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="neo p-5 rounded-2xl space-y-4">
        <h3 className="font-bold flex items-center text-lg text-primary">
          <FileSpreadsheet className="w-5 h-5 mr-2" /> 구글 스프레드시트 연동
        </h3>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          데이터를 CSV 파일로 다운로드하여 구글 스프레드시트나 엑셀에서 바로 편집할 수 있습니다. 수정한 파일을 다시 업로드하면 내역(추가/수정/삭제)이 앱에 자동 반영됩니다.
        </p>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button onClick={handleExport} disabled={isSyncing} className="neo-button h-12 bg-transparent text-foreground border-none font-bold">
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImport}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isSyncing} className="neo-button h-12 bg-brand-mint border-none text-white font-bold">
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            동기화 (업로드)
          </Button>
        </div>
      </div>

      <div className="neo rounded-2xl overflow-hidden py-2 space-y-1 mt-6">
        <div className="p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="p-3 neo-inset text-primary rounded-xl">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 font-bold text-lg">계정 설정</div>
        </div>
        
        <div className="p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="p-3 neo-inset text-primary rounded-xl">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1 font-bold text-lg">알림 설정</div>
        </div>
        
        <div className="p-4 flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="p-3 neo-inset text-primary rounded-xl">
            <CircleHelp className="w-6 h-6" />
          </div>
          <div className="flex-1 font-bold text-lg">도움말 및 고객센터</div>
        </div>
      </div>

      <div className="pt-6">
        <Button variant="ghost" className="w-full h-14 text-lg font-bold neo-button text-brand-coral bg-transparent hover:bg-transparent hover:text-brand-coral hover:opacity-80" onClick={handleLogout}>
          <Power className="w-5 h-5 mr-3" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
