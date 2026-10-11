import type { ReactNode, InputHTMLAttributes } from 'react';
import { Heart } from 'lucide-react';
import './setup.css';

export function SetupLayout({ children }: { children: ReactNode }) {
  return <main className="setup-screen">{children}</main>;
}
export function SetupBrand() {
  return <div className="setup-brand"><Heart size={24} color="#8a6240" /><span>Health Tracker</span></div>;
}
export function SetupField({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <label className="setup-field" htmlFor={id}><span>{label}</span><input id={id} {...props} /></label>;
}
