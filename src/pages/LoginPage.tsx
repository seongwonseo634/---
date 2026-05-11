import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginWithGoogle } from '../lib/firebase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success('로그인되었습니다');
    } catch (error) {
      console.error(error);
      toast.error('로그인에 실패했습니다');
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm shadow-2xl border-none">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">하이브리드 가계부</CardTitle>
            <CardDescription className="text-base">
              개인 및 모임 가계부를 한 곳에서 편리하게 관리하세요
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleLogin} 
            className="w-full h-12 text-base font-medium shadow-sm transition-all hover:scale-[1.02]"
          >
            Google 계정으로 시작하기
          </Button>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            계속 진행하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
