import React from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label } from '../components/ui';

export default function BackupRestore() {
  const { data, branding, config, updateData, updateBranding, updateConfig } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const backup = () => {
    const blob = new Blob([JSON.stringify({ data, branding, config }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'EduCore_Backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const x = JSON.parse(r.result as string);
        if (x.data) updateData(() => x.data);
        if (x.branding) updateBranding(x.branding);
        if (x.config) updateConfig(x.config);
        showToast('Backup restored');
      } catch (err) {
        showToast('Invalid backup');
      }
    };
    r.readAsText(f);
  };

  return (
    <Card>
      <Button onClick={backup} className="mb-4 block">Export JSON Backup</Button>
      
      <Label>Restore JSON Backup</Label>
      <Input type="file" accept="application/json" onChange={restore} />
    </Card>
  );
}
