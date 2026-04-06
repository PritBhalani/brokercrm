import React, { useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Briefcase,
  Bell,
  Menu,
  X,
  CalendarDays,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
      active ? "bg-blue-600 text-white font-bold shadow-sm" : "text-app-text hover:bg-app-surface-hover hover:text-app-text-active"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  if (!user) return <>{children}</>;

  const isAdmin = user.role === 'admin';
  const handleNotificationClick = async (notif: any) => {
    await markAsRead(notif._id);
    setIsNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  return (
    <div className="h-screen bg-app-root flex overflow-hidden font-mono text-app-text">
      {/* Sidebar */}
      <aside className={cn(
        "bg-app-surface border-r border-app-border transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-black tracking-widest text-blue-500 uppercase">BrokerCRM</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-app-surface-hover text-app-text-muted hover:text-white rounded transition-colors">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <SidebarItem 
            to="/" 
            icon={LayoutDashboard} 
            label={isSidebarOpen ? (isAdmin ? 'Dashboard' : 'Today') : ''} 
            active={location.pathname === '/'} 
          />
          {!isAdmin && (
            <SidebarItem
              to="/today-trades"
              icon={TrendingUp}
              label={isSidebarOpen ? 'Trade today' : ''}
              active={location.pathname === '/today-trades'}
            />
          )}
          <SidebarItem 
            to="/leads" 
            icon={Briefcase} 
            label={isSidebarOpen ? (isAdmin ? 'Leads' : 'Call queue') : ''} 
            active={location.pathname.startsWith('/leads')} 
          />
          {isAdmin && (
            <>
              <SidebarItem 
                to="/command-center" 
                icon={Activity} 
                label={isSidebarOpen ? "Command Center" : ""} 
                active={location.pathname === '/command-center'} 
              />
              <div className="space-y-0.5 pt-1">
                {isSidebarOpen && (
                  <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-app-text-muted">
                    Payments
                  </p>
                )}
                <SidebarItem
                  to="/payments/pending"
                  icon={Clock}
                  label={isSidebarOpen ? 'Pending' : ''}
                  active={location.pathname === '/payments/pending'}
                />
                <SidebarItem
                  to="/payments/received"
                  icon={CheckCircle2}
                  label={isSidebarOpen ? 'Received' : ''}
                  active={location.pathname === '/payments/received'}
                />
              </div>
              <SidebarItem 
                to="/agents" 
                icon={Users} 
                label={isSidebarOpen ? "Agents" : ""} 
                active={location.pathname === '/agents'} 
              />
              <SidebarItem 
                to="/attendance" 
                icon={CalendarDays} 
                label={isSidebarOpen ? "Attendance" : ""} 
                active={location.pathname === '/attendance'} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-app-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-app-text hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors font-bold"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-app-root">
        {/* Top Navbar */}
        <header className="bg-app-surface border-b border-app-border h-16 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-app-text-active">
              {location.pathname === '/'
                ? isAdmin
                  ? 'Dashboard'
                  : "Today's work"
                : location.pathname === '/today-trades'
                  ? "Today's trades"
                  : location.pathname === '/command-center'
                    ? 'Command Center'
                    : location.pathname === '/payments/pending'
                      ? 'Pending payments'
                      : location.pathname === '/payments/received'
                        ? 'Received payments'
                        : location.pathname.startsWith('/leads')
                          ? isAdmin
                            ? 'Lead management'
                            : 'Call queue'
                          : location.pathname === '/agents'
                            ? 'Agent management'
                            : location.pathname === '/attendance'
                              ? 'Agent attendance'
                              : ''}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text-active rounded-full relative transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-app-surface flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-app-surface rounded-2xl shadow-md shadow-black/25 border border-app-border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-app-border flex items-center justify-between bg-app-root">
                    <h3 className="font-bold text-app-text-active text-sm uppercase tracking-wider">Notifications</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-app-text-muted">
                        <Bell size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const tier =
                          notif.type === 'error'
                            ? 'text-rose-400 border-rose-500/40 bg-rose-950/20'
                            : notif.type === 'warning'
                              ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
                              : notif.type === 'success'
                                ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20'
                                : 'text-blue-400 border-blue-500/40 bg-blue-950/20';
                        const leadLink = notif.link?.includes('/leads/');
                        return (
                          <div
                            key={notif._id}
                            className={cn(
                              'p-4 border-b border-app-border hover:bg-app-surface-hover transition-colors cursor-pointer',
                              !notif.read && 'bg-blue-900/20'
                            )}
                            onClick={() => void handleNotificationClick(notif)}
                          >
                            <div className="flex gap-3">
                              <div
                                className={cn(
                                  'w-2 h-2 mt-1.5 rounded-full shrink-0',
                                  notif.read ? 'bg-transparent' : 'bg-blue-500'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span
                                    className={cn(
                                      'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border',
                                      tier
                                    )}
                                  >
                                    {notif.type}
                                  </span>
                                  {leadLink ? (
                                    <span className="text-[9px] font-bold uppercase text-blue-400/90">Open lead</span>
                                  ) : null}
                                </div>
                                <p className="text-sm font-bold text-app-text-active">{notif.title}</p>
                                <p className="text-xs text-app-text mt-0.5 line-clamp-3">{notif.message}</p>
                                <p className="text-[10px] text-app-text-muted mt-2 font-mono">
                                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-3 bg-app-root text-center border-t border-app-border">
                    <button className="text-[10px] uppercase font-bold text-app-text hover:text-white tracking-widest">View all activity</button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-app-border">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-app-text-active">{user.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-app-text-muted font-bold">{user.role}</p>
              </div>
              <div className="w-10 h-10 bg-blue-900/30 text-blue-400 border border-blue-500/20 rounded-full flex items-center justify-center font-black">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content: split-pane /leads list needs overflow-hidden; /leads/:id must scroll */}
        <main
          className={cn(
            'flex-1 min-h-0 relative',
            location.pathname === '/leads'
              ? 'overflow-hidden'
              : 'overflow-y-auto p-8'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
