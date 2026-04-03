import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationContext.tsx';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Plus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import api from '../services/api.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Agents: React.FC = () => {
  const { addNotification } = useNotifications();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users/agents', {
        name: newAgent.name,
        email: newAgent.email,
        password: newAgent.password
      });

      addNotification({
        title: 'New Agent Added',
        message: `${newAgent.name} has been added as an agent.`,
        type: 'info'
      });

      setShowAdd(false);
      setNewAgent({ name: '', email: '', password: '' });
      fetchAgents();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add agent');
    }
  };

  const handleToggleStatus = async (agent: any) => {
    try {
      if (!window.confirm(`Are you sure you want to ${agent.isActive ? 'deactivate' : 'activate'} ${agent.name}?`)) return;

      await api.patch(`/users/agents/${agent._id}/status`);
      addNotification({
        title: 'Agent Status Updated',
        message: `${agent.name} has been ${agent.isActive ? 'deactivated' : 'activated'}.`,
        type: 'success'
      });
      fetchAgents();
    } catch (error) {
      console.error('Toggle status error:', error);
      addNotification({
        title: 'Update Failed',
        message: 'There was an error updating the agent status.',
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-text-active">Agents</h1>
          <p className="text-app-text-muted text-sm mt-1">Manage your calling team members</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-black/25"
        >
          <UserPlus size={20} />
          Add New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-48 bg-app-surface-hover rounded-2xl animate-pulse"></div>)
        ) : agents.map((agent) => (
          <div key={agent._id} className="bg-app-surface p-6 rounded-2xl border border-app-border shadow-sm shadow-black/5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 bg-blue-900/30 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center text-xl font-bold">
                {agent.name.charAt(0)}
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1",
                agent.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {agent.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {agent.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-app-text-active">{agent.name}</h3>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-app-text-muted">
                <Mail size={14} />
                {agent.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-app-text-muted">
                <Shield size={14} />
                {agent.role.charAt(0).toUpperCase() + agent.role.slice(1)}
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-app-border flex items-center justify-between">
              <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">Edit Profile</button>
              <button 
                onClick={() => handleToggleStatus(agent)}
                className={cn(
                  "text-sm font-semibold hover:opacity-80 transition-opacity",
                  agent.isActive ? "text-red-600" : "text-green-600"
                )}
              >
                {agent.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-app-surface w-full max-w-md rounded-2xl shadow-md shadow-black/20 p-8">
            <h3 className="text-xl font-bold text-app-text-active mb-6">Add New Agent</h3>
            <p className="text-sm text-app-text-muted mb-4">Note: In this demo, agents are added to the list. In a real app, they would sign up with their own credentials.</p>
            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            <form onSubmit={handleAddAgent} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                  className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={newAgent.password}
                  onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                  className="w-full px-4 py-3 bg-app-root border border-app-border rounded-xl focus:ring-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 bg-app-surface-hover text-app-text font-semibold rounded-xl hover:bg-app-surface-hover transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-sm shadow-black/25 transition-all"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
