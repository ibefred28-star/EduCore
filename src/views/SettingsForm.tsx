import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label } from '../components/ui';

export default function SettingsForm() {
  const { config, updateConfig, syncConfig, updateSyncConfig } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [url, setUrl] = useState(syncConfig?.url || '');
  const [key, setKey] = useState(syncConfig?.key || '');
  
  const [ca1, setCa1] = useState(config.ca1);
  const [ca2, setCa2] = useState(config.ca2);
  const [exam, setExam] = useState(config.exam);
  const [vl, setVl] = useState(config.violationLimit);

  const saveSyncSettings = () => {
    if (!url.trim() || !key.trim()) return showToast('Enter both Supabase URL and anon key');
    updateSyncConfig({ url: url.trim(), key: key.trim() });
    showToast('Online synchronization enabled');
  };
  
  const disableSync = () => {
    updateSyncConfig(null);
    showToast('Offline-only mode enabled');
  };
  
  const saveSettings = () => {
    if (ca1 + ca2 + exam !== 100) return showToast('CA1 + CA2 + Examination must equal 100');
    updateConfig({
      ...config,
      ca1, ca2, exam,
      violationLimit: Math.max(1, vl)
    });
    showToast('Settings saved');
  };

  return (
    <>
      <Card className="mb-4">
        <h3 className="m-0 text-xl font-bold">Online / Offline Mode</h3>
        <p className="text-slate-500 text-sm">Offline mode uses browser storage. Online mode uses Supabase for shared automatic updates and real-time synchronization after configuration.</p>
        
        <Label>Supabase Project URL</Label>
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
        
        <Label>Supabase Anon Key</Label>
        <Input type="password" value={key} onChange={e => setKey(e.target.value)} />
        
        <div className="flex gap-2 mt-[10px]">
          <Button onClick={saveSyncSettings}>Save Online Settings</Button>
          <Button variant="secondary" onClick={disableSync}>Use Offline Only</Button>
        </div>
        <p className="text-slate-500 text-[12px] mt-2">The Supabase database must contain an <b>educore_state</b> table with id, state (json/jsonb) and updated_at columns, plus appropriate RLS policies.</p>
      </Card>
      
      <Card>
        <h3 className="m-0 text-xl font-bold">Official Assessment Weighting</h3>
        <p className="text-slate-500 text-sm">Only CA 1, CA 2 and Examination affect the official report card.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>CA 1</Label>
            <Input type="number" value={ca1} onChange={e => setCa1(Number(e.target.value))} />
          </div>
          <div>
            <Label>CA 2</Label>
            <Input type="number" value={ca2} onChange={e => setCa2(Number(e.target.value))} />
          </div>
          <div>
            <Label>Examination</Label>
            <Input type="number" value={exam} onChange={e => setExam(Number(e.target.value))} />
          </div>
        </div>
        
        <Label>Anti-cheat violation limit</Label>
        <Input type="number" min="1" value={vl} onChange={e => setVl(Number(e.target.value))} />
        
        <Button className="mt-[12px]" onClick={saveSettings}>Save Settings</Button>
        <p className="mt-2 font-bold">Current total: {ca1 + ca2 + exam}/100</p>
      </Card>
    </>
  );
}
