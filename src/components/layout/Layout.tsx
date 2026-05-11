import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppMode } from '../../contexts/ModeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Home, Calendar, PlusCircle, Users, Settings, Moon, Sun } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { useTheme } from '../ThemeProvider';

export default function Layout() {
  const { mode, setMode } = useAppMode();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleModeSwitch = (checked: boolean) => {
    const newMode = checked ? 'group' : 'personal';
    setMode(newMode);
    if (newMode === 'group') {
      navigate('/groups');
    } else {
      navigate('/');
    }
  };

  const navItems = [
    { icon: Home, label: '홈', path: mode === 'personal' ? '/' : '/groups' },
    { icon: Calendar, label: '달력', path: '/calendar' },
    { icon: PlusCircle, label: '추가', path: '/input', highlight: true },
    { icon: Users, label: '모임', path: '/groups' },
    { icon: Settings, label: '설정', path: '/settings' },
  ];

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto overflow-hidden relative" style={{ backgroundColor: 'var(--neo-bg)' }}>
      {/* Top Header */}
      <header className="flex justify-between items-center px-4 py-4 z-10 neo rounded-b-2xl mb-2">
        <h1 className="text-xl font-bold tracking-tight text-primary px-2">하이브리드 가계부</h1>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="neo-button p-2 text-muted-foreground flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <div className="flex items-center space-x-2 neo-inset p-1 rounded-full px-3">
            <Label htmlFor="mode-switch" className="text-xs font-bold text-muted-foreground cursor-pointer">
              {mode === 'personal' ? '개인' : '모임'}
            </Label>
            <Switch 
              id="mode-switch" 
              checked={mode === 'group'} 
              onCheckedChange={handleModeSwitch} 
              className="data-[state=checked]:bg-brand-blue"
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 scroll-smooth">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full px-6 py-4 flex justify-between items-center z-20 pb-safe neo rounded-t-3xl">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          
          if (item.highlight) {
            return (
              <button 
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transform -translate-y-6 transition-all neo-button ${
                  mode === 'group' ? 'bg-brand-blue text-white' : 'bg-brand-mint text-white'
                } hover:opacity-90 active:scale-95`}
              >
                <item.icon size={28} />
              </button>
            )
          }

          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors w-12 h-12 rounded-xl ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              } ${isActive ? 'neo-inset' : ''}`}
            >
              <item.icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
