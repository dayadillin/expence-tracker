'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Home, PlusCircle, BookOpen, ArrowUpRight, ArrowDownLeft, 
  Calendar as CalendarIcon, Clock, CheckCircle2, 
  ChevronLeft, ChevronRight, Search, X, Trash2, Edit3, RotateCcw,
  Wallet, Target, Download, Sparkles, TrendingUp, TrendingDown,
  PieChart, BarChart3, AlertCircle, RefreshCw, Settings, LogOut, Plus,
  ChevronDown, Sun, Moon
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, addDoc, query, deleteDoc, doc, 
  updateDoc, setDoc, where, onSnapshot, deleteField 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import NicknameModal from './NicknameModal';
import SettingsModal from './SettingsModal';
import AnimatedNumber from './AnimatedNumber';
import BottomNav from './BottomNav';
import SectionHeader from './SectionHeader';
import AppBackground from './AppBackground';

// --- Types ---
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  timestamp?: string;
  userId: string;
  tuitionSessionId?: string;
  tuitionProfileId?: string;
}

interface TuitionProfile {
  id: string;
  name: string;
  targetDays: number;
  defaultFare: number;
  userId: string;
  createdAt?: string;
  startDate?: string;
  weeklyDays?: number[];
}

interface TuitionSession {
  id: string;
  date: string;
  userId: string;
  tuitionProfileId?: string;
  transactionId?: string;
  transportAmount?: number;
  createdAt?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface TuitionSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fare: number, deductFromMain: boolean) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
  date: Date;
  defaultFare: string;
  existingSession?: TuitionSession | null;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { name: string; type: 'income' | 'expense' }[];
  budgets: Record<string, number>;
  onSave: (budgets: Record<string, number>) => void;
}

interface AddTuitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    targetDays: string;
    defaultFare: string;
    startDate: string;
    weeklyDays: number[];
  }) => void;
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSave: (id: string, updated: { amount: number; category: string; date: string; type: 'income' | 'expense' }) => void;
  incomeCategories: string[];
  expenseCategories: string[];
}

// --- Constants ---
const SMART_AI_INCOMES = [
  'Mom', 'Dad', 'Tuition', 'Uni Stipend', 'Salary', 'Friend', 'Freelancing', 
  'Upwork', 'Project Bonus', 'Relative Gift', 'Scholarship'
];

const SMART_AI_EXPENSES = [
  'Khichuri', 'Biryani', 'Cigarettes', 'Transport (Rickshaw/Auto)', 'Pathao / Uber', 
  'Shared Flat Rent', 'Utilities (Electricity/Gas)', 'Wi-Fi Bill', 'Food & Snacks', 
  'Tea / Coffee', 'Books & Notes', 'Photocopy & Print', 'Lab Supplies', 'Stationery', 
  'Groceries', 'Medicine / Pharmacy', 'Gym / Fitness', 'Mobile Recharge', 'Entertainment'
];

const CATEGORY_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

const TRANSPORT_TO_TUITION_CATEGORY = 'Transport to Tuition';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// --- Helper Functions ---
const getDateKey = (date: Date | string | number): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const isScheduledTuitionDay = (date: Date, profile: TuitionProfile): boolean => {
  if (!profile.startDate || !profile.weeklyDays?.length) return false;
  const dateKey = getDateKey(date);
  if (dateKey < profile.startDate) return false;
  return profile.weeklyDays.includes(date.getDay());
};

const getWeekDates = (reference: Date): Date[] => {
  const start = new Date(reference);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
};

