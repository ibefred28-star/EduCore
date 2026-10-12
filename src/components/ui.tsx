import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-[var(--primary)] text-white hover:brightness-95',
      secondary: 'bg-[var(--secondary)] text-slate-900 hover:brightness-95',
      danger: 'bg-red-600 text-white hover:brightness-95',
      success: 'bg-[var(--accent)] text-white hover:brightness-95'
    };
    
    return (
      <button
        ref={ref}
        className={cn('rounded-[9px] px-[15px] py-[10px] font-bold transition-all border-0 cursor-pointer disabled:opacity-50', variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('w-full p-[11px] border border-slate-300 rounded-[9px] bg-white mt-1', className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn('w-full p-[11px] border border-slate-300 rounded-[9px] bg-white mt-1', className)}
      {...props}
    />
  )
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn('w-full p-[11px] border border-slate-300 rounded-[9px] bg-white mt-1', className)}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-[13px] font-bold my-3 mb-1', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-[var(--card)] rounded-[var(--radius)] shadow-[var(--shadow)] p-5', className)} {...props}>
    {children}
  </div>
);

export const Modal = ({ 
  isOpen, 
  onClose, 
  children,
  className
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  children: React.ReactNode;
  className?: string;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/55 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className={cn('bg-[var(--card)] w-full max-w-[650px] p-5 rounded-[var(--radius)] shadow-[var(--shadow)] relative', className)}>
        {children}
      </div>
    </div>
  );
};

import { useToastStore } from '../store/toast';
import { motion, AnimatePresence } from 'motion/react';

export const ToastRenderer = () => {
  const { message } = useToastStore();
  
  return (
    <AnimatePresence>
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed right-5 bottom-5 bg-slate-900 text-white px-4 py-3 rounded-[9px] z-[3000]"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse space-y-4">
    <div className="flex items-center justify-between">
      <div className="h-5 bg-slate-200 rounded w-1/2"></div>
      <div className="h-4 bg-slate-200 rounded w-16"></div>
    </div>
    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
    <div className="flex items-center justify-between pt-2">
      <div className="h-4 bg-slate-200 rounded w-20"></div>
      <div className="h-8 bg-slate-200 rounded w-24"></div>
    </div>
  </div>
);

export const SkeletonRow = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse flex items-center justify-between gap-4">
    <div className="space-y-2 flex-1">
      <div className="h-4 bg-slate-200 rounded w-3/4"></div>
      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
    </div>
    <div className="h-8 bg-slate-200 rounded w-20"></div>
  </div>
);

export const Spinner = ({ className }: { className?: string }) => (
  <div className={cn("inline-block animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]", className)} role="status">
    <span className="sr-only">Loading...</span>
  </div>
);
