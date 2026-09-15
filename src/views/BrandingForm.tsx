import React, { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input, Label } from '../components/ui';

export default function BrandingForm() {
  const { branding, updateBranding } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [form, setForm] = useState(branding);

  const saveBranding = () => {
    updateBranding(form);
    showToast('Branding updated');
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => setForm(p => ({ ...p, logo: r.result as string }));
      r.readAsDataURL(file);
    }
  };

  return (
    <Card>
      <Label>School Name</Label>
      <Input value={form.schoolName} onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))} />
      
      <Label>Motto</Label>
      <Input value={form.motto} onChange={e => setForm(p => ({ ...p, motto: e.target.value }))} />
      
      <Label>Address</Label>
      <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
      
      <Label>Phone / Contact</Label>
      <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
      
      <Label>Principal Name</Label>
      <Input value={form.principal} onChange={e => setForm(p => ({ ...p, principal: e.target.value }))} />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Primary</Label>
          <Input type="color" value={form.primary} onChange={e => setForm(p => ({ ...p, primary: e.target.value }))} className="h-12 p-1" />
        </div>
        <div>
          <Label>Secondary</Label>
          <Input type="color" value={form.secondary} onChange={e => setForm(p => ({ ...p, secondary: e.target.value }))} className="h-12 p-1" />
        </div>
        <div>
          <Label>Accent</Label>
          <Input type="color" value={form.accent} onChange={e => setForm(p => ({ ...p, accent: e.target.value }))} className="h-12 p-1" />
        </div>
      </div>
      
      <Label>Logo</Label>
      <Input type="file" accept="image/*" onChange={handleLogo} />
      
      <Button className="mt-[15px]" onClick={saveBranding}>Save Branding</Button>
    </Card>
  );
}