const getFrequencySorted = (items: string[]): string[] => {
  const counts: Record<string, number> = {};
  items.forEach((item) => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
};

const getAmountFrequencySorted = (amounts: number[]): number[] => {
  const counts: Record<string, number> = {};
  amounts.forEach((amt) => {
    const key = String(amt);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([amt]) => parseFloat(amt));
};

// --- MODAL COMPONENTS ---
function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop clickable to close */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-green-200 dark:border-green-800/60 bg-white dark:bg-[#121c15] p-5 text-gray-900 dark:text-gray-100 shadow-2xl shadow-green-900/10 animate-scale-in">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold">{title}</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-full transition-colors text-gray-500 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TuitionSessionModal({ isOpen, onClose, onConfirm, onRemove, date, defaultFare, existingSession }: TuitionSessionModalProps) {
  const [fare, setFare] = useState(defaultFare);
  const [deductFromMain, setDeductFromMain] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingSession) {
      setFare(String(existingSession.transportAmount ?? defaultFare));
      setDeductFromMain(!!existingSession.transactionId);
    } else {
      setFare(defaultFare);
      setDeductFromMain(false);
    }
  }, [defaultFare, isOpen, existingSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const success = await onConfirm(parseFloat(fare) || 0, deductFromMain);
      if (success) onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setSaving(true);
    try {
      const success = await onRemove();
      if (success) onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!existingSession;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Tuition Session - ${date.toLocaleDateString()}` : `Log Session - ${date.toLocaleDateString()}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isEditing ? 'Update transport fare and deduction settings:' : 'Record attendance and transport fare for this session:'}
        </p>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Transport Fare (৳)</label>
          <div className="flex items-center gap-2 bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 rounded-xl px-3 py-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">৳</span>
            <input
              type="number"
              step="any"
              min="0"
              value={fare}
              onChange={(e) => setFare(e.target.value)}
              className="flex-1 bg-transparent font-medium text-base text-green-600 dark:text-green-400 focus:outline-none"
              autoFocus
              required
            />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-950/20 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={deductFromMain}
            onChange={(e) => setDeductFromMain(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-green-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Deduct from Main Expense Tracker</span>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              Adds ৳{fare || '0'} as &quot;{TRANSPORT_TO_TUITION_CATEGORY}&quot; in your ledger
            </p>
          </div>
        </label>

        <div className="flex justify-between gap-2 pt-1">
          {isEditing && onRemove ? (
            <button type="button" onClick={handleRemove} disabled={saving} className="px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 transition-colors disabled:opacity-50">
              Remove Session
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-xs font-medium text-green-600 dark:text-green-400 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-xs font-medium transition-colors shadow-md shadow-green-500/20 disabled:opacity-50">
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Log Session'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, title = "Delete Item", message = "Are you sure you want to delete this item? This cannot be undone." }: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg text-xs font-medium text-green-600 dark:text-green-400 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors shadow-md shadow-red-600/20">
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BudgetModal({ isOpen, onClose, categories, budgets, onSave }: BudgetModalProps) {
  const [budgetData, setBudgetData] = useState<Record<string, number>>(budgets);

  useEffect(() => {
    setBudgetData(budgets);
  }, [budgets, isOpen]);

  const handleSave = () => {
    onSave(budgetData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Budget Limits">
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">Set monthly spend limits per category:</p>
        {categories.filter(c => c.type === 'expense').map(cat => (
          <div key={cat.name} className="flex items-center gap-3 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30 p-3 rounded-xl">
            <span className="text-xs flex-1 text-gray-900 dark:text-gray-100 font-medium">{cat.name}</span>
            <div className="flex items-center gap-1 bg-white dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">৳</span>
              <input
                type="number"
                value={budgetData[cat.name] || 0}
                onChange={(e) => setBudgetData({ ...budgetData, [cat.name]: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-transparent text-xs font-medium text-green-600 dark:text-green-400 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 border border-green-200 dark:border-green-800/60 hover:bg-green-50 dark:hover:bg-green-950/40 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-xs"
          >
            Cancel / Back
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="flex-1 bg-green-500 hover:bg-green-400 text-white font-medium py-2.5 rounded-xl transition-colors text-xs shadow-md shadow-green-500/20"
          >
            Save Budgets
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddTuitionModal({ isOpen, onClose, onConfirm }: AddTuitionModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(getDateKey(new Date()));
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [targetDays, setTargetDays] = useState('8');
  const [defaultFare, setDefaultFare] = useState('100');

  const resetForm = () => {
    setStep(1);
    setName('');
    setStartDate(getDateKey(new Date()));
    setWeeklyDays([]);
    setTargetDays('8');
    setDefaultFare('100');
  };

  const toggleDay = (day: number) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    onConfirm({ name, targetDays, defaultFare, startDate, weeklyDays });
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Tuition Profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-1 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/40'}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tuition Name</label>
              <input
                type="text"
                placeholder="e.g. Math, Physics, Student A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From which date will this tuition start?</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                required
              />
            </div>
          </>
        )}

        {step === 2 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Which days of the week will you attend?</label>
            <div className="grid grid-cols-2 gap-2">
              {WEEKDAY_LABELS.map((label, dayIndex) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(dayIndex)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
                    weeklyDays.includes(dayIndex)
                      ? 'border-green-500 bg-green-500 text-white shadow-md shadow-green-500/30'
                      : 'border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-[#0a110c] text-gray-600 dark:text-gray-300 hover:border-green-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {weeklyDays.length === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2">Select at least one day</p>
            )}
          </div>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monthly Day Goal</label>
              <input
                type="number"
                min="1"
                value={targetDays}
                onChange={(e) => setTargetDays(e.target.value)}
                className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Default Transport Fare / Trip (৳)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={defaultFare}
                onChange={(e) => setDefaultFare(e.target.value)}
                className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                required
              />
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30 p-3 text-[10px] text-gray-500 dark:text-gray-400">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Schedule summary</p>
              <p>Starts: {formatDisplayDate(startDate)}</p>
              <p>Days: {weeklyDays.map((d) => WEEKDAY_LABELS[d]).join(', ') || 'None'}</p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="flex-1 border border-green-200 dark:border-green-800/60 hover:bg-green-50 dark:hover:bg-green-950/40 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-xs">
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={step === 2 && weeklyDays.length === 0}
            className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors text-sm shadow-md shadow-green-500/20"
          >
            {step < 3 ? 'Continue' : 'Add Tuition'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTransactionModal({ isOpen, onClose, transaction, onSave, incomeCategories, expenseCategories }: EditTransactionModalProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(getDateKey(new Date()));
  const [type, setType] = useState<'income' | 'expense'>('expense');

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setCategory(transaction.category);
      setDate(transaction.date);
      setType(transaction.type);
    }
  }, [transaction, isOpen]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || !category.trim()) return;
    onSave(transaction.id, {
      amount: parseFloat(amount),
      category: category.trim(),
      date,
      type
    });
    onClose();
  };

  const pool = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex rounded-xl bg-green-50 dark:bg-green-950/30 p-1 border border-green-200 dark:border-green-800/40">
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              type === 'income' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              type === 'expense' ? 'bg-gray-900 dark:bg-gray-800 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Expense
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
          <input
            type="text"
            list="edit-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
            required
          />
          <datalist id="edit-category-suggestions">
            {pool.map((cat, i) => (
              <option key={i} value={cat} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (৳)</label>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
            required
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-green-200 dark:border-green-800/60 hover:bg-green-50 dark:hover:bg-green-950/40 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl transition text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-green-500 hover:bg-green-400 text-white font-medium py-2.5 rounded-xl transition text-xs shadow-md shadow-green-500/20"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- SWIPE TO DELETE COMPONENT ---
function SwipeToDelete({
  onDelete,
  onEdit,
  children
}: {
  onDelete: () => void;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const startXRef = useRef<number | null>(null);
  const swipeXRef = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 50;
  const maxReveal = onEdit ? 120 : 75;

  const handleStart = (clientX: number) => {
    startXRef.current = clientX;
    isDragging.current = true;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current || startXRef.current === null) return;
    const diff = startXRef.current - clientX;
    if (diff > 0) {
      const next = Math.min(diff, maxReveal);
      swipeXRef.current = next;
      setSwipeX(next);
    }
  };

  const handleEnd = () => {
    isDragging.current = false;
    const currentSwipe = swipeXRef.current;
    if (currentSwipe >= SWIPE_THRESHOLD) {
      swipeXRef.current = maxReveal;
      setSwipeX(maxReveal);
      setIsSwiped(true);
    } else {
      swipeXRef.current = 0;
      setSwipeX(0);
      setIsSwiped(false);
    }
    startXRef.current = null;
  };

  const handleReset = () => {
    swipeXRef.current = 0;
    setSwipeX(0);
    setIsSwiped(false);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl group" ref={containerRef}>
      {/* Side Action Buttons */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end rounded-2xl bg-gradient-to-l from-red-600 to-red-500 pr-2 transition-all duration-200"
        style={{ width: `${swipeX}px` }}
      >
        {isSwiped && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                  onEdit();
                }}
                className="flex flex-col items-center gap-0.5 rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 transition"
                title="Edit transaction"
              >
                <Edit3 size={13} />
                <span className="text-[8px] font-bold uppercase tracking-wider">Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
                onDelete();
              }}
              className="flex flex-col items-center gap-0.5 rounded-xl bg-black/20 p-2 text-white hover:bg-black/30 transition"
              title="Delete transaction"
            >
              <Trash2 size={13} />
              <span className="text-[8px] font-bold uppercase tracking-wider">Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Swipeable content */}
      <div
        className="relative touch-pan-y transition-transform duration-150 ease-out select-none"
        style={{ transform: `translateX(-${swipeX}px)` }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => { if (isDragging.current) handleMove(e.clientX); }}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onClick={() => { if (isSwiped) handleReset(); }}
      >
        {children}
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function TrackerApp() {
  const { user, nickname, loading: authLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tuitionSessions, setTuitionSessions] = useState<TuitionSession[]>([]);
  const [tuitionProfiles, setTuitionProfiles] = useState<TuitionProfile[]>([]);
  const [selectedTuitionId, setSelectedTuitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [incomeCategories, setIncomeCategories] = useState<string[]>(SMART_AI_INCOMES);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(SMART_AI_EXPENSES);

  // Form states
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customDate, setCustomDate] = useState(getDateKey(new Date()));
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [filteredAmountSuggestions, setFilteredAmountSuggestions] = useState<number[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [showAmountSuggestions, setShowAmountSuggestions] = useState(false);
  const [activeFormType, setActiveFormType] = useState<'income' | 'expense'>('expense');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [tuitionViewMode, setTuitionViewMode] = useState<'week' | 'month'>('month');
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({});

  // Modals & Selection states
  const [showFareModal, setShowFareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteTuitionModal, setShowDeleteTuitionModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAddTuitionModal, setShowAddTuitionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Toast / Undo State
  const [deletedTxBackup, setDeletedTxBackup] = useState<Transaction | null>(null);
  const [undoToastVisible, setUndoToastVisible] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef(false);

  // Dark Mode init
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleToggleDarkMode = (isDark: boolean) => {
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const clearUserData = useCallback(() => {
    setTransactions([]);
    setTuitionSessions([]);
    setTuitionProfiles([]);
    setSelectedTuitionId(null);
    setIncomeCategories(SMART_AI_INCOMES);
    setExpenseCategories(SMART_AI_EXPENSES);
    setAmount('');
    setCategory('');
    setCustomDate(getDateKey(new Date()));
    setFilteredSuggestions([]);
    setFilteredAmountSuggestions([]);
    setShowCategorySuggestions(false);
    setShowAmountSuggestions(false);
    setBudgetLimits({});
    setSearchQuery('');
    setSelectedDate(null);
    setSelectedTransaction(null);
    setEditingTransaction(null);
    setShowFareModal(false);
    setShowDeleteModal(false);
    setShowDeleteTuitionModal(false);
    setShowBudgetModal(false);
    setShowAddTuitionModal(false);
    setShowEditModal(false);
    setShowAnalytics(false);
    setShowSettings(false);
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    try {
      isLoggingOutRef.current = true;
      await logout();
    } catch (error) {
      isLoggingOutRef.current = false;
      console.error('Error logging out:', error);
    }
  };

  const applyTransactions = useCallback((txList: Transaction[]) => {
    setTransactions(txList);
    const customIncomes = new Set(SMART_AI_INCOMES);
    const customExpenses = new Set(SMART_AI_EXPENSES);
    txList.forEach((t) => {
      if (t.type === 'income') customIncomes.add(t.category);
      if (t.type === 'expense') customExpenses.add(t.category);
    });
    setIncomeCategories(Array.from(customIncomes));
    setExpenseCategories(Array.from(customExpenses));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Firebase Realtime Subscriptions
  useEffect(() => {
    if (!user) {
      isLoggingOutRef.current = false;
      clearUserData();
      return;
    }

    setLoading(true);

    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );
    const tuitionQuery = query(
      collection(db, 'tuition'),
      where('userId', '==', user.uid)
    );
    const tuitionProfilesQuery = query(
      collection(db, 'tuitionProfiles'),
      where('userId', '==', user.uid)
    );
    const budgetDocRef = doc(db, 'budgets', user.uid);

    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        if (isLoggingOutRef.current) return;
        try {
          const txList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Transaction))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          applyTransactions(txList);
          setLoading(false);
        } catch (error) {
          console.error('Error processing transactions snapshot:', error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to transactions:', error);
        setLoading(false);
      }
    );

    const unsubscribeTuition = onSnapshot(
      tuitionQuery,
      (snapshot) => {
        if (isLoggingOutRef.current) return;
        try {
          const tuitionList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TuitionSession))
            .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          setTuitionSessions(tuitionList);
        } catch (error) {
          console.error('Error processing tuition snapshot:', error);
        }
      },
      (error) => {
        console.error('Error listening to tuition:', error);
      }
    );

    const unsubscribeTuitionProfiles = onSnapshot(
      tuitionProfilesQuery,
      (snapshot) => {
        if (isLoggingOutRef.current) return;
        try {
          const profiles = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TuitionProfile))
            .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          setTuitionProfiles(profiles);
        } catch (error) {
          console.error('Error processing tuition profiles snapshot:', error);
        }
      },
      (error) => {
        console.error('Error listening to tuition profiles:', error);
      }
    );

    const unsubscribeBudgets = onSnapshot(
      budgetDocRef,
      (docSnap) => {
        if (isLoggingOutRef.current) return;
        if (docSnap.exists()) {
          setBudgetLimits(docSnap.data().limits || {});
        } else {
          // Check localStorage fallback
          const localBudgets = localStorage.getItem(`budgets_${user.uid}`);
          if (localBudgets) {
            try {
              setBudgetLimits(JSON.parse(localBudgets));
            } catch (e) {
              setBudgetLimits({});
            }
          }
        }
      },
      (error) => {
        console.error('Error listening to budgets:', error);
      }
    );

    return () => {
      unsubscribeTx();
      unsubscribeTuition();
      unsubscribeTuitionProfiles();
      unsubscribeBudgets();
    };
  }, [user, clearUserData, applyTransactions]);

  // Tuition Profile select
  useEffect(() => {
    if (tuitionProfiles.length === 0) {
      setSelectedTuitionId(null);
      return;
    }
    if (!selectedTuitionId || !tuitionProfiles.some((p) => p.id === selectedTuitionId)) {
      setSelectedTuitionId(tuitionProfiles[0].id);
    }
  }, [tuitionProfiles, selectedTuitionId]);

  const activeTuition = tuitionProfiles.find((p) => p.id === selectedTuitionId) || null;

  const getProfileSessions = useCallback((profileId?: string | null) => {
    if (!profileId) return [];
    const firstProfileId = tuitionProfiles[0]?.id;
    return tuitionSessions.filter((session) => {
      if (session.tuitionProfileId === profileId) return true;
      return !session.tuitionProfileId && profileId === firstProfileId;
    });
  }, [tuitionSessions, tuitionProfiles]);

  const activeProfileSessions = useMemo(
    () => getProfileSessions(selectedTuitionId),
    [getProfileSessions, selectedTuitionId]
  );

  const frequentIncomeCategories = useMemo(() => {
    const fromTx = getFrequencySorted(
      transactions.filter((t) => t.type === 'income').map((t) => t.category)
    );
    return [...new Set([...fromTx, ...incomeCategories])];
  }, [transactions, incomeCategories]);

  const frequentExpenseCategories = useMemo(() => {
    const fromTx = getFrequencySorted(
      transactions.filter((t) => t.type === 'expense').map((t) => t.category)
    );
    return [...new Set([...fromTx, ...expenseCategories])];
  }, [transactions, expenseCategories]);

  const frequentIncomeAmounts = useMemo(
    () => getAmountFrequencySorted(transactions.filter((t) => t.type === 'income').map((t) => t.amount)),
    [transactions]
  );

  const frequentExpenseAmounts = useMemo(
    () => getAmountFrequencySorted(transactions.filter((t) => t.type === 'expense').map((t) => t.amount)),
    [transactions]
  );

  const getCategorySuggestions = (type: 'income' | 'expense', filter: string) => {
    const pool = type === 'income' ? frequentIncomeCategories : frequentExpenseCategories;
    if (!filter.trim()) return pool.slice(0, 8);
    return pool.filter((item) => item.toLowerCase().includes(filter.toLowerCase())).slice(0, 8);
  };

  const getAmountSuggestions = (type: 'income' | 'expense') => {
    const pool = type === 'income' ? frequentIncomeAmounts : frequentExpenseAmounts;
    return pool.slice(0, 6);
  };

  const handleCategoryChange = (val: string, type: 'income' | 'expense') => {
    setCategory(val);
    setActiveFormType(type);
    setFilteredSuggestions(getCategorySuggestions(type, val));
    setShowCategorySuggestions(true);
  };

  const handleCategoryFocus = (type: 'income' | 'expense') => {
    setActiveFormType(type);
    setFilteredSuggestions(getCategorySuggestions(type, category));
    setShowCategorySuggestions(true);
  };

  const handleAmountFocus = (type: 'income' | 'expense') => {
    setActiveFormType(type);
    setFilteredAmountSuggestions(getAmountSuggestions(type));
    setShowAmountSuggestions(true);
  };

  const handleSaveBudgets = async (newBudgets: Record<string, number>) => {
    setBudgetLimits(newBudgets);
    if (!user) return;
    try {
      localStorage.setItem(`budgets_${user.uid}`, JSON.stringify(newBudgets));
      await setDoc(doc(db, 'budgets', user.uid), { limits: newBudgets, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Error saving budgets to Firebase:', error);
    }
  };

  const handleSubmitTransaction = async (e: React.FormEvent, type: 'income' | 'expense') => {
    e.preventDefault();
    if (!user || !amount || isNaN(Number(amount)) || !category.trim()) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        amount: parseFloat(amount),
        type,
        category: category.trim(),
        date: customDate || getDateKey(new Date()),
        timestamp: new Date().toISOString(),
        userId: user.uid,
      });
      
      setAmount('');
      setCategory('');
      setCustomDate(getDateKey(new Date()));
      setFilteredSuggestions([]);
      setFilteredAmountSuggestions([]);
      setShowCategorySuggestions(false);
      setShowAmountSuggestions(false);
      setActiveTab('home');
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleUpdateTransaction = async (
    id: string,
    updated: { amount: number; category: string; date: string; type: 'income' | 'expense' }
  ) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'transactions', id), {
        amount: updated.amount,
        category: updated.category,
        date: updated.date,
        type: updated.type,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    const target = transactions.find((t) => t.id === id);

    try {
      const linkedSessions = tuitionSessions.filter((s) => s.transactionId === id);
      for (const session of linkedSessions) {
        await updateDoc(doc(db, 'tuition', session.id), { transactionId: deleteField() });
      }

      await deleteDoc(doc(db, 'transactions', id));
      setShowDeleteModal(false);
      setSelectedTransaction(null);

      // Toast undo mechanism
      if (target) {
        setDeletedTxBackup(target);
        setUndoToastVisible(true);
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        undoTimeoutRef.current = setTimeout(() => {
          setUndoToastVisible(false);
          setDeletedTxBackup(null);
        }, 5000);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleUndoDelete = async () => {
    if (!deletedTxBackup || !user) return;
    try {
      const { id, ...data } = deletedTxBackup;
      await setDoc(doc(db, 'transactions', id), {
        ...data,
        userId: user.uid,
      });
      setUndoToastVisible(false);
      setDeletedTxBackup(null);
    } catch (error) {
      console.error('Error undoing transaction delete:', error);
    }
  };

  const handleDeleteTuitionProfile = async () => {
    if (!user || !selectedTuitionId) return;

    try {
      const sessionsToDelete = getProfileSessions(selectedTuitionId);
      for (const session of sessionsToDelete) {
        await deleteDoc(doc(db, 'tuition', session.id));
        if (session.transactionId) {
          await deleteDoc(doc(db, 'transactions', session.transactionId));
        }
      }
      // Delete profile
      await deleteDoc(doc(db, 'tuitionProfiles', selectedTuitionId));
      setShowDeleteTuitionModal(false);
    } catch (error) {
      console.error('Error deleting tuition profile:', error);
    }
  };

  const handleDayClick = (dateObj: Date) => {
    if (!selectedTuitionId) return;
    setSelectedDate(dateObj);
    setShowFareModal(true);
  };

  const handleAddTuition = async (data: {
    name: string;
    targetDays: string;
    defaultFare: string;
    startDate: string;
    weeklyDays: number[];
  }) => {
    if (!user) return;

    try {
      const profileRef = await addDoc(collection(db, 'tuitionProfiles'), {
        name: data.name.trim(),
        targetDays: Math.max(1, parseInt(data.targetDays, 10) || 1),
        defaultFare: parseFloat(data.defaultFare) || 0,
        startDate: data.startDate,
        weeklyDays: data.weeklyDays,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setSelectedTuitionId(profileRef.id);
      setShowAddTuitionModal(false);
    } catch (error) {
      console.error('Error adding tuition profile:', error);
    }
  };

  const handleUpdateTuitionProfile = async (field: 'targetDays' | 'defaultFare' | 'name', value: string) => {
    if (!user || !selectedTuitionId) return;

    try {
      const payload: Record<string, any> = {};
      if (field === 'targetDays') {
        payload.targetDays = Math.max(1, parseInt(value, 10) || 1);
      } else if (field === 'defaultFare') {
        payload.defaultFare = parseFloat(value) || 0;
      } else if (field === 'name') {
        payload.name = value.trim();
      }
      await updateDoc(doc(db, 'tuitionProfiles', selectedTuitionId), payload);
    } catch (error) {
      console.error('Error updating tuition profile:', error);
    }
  };

  const createTransportTransaction = async (
    sessionId: string,
    profileId: string,
    dateKey: string,
    fareAmount: number
  ) => {
    if (!user) return null;
    const transportRef = await addDoc(collection(db, 'transactions'), {
      amount: fareAmount,
      type: 'expense',
      category: TRANSPORT_TO_TUITION_CATEGORY,
      date: dateKey,
      timestamp: new Date().toISOString(),
      tuitionSessionId: sessionId,
      tuitionProfileId: profileId,
      userId: user.uid,
    });
    return transportRef.id;
  };

  const handleSessionConfirm = async (fareAmount: number, deductFromMain: boolean): Promise<boolean> => {
    if (!user || !selectedDate || !selectedTuitionId || !activeTuition) return false;
    const dateKey = getDateKey(selectedDate);
    const existingSession = activeProfileSessions.find((s) => getDateKey(s.date) === dateKey);

    try {
      if (existingSession) {
        const updates: Record<string, unknown> = {
          transportAmount: fareAmount,
        };

        if (deductFromMain && fareAmount > 0) {
          if (existingSession.transactionId) {
            await updateDoc(doc(db, 'transactions', existingSession.transactionId), {
              amount: fareAmount,
              date: dateKey,
              category: TRANSPORT_TO_TUITION_CATEGORY,
              updatedAt: new Date().toISOString(),
            });
          } else {
            const txId = await createTransportTransaction(
              existingSession.id,
              selectedTuitionId,
              dateKey,
              fareAmount
            );
            if (txId) updates.transactionId = txId;
          }
        } else if (existingSession.transactionId) {
          await deleteDoc(doc(db, 'transactions', existingSession.transactionId));
          updates.transactionId = deleteField();
        }

        await updateDoc(doc(db, 'tuition', existingSession.id), updates);
      } else {
        const sessionRef = await addDoc(collection(db, 'tuition'), {
          date: dateKey,
          createdAt: new Date().toISOString(),
          userId: user.uid,
          tuitionProfileId: selectedTuitionId,
          transportAmount: fareAmount,
        });

        if (deductFromMain && fareAmount > 0) {
          const txId = await createTransportTransaction(
            sessionRef.id,
            selectedTuitionId,
            dateKey,
            fareAmount
          );
          if (txId) {
            await updateDoc(sessionRef, { transactionId: txId });
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating tuition session:', error);
      return false;
    }
  };

  const handleSessionRemove = async (): Promise<boolean> => {
    if (!user || !selectedDate) return false;
    const dateKey = getDateKey(selectedDate);
    const existingSession = activeProfileSessions.find((s) => getDateKey(s.date) === dateKey);
    if (!existingSession) return false;

    try {
      await deleteDoc(doc(db, 'tuition', existingSession.id));
      if (existingSession.transactionId) {
        await deleteDoc(doc(db, 'transactions', existingSession.transactionId));
      }
      return true;
    } catch (error) {
      console.error('Error removing tuition session:', error);
      return false;
    }
  };

  const exportData = () => {
    if (transactions.length === 0) return;
    const csvContent = [
      ['Date', 'Category', 'Type', 'Amount (BDT)'],
      ...transactions.map(t => [t.date, `"${t.category.replace(/"/g, '""')}"`, t.type, t.amount])
    ].map(row => row.join(',')).join('\n');

    // Added UTF-8 BOM \uFEFF for proper Bengali & symbol rendering in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${getDateKey(new Date())}.csv`;
    a.click();
  };

  // --- Calculations ---
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0), [transactions]);
  const currentBalance = totalIncome - totalExpense;

  const currentMonthKey = getDateKey(new Date()).slice(0, 7);
  const monthTransactions = useMemo(() => transactions.filter(t => t.date.startsWith(currentMonthKey)), [transactions, currentMonthKey]);
  const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  const todayKey = getDateKey(new Date());
  const todayTransactions = transactions.filter(t => t.date === todayKey);
  const todayIncome = todayTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const todayExpense = todayTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const todayNet = todayIncome - todayExpense;

  // Fixed Streak Counter logic
  const calculateStreak = useCallback((sessions: TuitionSession[]) => {
    const sortedDates = [...new Set(sessions.map((s) => s.date))].sort();
    if (sortedDates.length === 0) return { streak: 0, active: false };

    let streak = 0;
    const now = new Date();
    const todayStr = getDateKey(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateKey(yesterday);

    const hasToday = sortedDates.includes(todayStr);
    const hasYesterday = sortedDates.includes(yesterdayStr);

    if (!hasToday && !hasYesterday) {
      return { streak: 0, active: false };
    }

    let cursor = hasToday ? new Date(now) : new Date(yesterday);
    while (sortedDates.includes(getDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { streak, active: hasToday || streak > 0 };
  }, []);

  const homeTuition = activeTuition || tuitionProfiles[0] || null;
  const homeTuitionSessions = getProfileSessions(homeTuition?.id);
  const streakInfo = calculateStreak(homeTuitionSessions);

  // Category Pie breakdown for Analytics
  const categoryBreakdown = useMemo(() => {
    const expenseTx = transactions.filter(t => t.type === 'expense');
    const total = expenseTx.reduce((sum, t) => sum + t.amount, 0);
    if (total === 0) return [];

    const catMap: Record<string, number> = {};
    expenseTx.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    const entries = Object.entries(catMap)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: (amount / total) * 100
      }))
      .sort((a, b) => b.amount - a.amount);

    return entries.slice(0, 6);
  }, [transactions]);

  // Filtered & Correctly grouped transactions without timezone issues
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.amount.toString().includes(searchQuery) ||
        t.date.includes(searchQuery)
      );
    }
    return filtered;
  }, [transactions, searchQuery]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce<Record<string, Transaction[]>>((groups, transaction) => {
      const displayDate = formatDisplayDate(transaction.date);
      if (!groups[displayDate]) groups[displayDate] = [];
      groups[displayDate].push(transaction);
      return groups;
    }, {});
  }, [filteredTransactions]);

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const currentMonthSessions = activeProfileSessions.filter((s) => {
    const d = new Date(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const sessionsDone = currentMonthSessions.length;
  const targetSessions = activeTuition?.targetDays || 0;
  const sessionsLeft = Math.max(0, targetSessions - sessionsDone);
  const homeSessionsDone = homeTuitionSessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const homeTargetSessions = homeTuition?.targetDays || 0;

  const selectedExistingSession = selectedDate
    ? activeProfileSessions.find((s) => getDateKey(s.date) === getDateKey(selectedDate)) || null
    : null;

  const weekDates = getWeekDates(calendarDate);

  // Budget tracking
  const getBudgetStatus = (cat: string) => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(currentMonthKey))
      .reduce((acc, curr) => acc + curr.amount, 0);
    const budget = budgetLimits[cat] || 0;
    return { spent, budget, percentage: budget > 0 ? (spent / budget) * 100 : 0 };
  };

  // Monthly trend data
  const getMonthlyTrend = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    transactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, expense: 0 };
      if (t.type === 'income') months[m].income += t.amount;
      else months[m].expense += t.amount;
    });
    return Object.entries(months).slice(-6);
  }, [transactions]);

  if (!mounted || authLoading || loading) {
    return (
      <div className="finance-app app-shell-bg relative min-h-screen flex items-center justify-center" suppressHydrationWarning>
        <AppBackground moneyRain={false} />
        <div className="relative z-10 w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginModal />;
  if (!nickname) return <NicknameModal />;

  const initials = nickname.slice(0, 2).toUpperCase();

  return (
    <div className="finance-app relative min-h-screen app-shell-bg text-gray-900 dark:text-gray-100 flex flex-col font-sans pb-28 transition-colors duration-200" suppressHydrationWarning>
      <AppBackground moneyRain={false} />

      <div className="relative z-10 flex flex-col flex-1">
      {/* --- MODALS --- */}
      <TuitionSessionModal
        key={selectedTuitionId || 'no-tuition'}
        isOpen={showFareModal}
        onClose={() => { setShowFareModal(false); setSelectedDate(null); }}
        onConfirm={handleSessionConfirm}
        onRemove={selectedExistingSession ? handleSessionRemove : undefined}
        date={selectedDate || new Date()}
        defaultFare={String(
          selectedExistingSession?.transportAmount ?? activeTuition?.defaultFare ?? 100
        )}
        existingSession={selectedExistingSession}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedTransaction(null); }}
        onConfirm={() => selectedTransaction && handleDeleteTransaction(selectedTransaction)}
      />

      <DeleteConfirmModal
        isOpen={showDeleteTuitionModal}
        title="Delete Tuition Profile"
        message={`Are you sure you want to delete "${activeTuition?.name}"? All associated attendance records and transport expenses will be removed.`}
        onClose={() => setShowDeleteTuitionModal(false)}
        onConfirm={handleDeleteTuitionProfile}
      />

      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        categories={[...incomeCategories, ...expenseCategories].map(c => ({ name: c, type: expenseCategories.includes(c) ? 'expense' : 'income' }))}
        budgets={budgetLimits}
        onSave={handleSaveBudgets}
      />

      <AddTuitionModal
        isOpen={showAddTuitionModal}
        onClose={() => setShowAddTuitionModal(false)}
        onConfirm={handleAddTuition}
      />

      <EditTransactionModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingTransaction(null); }}
        transaction={editingTransaction}
        onSave={handleUpdateTransaction}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
      />

      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowSettings(false)} />
          <div className="relative z-10">
            <SettingsModal 
              onClose={() => setShowSettings(false)} 
              darkMode={darkMode}
              setDarkMode={handleToggleDarkMode}
            />
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 mx-auto w-full max-w-md animate-fade-up">
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-green-200/80 dark:border-green-800/40 glass-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient text-white shadow-lg shadow-green-500/20 animate-float-gentle icon-mono">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Hi, {nickname} 👋</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => handleToggleDarkMode(!darkMode)}
              className="rounded-xl p-2 text-gray-500 dark:text-gray-400 transition-all hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-600 dark:hover:text-green-400" 
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={exportData} className="rounded-xl p-2 text-gray-500 dark:text-gray-400 transition-all hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-600 dark:hover:text-green-400" title="Export CSV">
              <Download size={18} />
            </button>
            <button onClick={() => setShowBudgetModal(true)} className="rounded-xl p-2 text-gray-500 dark:text-gray-400 transition-all hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-600 dark:hover:text-green-400" title="Set Budgets">
              <Target size={18} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-md shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-700"
              title={`${nickname} — Account & Preferences`}
            >
              {initials}
            </button>
            <button onClick={handleLogout} className="rounded-xl p-2 text-gray-500 dark:text-gray-400 transition-all hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-red-500" title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-3 max-w-md mx-auto w-full" key={activeTab}>
        
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="animate-tab-enter space-y-4">

            {/* Hero balance */}
            <div className="hero-gradient shimmer-wrap relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-green-900/20 animate-scale-in">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 animate-pulse-soft" />
              <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5 animate-spin-slow" />
              <div className="relative">
                <span className="text-[11px] font-medium uppercase tracking-widest text-green-100">Total Balance</span>
                <h2 className="mt-1 text-4xl font-bold tracking-tight">
                  <AnimatedNumber value={Math.abs(currentBalance)} prefix={currentBalance < 0 ? '-৳' : '৳'} />
                </h2>
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <span className="text-[10px] text-green-100">Income</span>
                    <p className="text-sm font-semibold">৳{totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
                    <span className="text-[10px] text-green-100">Spent</span>
                    <p className="text-sm font-semibold">৳{totalExpense.toLocaleString()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-green-100 transition hover:text-white cursor-pointer"
                >
                  <PieChart size={14} className={showAnalytics ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                  {showAnalytics ? 'Hide charts & breakdown' : 'Show charts & breakdown'}
                </button>
              </div>
            </div>

            {/* Stat pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide animate-fade-up stagger-2">
              <div className="shrink-0 rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">Today</span>
                <p className={`text-lg font-bold ${todayNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>৳{todayNet.toLocaleString()}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">Month</span>
                <p className={`text-lg font-bold ${monthBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>৳{monthBalance.toLocaleString()}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">🔥 Streak</span>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{streakInfo.streak} days</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">Tuition</span>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {homeTuition ? `${homeSessionsDone}/${homeTargetSessions}` : '—'}
                </p>
              </div>
            </div>

            {/* Budget alerts */}
            {Object.entries(budgetLimits).map(([cat, limit]) => {
              const status = getBudgetStatus(cat);
              if (status.percentage > 80 && status.budget > 0) {
                return (
                  <div key={cat} className="animate-fade-up flex items-center justify-between rounded-2xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">{cat} Alert</p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                          Spent ৳{status.spent} of ৳{status.budget} limit ({status.percentage.toFixed(0)}%)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBudgetModal(true)}
                      className="rounded-lg bg-amber-200/60 dark:bg-amber-800/40 px-2 py-1 text-[10px] font-bold text-amber-900 dark:text-amber-200"
                    >
                      Adjust
                    </button>
                  </div>
                );
              }
              return null;
            })}

            {/* Analytics & Pie Chart */}
            {showAnalytics && (
              <div className="animate-scale-in space-y-4 rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-5 shadow-sm">
                
                {/* 🥧 Pie / Donut Breakdown */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <PieChart size={14} className="text-green-500" /> Spending Breakdown
                  </h3>
                  {categoryBreakdown.length === 0 ? (
                    <p className="text-xs text-gray-400 py-3 text-center">No expense data available</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Visual segmented bar */}
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        {categoryBreakdown.map((item, idx) => (
                          <div
                            key={item.category}
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                            }}
                            title={`${item.category}: ${item.percentage.toFixed(1)}%`}
                            className="h-full transition-all duration-500"
                          />
                        ))}
                      </div>

                      {/* Legend grid */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {categoryBreakdown.map((item, idx) => (
                          <div key={item.category} className="flex items-center gap-2 text-xs">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                            />
                            <div className="flex-1 truncate">
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{item.category}</span>
                              <span className="text-[10px] text-gray-400 ml-1">({item.percentage.toFixed(0)}%)</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-gray-100">৳{item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-green-100 dark:border-green-900/40" />

                {/* 📊 6-Month Trend */}
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <BarChart3 size={14} className="text-green-500" /> 6-Month Trend
                  </h3>
                  <div className="space-y-3">
                    {getMonthlyTrend.map(([m, data], i) => (
                      <div key={m} className="animate-fade-up flex items-center gap-3" style={{ animationDelay: `${i * 0.06}s` }}>
                        <span className="w-14 text-[10px] font-medium text-gray-500 dark:text-gray-400">{m}</span>
                        <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-green-50 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-green-500 transition-all duration-1000" style={{ width: `${(data.income / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense), 1)) * 100}%` }} />
                          <div className="h-full rounded-full bg-gray-900 dark:bg-gray-400 transition-all duration-1000" style={{ width: `${(data.expense / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense), 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bento action grid */}
            <div className="grid grid-cols-2 gap-3 animate-fade-up stagger-3">
              <button onClick={() => setActiveTab('expense-hub')} className="hover-lift col-span-2 flex items-center gap-4 rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-4 text-left shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/30">
                  <PlusCircle size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">Log & Track</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Income & expenses</p>
                </div>
                <ChevronRight size={20} className="text-green-500" />
              </button>
              <button onClick={() => setActiveTab('history')} className="hover-lift rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-4 text-left shadow-sm">
                <Clock size={22} className="mb-2 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Ledger</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">History & Timeline</p>
              </button>
              <button onClick={() => setActiveTab('tuition')} className="hover-lift rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-4 text-left shadow-sm">
                <BookOpen size={22} className="mb-2 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Tuition</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Calendar & Goal</p>
              </button>
              <button onClick={() => { setActiveTab('add-money'); setAmount(''); setCategory(''); setCustomDate(getDateKey(new Date())); setActiveFormType('income'); }} className="hover-lift rounded-2xl bg-green-500 py-3 text-xs font-bold text-white shadow-md shadow-green-500/25">
                + Income
              </button>
              <button onClick={() => { setActiveTab('add-expense'); setAmount(''); setCategory(''); setCustomDate(getDateKey(new Date())); setActiveFormType('expense'); }} className="hover-lift rounded-2xl bg-gray-900 dark:bg-gray-800 py-3 text-xs font-bold text-white shadow-md">
                − Expense
              </button>
            </div>

            {/* Recent — horizontal scroll */}
            <div className="animate-fade-up stagger-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Recent</span>
                <button onClick={() => setActiveTab('history')} className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline">See all</button>
              </div>
              {transactions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-green-300 dark:border-green-800/60 bg-green-50/50 dark:bg-green-950/20 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  No transactions yet — add your first one!
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {transactions.slice(0, 6).map((t, i) => (
                    <div
                      key={t.id}
                      onClick={() => { setEditingTransaction(t); setShowEditModal(true); }}
                      className="hover-lift shrink-0 w-36 animate-fade-up rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-3 shadow-sm cursor-pointer"
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      <div className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${t.type === 'income' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                        {t.type}
                      </div>
                      <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{t.category}</p>
                      <p className={`mt-1 text-sm font-bold ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {t.type === 'income' ? '+' : '−'}৳{t.amount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-[9px] text-gray-400">{formatDisplayDate(t.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* EXPENSE HUB */}
        {activeTab === 'expense-hub' && (
          <div className="animate-tab-enter space-y-4">
            <SectionHeader title="What are you logging?" subtitle="Pick a flow to get started" onBack={() => setActiveTab('home')} />

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => { setActiveTab('add-money'); setCustomDate(getDateKey(new Date())); setActiveFormType('income'); }}
                className="hover-lift group relative overflow-hidden rounded-3xl border-2 border-green-300 dark:border-green-800/60 bg-gradient-to-br from-green-50 to-white dark:from-[#0a1f12] dark:to-[#121c15] p-6 text-left shadow-md"
              >
                <div className="absolute right-4 top-4 opacity-10 transition group-hover:scale-125 group-hover:opacity-20">
                  <ArrowDownLeft size={80} className="text-green-600" />
                </div>
                <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Income</span>
                <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">Add Money</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Salary, stipend, family support</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                  Continue <ChevronRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </button>

              <button
                onClick={() => { setActiveTab('add-expense'); setCustomDate(getDateKey(new Date())); setActiveFormType('expense'); }}
                className="hover-lift group relative overflow-hidden rounded-3xl border-2 border-gray-300 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-[#131714] dark:to-[#121c15] p-6 text-left shadow-md"
              >
                <div className="absolute right-4 top-4 opacity-10 transition group-hover:scale-125 group-hover:opacity-20">
                  <ArrowUpRight size={80} className="text-gray-900 dark:text-gray-100" />
                </div>
                <span className="rounded-full bg-gray-900 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Expense</span>
                <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">Add Expense</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Food, transport, utilities & more</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Continue <ChevronRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ADD MONEY */}
        {activeTab === 'add-money' && (
          <div className="animate-slide-in rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-6 shadow-lg">
            <SectionHeader title="Add Income" subtitle="Money coming in" onBack={() => setActiveTab('expense-hub')} />
            <form onSubmit={(e) => handleSubmitTransaction(e, 'income')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                <input 
                  type="text"
                  placeholder="e.g. Mom, Salary, Tuition"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'income')}
                  onFocus={() => handleCategoryFocus('income')}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                  required
                />
                {showCategorySuggestions && activeFormType === 'income' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 dark:bg-[#121c15] border border-green-200 dark:border-green-800/60 rounded-xl shadow-lg overflow-hidden">
                    <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">Frequently used</p>
                    {filteredSuggestions.map((s) => (
                      <div key={s} onMouseDown={() => { setCategory(s); setShowCategorySuggestions(false); }} className="p-2.5 text-xs text-gray-900 dark:text-gray-100 hover:bg-green-100 dark:hover:bg-green-950/50 cursor-pointer border-b border-green-100 dark:border-green-900/30 last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={() => handleAmountFocus('income')}
                  onBlur={() => setTimeout(() => setShowAmountSuggestions(false), 150)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl font-medium text-base text-green-600 dark:text-green-400 focus:outline-none"
                  required
                />
                {showAmountSuggestions && activeFormType === 'income' && filteredAmountSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 dark:bg-[#121c15] border border-green-200 dark:border-green-800/60 rounded-xl shadow-lg p-2">
                    <p className="px-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Quick amounts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredAmountSuggestions.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onMouseDown={() => { setAmount(String(amt)); setShowAmountSuggestions(false); }}
                          className="rounded-lg bg-white dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 px-3 py-1.5 text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50 transition"
                        >
                          ৳{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 📅 Custom Date Picker Feature */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Transaction Date</label>
                <input 
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                  required
                />
              </div>

              <button type="submit" className="hover-lift w-full rounded-2xl bg-green-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-500/30 transition hover:bg-green-600">
                Save Income ✓
              </button>
            </form>
          </div>
        )}

        {/* ADD EXPENSE */}
        {activeTab === 'add-expense' && (
          <div className="animate-slide-in rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-6 shadow-lg">
            <SectionHeader title="Add Expense" subtitle="Money going out" onBack={() => setActiveTab('expense-hub')} />
            <form onSubmit={(e) => handleSubmitTransaction(e, 'expense')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Khichuri, Cigarettes, Transport"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'expense')}
                  onFocus={() => handleCategoryFocus('expense')}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-gray-400 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                  required
                />
                {showCategorySuggestions && activeFormType === 'expense' && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 dark:bg-[#121c15] border border-green-200 dark:border-green-800/60 rounded-xl shadow-lg overflow-hidden">
                    <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">Frequently used</p>
                    {filteredSuggestions.map((s) => (
                      <div key={s} onMouseDown={() => { setCategory(s); setShowCategorySuggestions(false); }} className="p-2.5 text-xs text-gray-900 dark:text-gray-100 hover:bg-green-100 dark:hover:bg-green-950/50 cursor-pointer border-b border-green-100 dark:border-green-900/30 last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount Spent (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={() => handleAmountFocus('expense')}
                  onBlur={() => setTimeout(() => setShowAmountSuggestions(false), 150)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-gray-400 p-3 rounded-xl font-medium text-base text-gray-900 dark:text-gray-100 focus:outline-none"
                  required
                />
                {showAmountSuggestions && activeFormType === 'expense' && filteredAmountSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 dark:bg-[#121c15] border border-green-200 dark:border-green-800/60 rounded-xl shadow-lg p-2">
                    <p className="px-1 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Quick amounts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredAmountSuggestions.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onMouseDown={() => { setAmount(String(amt)); setShowAmountSuggestions(false); }}
                          className="rounded-lg bg-white dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 px-3 py-1.5 text-xs font-bold text-gray-900 dark:text-gray-100 hover:bg-green-100 dark:hover:bg-green-950/50 transition"
                        >
                          ৳{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 📅 Custom Date Picker Feature */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Transaction Date</label>
                <input 
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-green-50 dark:bg-[#0a110c] border border-green-200 dark:border-green-800/60 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
                  required
                />
              </div>

              <button type="submit" className="hover-lift w-full rounded-2xl bg-gray-900 dark:bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-gray-800 dark:hover:bg-green-700">
                Save Expense ✓
              </button>
            </form>
          </div>
        )}

        {/* LEDGER HISTORY */}
        {activeTab === 'history' && (
          <div className="animate-tab-enter space-y-4">
            <SectionHeader title="Transaction Timeline" subtitle={`${filteredTransactions.length} records`} onBack={() => setActiveTab('home')} />

            <div className="relative">
              <Search size={16} className="absolute left-4 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search category, amount, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] py-3 pl-11 pr-4 text-sm shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex items-center justify-between px-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Swipe left on any record to Edit or Delete</span>
              <span className="text-green-600 dark:text-green-400 font-medium">← Swipe gesture</span>
            </div>

            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-green-300 dark:border-green-800/60 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No records found
              </div>
            ) : (
              <div className="relative space-y-0 pl-4">
                <div className="timeline-line absolute bottom-4 left-[7px] top-4 w-0.5 rounded-full" />
                {Object.entries(groupedTransactions).map(([dateLabel, dayItems], groupIdx) => {
                  const dayTotal = dayItems.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                  return (
                    <div key={dateLabel} className="animate-fade-up relative pb-6" style={{ animationDelay: `${groupIdx * 0.08}s` }}>
                      <div className="timeline-dot absolute -left-4 top-1 h-3.5 w-3.5 rounded-full bg-green-500" />
                      <div className="ml-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">{dateLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${dayTotal >= 0 ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'}`}>
                            Net ৳{dayTotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dayItems.map((item, i) => (
                            <SwipeToDelete
                              key={item.id}
                              onDelete={() => { setSelectedTransaction(item.id); setShowDeleteModal(true); }}
                              onEdit={() => { setEditingTransaction(item); setShowEditModal(true); }}
                            >
                              <div
                                className="hover-lift flex items-center justify-between rounded-2xl border border-green-100 dark:border-green-800/30 bg-white dark:bg-[#121c15] p-3 shadow-sm"
                                style={{ animationDelay: `${groupIdx * 0.08 + i * 0.04}s` }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${item.type === 'income' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'}`}>
                                    {item.type === 'income' ? '↑' : '↓'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.category}</p>
                                    <p className="text-[10px] text-gray-400">{formatDisplayDate(item.date)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${item.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {item.type === 'income' ? '+' : '−'}৳{item.amount.toLocaleString()}
                                  </span>
                                  {/* Visual hint indicator */}
                                  <ChevronLeft size={14} className="text-gray-300 dark:text-gray-600 group-hover:-translate-x-0.5 transition-transform" />
                                </div>
                              </div>
                            </SwipeToDelete>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TUITION CALENDAR */}
        {activeTab === 'tuition' && (
          <div className="animate-tab-enter space-y-4">
            <SectionHeader title="Tuition Tracker" subtitle="Sessions & transport fares" onBack={() => setActiveTab('home')} />

            <div className="flex gap-2 overflow-x-auto pb-1">
              {tuitionProfiles.map((profile, i) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedTuitionId(profile.id)}
                  className={`shrink-0 animate-fade-up rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    selectedTuitionId === profile.id
                      ? 'scale-105 bg-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] text-gray-500 dark:text-gray-400 hover:border-green-400'
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {profile.name}
                </button>
              ))}
              <button
                onClick={() => setShowAddTuitionModal(true)}
                className="hover-lift flex shrink-0 items-center gap-1 rounded-full border border-dashed border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/30 px-4 py-2 text-xs font-bold text-green-600 dark:text-green-400"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {!activeTuition ? (
              <div className="animate-scale-in rounded-3xl border border-dashed border-green-300 dark:border-green-800/60 bg-green-50/50 dark:bg-green-950/20 p-10 text-center">
                <BookOpen size={40} className="mx-auto mb-3 text-green-400 animate-float-gentle" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No tuition yet — create one to start tracking</p>
                <button onClick={() => setShowAddTuitionModal(true)} className="hover-lift mt-4 rounded-2xl bg-green-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-green-500/30">
                  Add Your First Tuition
                </button>
              </div>
            ) : (
              <>
                {/* Progress ring card */}
                <div className="animate-scale-in flex items-center gap-5 rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-5 shadow-sm relative">
                  {/* Delete tuition profile action */}
                  <button
                    type="button"
                    onClick={() => setShowDeleteTuitionModal(true)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    title="Delete this tuition profile"
                  >
                    <Trash2 size={16} />
                  </button>

                  {(() => {
                    const pct = targetSessions > 0 ? Math.min(sessionsDone / targetSessions, 1) : 0;
                    const r = 44;
                    const circ = 2 * Math.PI * r;
                    const offset = circ * (1 - pct);
                    return (
                      <div className="relative shrink-0">
                        <svg width="100" height="100" className="-rotate-90">
                          <circle cx="50" cy="50" r={r} fill="none" stroke={darkMode ? '#1e3a29' : '#dcfce7'} strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            className="progress-ring"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{sessionsDone}</span>
                          <span className="text-[9px] text-gray-500 dark:text-gray-400">/ {targetSessions}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex-1 pr-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{activeTuition.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sessionsLeft} days remaining this month</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Goal:</span>
                      <input
                        type="number" min="1"
                        defaultValue={activeTuition.targetDays || 1}
                        key={`target-${activeTuition.id}-${activeTuition.targetDays}`}
                        onBlur={(e) => handleUpdateTuitionProfile('targetDays', e.target.value)}
                        className="w-12 rounded-lg border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-[#0a110c] px-2 py-1 text-center text-xs font-bold text-green-600 dark:text-green-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">days/mo</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Fare:</span>
                      <span className="text-[10px] text-gray-400">৳</span>
                      <input
                        type="number" min="0" step="any"
                        defaultValue={activeTuition.defaultFare ?? 0}
                        key={`fare-${activeTuition.id}-${activeTuition.defaultFare}`}
                        onBlur={(e) => handleUpdateTuitionProfile('defaultFare', e.target.value)}
                        className="w-16 rounded-lg border border-green-200 dark:border-green-800/60 bg-green-50 dark:bg-[#0a110c] px-2 py-1 text-xs font-bold text-green-600 dark:text-green-400 focus:outline-none"
                      />
                    </div>
                    {activeTuition.startDate && activeTuition.weeklyDays?.length ? (
                      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Schedule:</span>{' '}
                        {activeTuition.weeklyDays.map((d) => WEEKDAY_SHORT[d]).join(', ')} from {formatDisplayDate(activeTuition.startDate)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* View toggle + Calendar */}
                <div className="animate-fade-up stagger-2 rounded-3xl border border-green-200 dark:border-green-800/40 bg-white dark:bg-[#121c15] p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex rounded-xl bg-green-50 dark:bg-green-950/30 p-0.5 border border-green-200 dark:border-green-800/40">
                      <button
                        type="button"
                        onClick={() => setTuitionViewMode('week')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
                          tuitionViewMode === 'week' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        Weekly
                      </button>
                      <button
                        type="button"
                        onClick={() => setTuitionViewMode('month')}
                        className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
                          tuitionViewMode === 'month' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          if (tuitionViewMode === 'week') d.setDate(d.getDate() - 7);
                          else d.setMonth(d.getMonth() - 1);
                          setCalendarDate(d);
                        }}
                        className="rounded-xl p-2 transition hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 text-gray-600 dark:text-gray-300"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => {
                          const d = new Date(calendarDate);
                          if (tuitionViewMode === 'week') d.setDate(d.getDate() + 7);
                          else d.setMonth(d.getMonth() + 1);
                          setCalendarDate(d);
                        }}
                        className="rounded-xl p-2 transition hover:scale-110 hover:bg-green-50 dark:hover:bg-green-950/40 text-gray-600 dark:text-gray-300"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {tuitionViewMode === 'week' ? (
                    <>
                      <h3 className="mb-3 text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                        {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </h3>
                      <div className="grid grid-cols-7 gap-1.5">
                        {weekDates.map((targetDate) => {
                          const dateStr = getDateKey(targetDate);
                          const isLogged = activeProfileSessions.some((s) => getDateKey(s.date) === dateStr);
                          const isScheduled = activeTuition ? isScheduledTuitionDay(targetDate, activeTuition) : false;
                          const isToday = dateStr === getDateKey(new Date());
                          const session = activeProfileSessions.find((s) => getDateKey(s.date) === dateStr);
                          return (
                            <button
                              key={dateStr}
                              onClick={() => handleDayClick(targetDate)}
                              className={`cal-day flex flex-col items-center justify-center rounded-xl py-2 text-xs font-bold min-h-[4.5rem] ${
                                isLogged
                                  ? 'bg-green-500 text-white shadow-md shadow-green-500/40'
                                  : isScheduled
                                    ? 'border-2 border-dashed border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                                    : isToday
                                      ? 'border-2 border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                                      : 'bg-green-50/50 dark:bg-green-950/10 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-950/40'
                              }`}
                            >
                              <span className="text-[9px] text-gray-400 dark:text-gray-500">{WEEKDAY_SHORT[targetDate.getDay()]}</span>
                              <span>{targetDate.getDate()}</span>
                              {session?.transportAmount ? (
                                <span className={`text-[8px] mt-0.5 ${isLogged ? 'text-green-100' : 'text-gray-400'}`}>
                                  ৳{session.transportAmount}
                                  {session.transactionId ? ' ✓' : ''}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="mb-4 text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                        {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                        {WEEKDAY_SHORT.map((day) => (
                          <span key={day} className="text-[10px] font-bold text-gray-400">{day}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const targetDate = new Date(year, month, dayNum);
                          const dateStr = getDateKey(targetDate);
                          const isLogged = activeProfileSessions.some((s) => getDateKey(s.date) === dateStr);
                          const isScheduled = activeTuition ? isScheduledTuitionDay(targetDate, activeTuition) : false;
                          const isToday = dateStr === getDateKey(new Date());
                          const session = activeProfileSessions.find((s) => getDateKey(s.date) === dateStr);
                          return (
                            <button
                              key={dayNum}
                              onClick={() => handleDayClick(targetDate)}
                              className={`cal-day flex h-10 flex-col items-center justify-center rounded-xl text-xs font-bold ${
                                isLogged
                                  ? 'bg-green-500 text-white shadow-md shadow-green-500/40'
                                  : isScheduled
                                    ? 'border-2 border-dashed border-green-400 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                                    : isToday
                                      ? 'border-2 border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
                                      : 'bg-green-50/50 dark:bg-green-950/10 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-950/40'
                              }`}
                            >
                              {dayNum}
                              {session?.transportAmount && isLogged ? (
                                <span className="text-[7px] text-green-100 leading-none">
                                  {session.transactionId ? '✓' : '·'}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500" /> Attended</span>
                    <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-dashed border-green-400" /> Scheduled</span>
                    <span className="flex items-center gap-1">✓ Deducted from ledger</span>
                  </div>

                  <p className="mt-3 text-[10px] text-gray-400 text-center">
                    Tap any day to log or edit a session — including past dates you missed
                  </p>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* --- UNDO TOAST NOTIFICATION --- */}
      {undoToastVisible && deletedTxBackup && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-3 rounded-2xl bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 shadow-2xl animate-fade-up w-[calc(100%-2rem)] max-w-sm">
          <span className="text-xs truncate">Deleted "{deletedTxBackup.category}"</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="flex items-center gap-1 rounded-lg bg-green-500 hover:bg-green-400 text-white px-3 py-1 text-xs font-bold transition shrink-0"
          >
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      )}

      {/* --- BOTTOM DOCK NAVIGATION --- */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBudget={() => setShowBudgetModal(true)}
      />

      </div>
    </div>
  );
}