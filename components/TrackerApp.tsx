'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Home, PlusCircle, BookOpen, ArrowUpRight, ArrowDownLeft, 
  Calendar as CalendarIcon, Clock, CheckCircle2, 
  ChevronLeft, ChevronRight, Search, X, Trash2, 
  Wallet, Target, Download, Sparkles, TrendingUp, TrendingDown,
  PieChart, BarChart3, AlertCircle, RefreshCw, Settings, LogOut, Plus
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, addDoc, query, deleteDoc, doc, 
  updateDoc, where, onSnapshot 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';
import NicknameModal from './NicknameModal';
import SettingsModal from './SettingsModal';
import AnimatedNumber from './AnimatedNumber';
import BottomNav from './BottomNav';
import SectionHeader from './SectionHeader';

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

// --- MODAL COMPONENTS ---
function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-green-200 shadow-2xl shadow-green-900/10 p-5 text-gray-900 animate-scale-in">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-green-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FareModal({ isOpen, onClose, onConfirm, date, defaultFare }) {
  const [fare, setFare] = useState(defaultFare);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(parseFloat(fare) || 0);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Transport Fare - ${date.toLocaleDateString()}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-500">Enter round-trip transport fare for this session:</p>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <span className="text-sm font-medium text-gray-500">৳</span>
          <input
            type="number"
            step="any"
            value={fare}
            onChange={(e) => setFare(e.target.value)}
            className="flex-1 bg-transparent font-medium text-base text-green-600 focus:outline-none"
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-green-100 rounded-lg text-xs font-medium text-green-600 transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-xs font-medium transition-colors">
            Confirm
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Item">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">Are you sure you want to delete this item? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 hover:bg-green-100 rounded-lg text-xs font-medium text-green-600 transition-colors">
            Cancel
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors">
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BudgetModal({ isOpen, onClose, categories, budgets, onSave }) {
  const [budgetData, setBudgetData] = useState(budgets);

  const handleSave = () => {
    onSave(budgetData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Budget Limits">
      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {categories.filter(c => c.type === 'expense').map(cat => (
          <div key={cat.name} className="flex items-center gap-3 bg-green-50 p-3 rounded-xl">
            <span className="text-xs flex-1 text-gray-900">{cat.name}</span>
            <div className="flex items-center gap-1 bg-white border border-green-200 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-gray-500">৳</span>
              <input
                type="number"
                value={budgetData[cat.name] || 0}
                onChange={(e) => setBudgetData({ ...budgetData, [cat.name]: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-transparent text-xs font-medium text-green-600 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>
        ))}
        <button 
          onClick={handleSave}
          className="w-full bg-green-500 hover:bg-green-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm mt-2"
        >
          Save Budgets
        </button>
      </div>
    </Modal>
  );
}

function AddTuitionModal({ isOpen, onClose, onConfirm }) {
  const [name, setName] = useState('');
  const [targetDays, setTargetDays] = useState('8');
  const [defaultFare, setDefaultFare] = useState('100');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(name, targetDays, defaultFare);
    setName('');
    setTargetDays('8');
    setDefaultFare('100');
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Tuition">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tuition Name</label>
          <input
            type="text"
            placeholder="e.g. Math, Physics, Student A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-green-50 border border-green-200 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Day Goal</label>
          <input
            type="number"
            min="1"
            value={targetDays}
            onChange={(e) => setTargetDays(e.target.value)}
            className="w-full bg-green-50 border border-green-200 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Transport Fare / Trip (৳)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={defaultFare}
            onChange={(e) => setDefaultFare(e.target.value)}
            className="w-full bg-green-50 border border-green-200 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 focus:outline-none"
            required
          />
        </div>
        <button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
          Add Tuition
        </button>
      </form>
    </Modal>
  );
}

// --- MAIN COMPONENT ---
export default function TrackerApp() {
  const { user, nickname, loading: authLoading, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [tuitionSessions, setTuitionSessions] = useState([]);
  const [tuitionProfiles, setTuitionProfiles] = useState([]);
  const [selectedTuitionId, setSelectedTuitionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [incomeCategories, setIncomeCategories] = useState(SMART_AI_INCOMES);
  const [expenseCategories, setExpenseCategories] = useState(SMART_AI_EXPENSES);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [budgetLimits, setBudgetLimits] = useState({});

  const [showFareModal, setShowFareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAddTuitionModal, setShowAddTuitionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const getDateKey = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
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
    setFilteredSuggestions([]);
    setBudgetLimits({});
    setSearchQuery('');
    setSelectedDate(null);
    setSelectedTransaction(null);
    setShowFareModal(false);
    setShowDeleteModal(false);
    setShowBudgetModal(false);
    setShowAddTuitionModal(false);
    setShowAnalytics(false);
    setShowSettings(false);
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    clearUserData();
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const applyTransactions = useCallback((txList) => {
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

  useEffect(() => {
    if (!user) {
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

    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        try {
          const txList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
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
        try {
          const tuitionList = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
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
        try {
          const profiles = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          setTuitionProfiles(profiles);
        } catch (error) {
          console.error('Error processing tuition profiles snapshot:', error);
        }
      },
      (error) => {
        console.error('Error listening to tuition profiles:', error);
      }
    );

    return () => {
      unsubscribeTx();
      unsubscribeTuition();
      unsubscribeTuitionProfiles();
    };
  }, [user, clearUserData, applyTransactions]);

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

  const getProfileSessions = useCallback((profileId) => {
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

  const handleCategoryChange = (val, type) => {
    setCategory(val);
    const pool = type === 'income' ? incomeCategories : expenseCategories;
    if (val.trim() === '') {
      setFilteredSuggestions([]);
    } else {
      setFilteredSuggestions(pool.filter(item => item.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
    }
  };

  const handleSubmitTransaction = async (e, type) => {
    e.preventDefault();
    if (!user || !amount || isNaN(amount) || !category.trim()) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        amount: parseFloat(amount),
        type,
        category: category.trim(),
        date: getDateKey(new Date()),
        timestamp: new Date().toISOString(),
        userId: user.uid,
      });
      
      setAmount('');
      setCategory('');
      setFilteredSuggestions([]);
      setActiveTab('home');
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, 'transactions', id));
      setShowDeleteModal(false);
      setSelectedTransaction(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleDayClick = (dateObj) => {
    if (!selectedTuitionId) return;
    setSelectedDate(dateObj);
    setShowFareModal(true);
  };

  const handleAddTuition = async (name, targetDays, defaultFare) => {
    if (!user) return;

    try {
      const profileRef = await addDoc(collection(db, 'tuitionProfiles'), {
        name: name.trim(),
        targetDays: Math.max(1, parseInt(targetDays, 10) || 1),
        defaultFare: parseFloat(defaultFare) || 0,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setSelectedTuitionId(profileRef.id);
      setShowAddTuitionModal(false);
    } catch (error) {
      console.error('Error adding tuition profile:', error);
    }
  };

  const handleUpdateTuitionProfile = async (field, value) => {
    if (!user || !selectedTuitionId) return;

    try {
      const payload = {};
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

  const handleFareConfirm = async (fareAmount) => {
    if (!user || !selectedDate || !selectedTuitionId || !activeTuition) return;
    const dateKey = getDateKey(selectedDate);
    const existingSession = activeProfileSessions.find((s) => getDateKey(s.date) === dateKey);

    try {
      if (existingSession) {
        await deleteDoc(doc(db, 'tuition', existingSession.id));
        if (existingSession.transactionId) {
          await deleteDoc(doc(db, 'transactions', existingSession.transactionId));
        }
      } else {
        const sessionRef = await addDoc(collection(db, 'tuition'), { 
          date: dateKey,
          createdAt: new Date().toISOString(),
          userId: user.uid,
          tuitionProfileId: selectedTuitionId,
        });

        if (fareAmount > 0) {
          const transportRef = await addDoc(collection(db, 'transactions'), {
            amount: fareAmount,
            type: 'expense',
            category: `${activeTuition.name} Transport - ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            date: dateKey,
            timestamp: new Date().toISOString(),
            tuitionSessionId: sessionRef.id,
            tuitionProfileId: selectedTuitionId,
            userId: user.uid,
          });

          await updateDoc(sessionRef, { transactionId: transportRef.id });
        }
      }

      setShowFareModal(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error updating tuition date:', error);
    }
  };

  const exportData = () => {
    if (transactions.length === 0) return;
    const csvContent = [
      ['Date', 'Category', 'Type', 'Amount'],
      ...transactions.map(t => [t.date, t.category, t.type, t.amount])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
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

  const calculateStreak = useCallback((sessions) => {
    const sortedDates = [...new Set(sessions.map((s) => s.date))].sort();
    if (sortedDates.length === 0) return { streak: 0, active: false };

    let streak = 0;
    let checkDate = new Date();
    const todayStr = getDateKey(checkDate);
    const hasToday = sortedDates.includes(todayStr);
    
    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (!sortedDates.includes(getDateKey(checkDate))) return { streak: 0, active: false };
    }
    
    let currentCheck = new Date();
    streak = hasToday ? 1 : 0;
    currentCheck.setDate(currentCheck.getDate() - (hasToday ? 1 : 1));
    
    while (sortedDates.includes(getDateKey(currentCheck))) {
      streak++;
      currentCheck.setDate(currentCheck.getDate() - 1);
    }
    return { streak, active: hasToday || streak > 0 };
  }, []);

  const homeTuition = activeTuition || tuitionProfiles[0] || null;
  const homeTuitionSessions = getProfileSessions(homeTuition?.id);
  const streakInfo = calculateStreak(homeTuitionSessions);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (searchQuery) {
      filtered = filtered.filter(t => t.category.toLowerCase().includes(searchQuery.toLowerCase()) || t.amount.toString().includes(searchQuery));
    }
    return filtered;
  }, [transactions, searchQuery]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, transaction) => {
      const dateKey = new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(transaction);
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

  // Budget tracking
  const getBudgetStatus = (category) => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === category)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const budget = budgetLimits[category] || Infinity;
    return { spent, budget, percentage: budget > 0 ? (spent / budget) * 100 : 0 };
  };

  // Monthly trend data
  const getMonthlyTrend = useMemo(() => {
    const months = {};
    transactions.forEach(t => {
      const month = t.date.slice(0, 7);
      if (!months[month]) months[month] = { income: 0, expense: 0 };
      if (t.type === 'income') months[month].income += t.amount;
      else months[month].expense += t.amount;
    });
    return Object.entries(months).slice(-6);
  }, [transactions]);

  if (!mounted || authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f8fdf9] flex items-center justify-center" suppressHydrationWarning>
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginModal />;
  if (!nickname) return <NicknameModal />;

  const initials = nickname.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fdf9] text-gray-900 flex flex-col font-sans pb-28" suppressHydrationWarning>
      
      {/* --- MODALS --- */}
      <FareModal
        key={selectedTuitionId || 'no-tuition'}
        isOpen={showFareModal}
        onClose={() => { setShowFareModal(false); setSelectedDate(null); }}
        onConfirm={handleFareConfirm}
        date={selectedDate || new Date()}
        defaultFare={String(activeTuition?.defaultFare ?? 100)}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedTransaction(null); }}
        onConfirm={() => selectedTransaction && handleDeleteTransaction(selectedTransaction)}
      />

      <BudgetModal
        isOpen={showBudgetModal}
        onClose={() => setShowBudgetModal(false)}
        categories={[...incomeCategories, ...expenseCategories].map(c => ({ name: c, type: expenseCategories.includes(c) ? 'expense' : 'income' }))}
        budgets={budgetLimits}
        onSave={setBudgetLimits}
      />

      <AddTuitionModal
        isOpen={showAddTuitionModal}
        onClose={() => setShowAddTuitionModal(false)}
        onConfirm={handleAddTuition}
      />

      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-xs" onClick={() => setShowSettings(false)} />
          <div className="relative z-10">
            <SettingsModal onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 mx-auto w-full max-w-md animate-fade-up">
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-green-200/80 glass-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/30 animate-float-gentle">
              <Wallet size={20} />
            </div>
            <div>
              <span className="text-sm font-bold text-gray-900">Hi, {nickname} 👋</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={exportData} className="rounded-xl p-2 text-gray-500 transition-all hover:scale-110 hover:bg-green-50 hover:text-green-600" title="Export CSV">
              <Download size={18} />
            </button>
            <button onClick={() => setShowBudgetModal(true)} className="rounded-xl p-2 text-gray-500 transition-all hover:scale-110 hover:bg-green-50 hover:text-green-600" title="Set Budgets">
              <Target size={18} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shadow-md shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-700"
              title={`${nickname} — Account Settings`}
            >
              {initials}
            </button>
            <button onClick={handleLogout} className="rounded-xl p-2 text-gray-500 transition-all hover:scale-110 hover:bg-green-50" title="Log Out">
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
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-green-100 transition hover:text-white"
                >
                  <PieChart size={14} className={showAnalytics ? 'rotate-180 transition-transform duration-500' : 'transition-transform duration-500'} />
                  {showAnalytics ? 'Hide trends' : 'Show trends'}
                </button>
              </div>
            </div>

            {/* Stat pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide animate-fade-up stagger-2">
              <div className="shrink-0 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500">Today</span>
                <p className={`text-lg font-bold ${todayNet >= 0 ? 'text-green-600' : 'text-gray-900'}`}>৳{todayNet.toLocaleString()}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500">Month</span>
                <p className={`text-lg font-bold ${monthBalance >= 0 ? 'text-green-600' : 'text-gray-900'}`}>৳{monthBalance.toLocaleString()}</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500">🔥 Streak</span>
                <p className="text-lg font-bold text-green-700">{streakInfo.streak} days</p>
              </div>
              <div className="shrink-0 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm hover-lift">
                <span className="text-[10px] font-medium uppercase text-gray-500">Tuition</span>
                <p className="text-lg font-bold text-green-600">
                  {homeTuition ? `${homeSessionsDone}/${homeTargetSessions}` : '—'}
                </p>
              </div>
            </div>

            {/* Budget alerts */}
            {Object.entries(budgetLimits).map(([cat, limit]) => {
              const status = getBudgetStatus(cat);
              if (status.percentage > 80 && status.budget > 0) {
                return (
                  <div key={cat} className="animate-fade-up flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <AlertCircle size={14} className="shrink-0 text-gray-900" />
                    <span className="text-[10px] text-gray-700">{cat}: {status.percentage.toFixed(0)}% of budget</span>
                  </div>
                );
              }
              return null;
            })}

            {/* Analytics */}
            {showAnalytics && (
              <div className="animate-scale-in rounded-3xl border border-green-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">6-Month Trend</h3>
                <div className="space-y-3">
                  {getMonthlyTrend.map(([month, data], i) => (
                    <div key={month} className="animate-fade-up flex items-center gap-3" style={{ animationDelay: `${i * 0.06}s` }}>
                      <span className="w-14 text-[10px] font-medium text-gray-500">{month}</span>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-green-50">
                        <div className="h-full rounded-full bg-green-500 transition-all duration-1000" style={{ width: `${(data.income / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense), 1)) * 100}%` }} />
                        <div className="h-full rounded-full bg-gray-900 transition-all duration-1000" style={{ width: `${(data.expense / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense), 1)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bento action grid */}
            <div className="grid grid-cols-2 gap-3 animate-fade-up stagger-3">
              <button onClick={() => setActiveTab('expense-hub')} className="hover-lift col-span-2 flex items-center gap-4 rounded-3xl border border-green-200 bg-white p-4 text-left shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/30">
                  <PlusCircle size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">Log & Track</h3>
                  <p className="text-[11px] text-gray-500">Income & expenses</p>
                </div>
                <ChevronRight size={20} className="text-green-500" />
              </button>
              <button onClick={() => setActiveTab('history')} className="hover-lift rounded-3xl border border-green-200 bg-white p-4 text-left shadow-sm">
                <Clock size={22} className="mb-2 text-green-600" />
                <h3 className="text-sm font-bold text-gray-900">Ledger</h3>
                <p className="text-[10px] text-gray-500">History</p>
              </button>
              <button onClick={() => setActiveTab('tuition')} className="hover-lift rounded-3xl border border-green-200 bg-white p-4 text-left shadow-sm">
                <BookOpen size={22} className="mb-2 text-green-600" />
                <h3 className="text-sm font-bold text-gray-900">Tuition</h3>
                <p className="text-[10px] text-gray-500">Calendar</p>
              </button>
              <button onClick={() => { setActiveTab('add-money'); setAmount(''); setCategory(''); }} className="hover-lift rounded-2xl bg-green-500 py-3 text-xs font-bold text-white shadow-md shadow-green-500/25">
                + Income
              </button>
              <button onClick={() => { setActiveTab('add-expense'); setAmount(''); setCategory(''); }} className="hover-lift rounded-2xl bg-gray-900 py-3 text-xs font-bold text-white shadow-md">
                − Expense
              </button>
            </div>

            {/* Recent — horizontal scroll */}
            <div className="animate-fade-up stagger-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recent</span>
                <button onClick={() => setActiveTab('history')} className="text-xs font-medium text-green-600 hover:underline">See all</button>
              </div>
              {transactions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-green-300 bg-green-50/50 py-8 text-center text-xs text-gray-500">
                  No transactions yet — add your first one!
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {transactions.slice(0, 6).map((t, i) => (
                    <div
                      key={t.id}
                      className="hover-lift shrink-0 w-36 animate-fade-up rounded-2xl border border-green-200 bg-white p-3 shadow-sm"
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      <div className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {t.type}
                      </div>
                      <p className="truncate text-xs font-semibold text-gray-900">{t.category}</p>
                      <p className={`mt-1 text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                        {t.type === 'income' ? '+' : '−'}৳{t.amount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-[9px] text-gray-400">{t.date}</p>
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
                onClick={() => setActiveTab('add-money')}
                className="hover-lift group relative overflow-hidden rounded-3xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-white p-6 text-left shadow-md"
              >
                <div className="absolute right-4 top-4 opacity-10 transition group-hover:scale-125 group-hover:opacity-20">
                  <ArrowDownLeft size={80} className="text-green-600" />
                </div>
                <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Income</span>
                <h3 className="mt-3 text-2xl font-bold text-gray-900">Add Money</h3>
                <p className="mt-1 text-sm text-gray-500">Salary, stipend, family support</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-green-600">
                  Continue <ChevronRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </button>

              <button
                onClick={() => setActiveTab('add-expense')}
                className="hover-lift group relative overflow-hidden rounded-3xl border-2 border-gray-300 bg-gradient-to-br from-gray-50 to-white p-6 text-left shadow-md"
              >
                <div className="absolute right-4 top-4 opacity-10 transition group-hover:scale-125 group-hover:opacity-20">
                  <ArrowUpRight size={80} className="text-gray-900" />
                </div>
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Expense</span>
                <h3 className="mt-3 text-2xl font-bold text-gray-900">Add Expense</h3>
                <p className="mt-1 text-sm text-gray-500">Food, transport, utilities & more</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                  Continue <ChevronRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ADD MONEY */}
        {activeTab === 'add-money' && (
          <div className="animate-slide-in rounded-3xl border border-green-200 bg-white p-6 shadow-lg">
            <SectionHeader title="Add Income" subtitle="Money coming in" onBack={() => setActiveTab('expense-hub')} />
            <form onSubmit={(e) => handleSubmitTransaction(e, 'income')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <input 
                  type="text"
                  placeholder="e.g. Mom, Salary, Tuition"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'income')}
                  className="w-full bg-green-50 border border-green-200 focus:border-green-500 p-3 rounded-xl text-sm text-gray-900 focus:outline-none"
                  required
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 border border-green-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredSuggestions.map((s, idx) => (
                      <div key={idx} onClick={() => { setCategory(s); setFilteredSuggestions([]); }} className="p-2.5 text-xs text-gray-900 hover:bg-green-100 cursor-pointer border-b border-green-100 last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-green-50 border border-green-200 focus:border-green-500 p-3 rounded-xl font-medium text-base text-green-600 focus:outline-none"
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
          <div className="animate-slide-in rounded-3xl border border-green-200 bg-white p-6 shadow-lg">
            <SectionHeader title="Add Expense" subtitle="Money going out" onBack={() => setActiveTab('expense-hub')} />
            <form onSubmit={(e) => handleSubmitTransaction(e, 'expense')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1">Category Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Khichuri, Cigarettes, Transport"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'expense')}
                  className="w-full bg-green-50 border border-green-200 focus:border-gray-400 p-3 rounded-xl text-sm text-gray-900 focus:outline-none"
                  required
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-green-50 border border-green-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredSuggestions.map((s, idx) => (
                      <div key={idx} onClick={() => { setCategory(s); setFilteredSuggestions([]); }} className="p-2.5 text-xs text-gray-900 hover:bg-green-100 cursor-pointer border-b border-green-100 last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount Spent (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-green-50 border border-green-200 focus:border-gray-400 p-3 rounded-xl font-medium text-base text-gray-900 focus:outline-none"
                  required
                />
              </div>

              <button type="submit" className="hover-lift w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-gray-800">
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
                placeholder="Search category or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-green-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-green-300 py-12 text-center text-sm text-gray-500">
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
                          <span className="text-xs font-bold text-green-600">{dateLabel}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${dayTotal >= 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-800'}`}>
                            Net ৳{dayTotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dayItems.map((item, i) => (
                            <div
                              key={item.id}
                              className="hover-lift group flex items-center justify-between rounded-2xl border border-green-100 bg-white p-3 shadow-sm"
                              style={{ animationDelay: `${groupIdx * 0.08 + i * 0.04}s` }}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${item.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-800'}`}>
                                  {item.type === 'income' ? '↑' : '↓'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{item.category}</p>
                                  <p className="text-[10px] text-gray-400">{item.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${item.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                                  {item.type === 'income' ? '+' : '−'}৳{item.amount.toLocaleString()}
                                </span>
                                <button onClick={() => { setSelectedTransaction(item.id); setShowDeleteModal(true); }} className="rounded-lg p-1 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-gray-900">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
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
                      : 'border border-green-200 bg-white text-gray-500 hover:border-green-400'
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {profile.name}
                </button>
              ))}
              <button
                onClick={() => setShowAddTuitionModal(true)}
                className="hover-lift flex shrink-0 items-center gap-1 rounded-full border border-dashed border-green-400 bg-green-50 px-4 py-2 text-xs font-bold text-green-600"
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {!activeTuition ? (
              <div className="animate-scale-in rounded-3xl border border-dashed border-green-300 bg-green-50/50 p-10 text-center">
                <BookOpen size={40} className="mx-auto mb-3 text-green-400 animate-float-gentle" />
                <p className="text-sm text-gray-500">No tuition yet — create one to start tracking</p>
                <button onClick={() => setShowAddTuitionModal(true)} className="hover-lift mt-4 rounded-2xl bg-green-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-green-500/30">
                  Add Your First Tuition
                </button>
              </div>
            ) : (
              <>
                {/* Progress ring card */}
                <div className="animate-scale-in flex items-center gap-5 rounded-3xl border border-green-200 bg-white p-5 shadow-sm">
                  {(() => {
                    const pct = targetSessions > 0 ? Math.min(sessionsDone / targetSessions, 1) : 0;
                    const r = 44;
                    const circ = 2 * Math.PI * r;
                    const offset = circ * (1 - pct);
                    return (
                      <div className="relative shrink-0">
                        <svg width="100" height="100" className="-rotate-90">
                          <circle cx="50" cy="50" r={r} fill="none" stroke="#dcfce7" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            className="progress-ring"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-gray-900">{sessionsDone}</span>
                          <span className="text-[9px] text-gray-500">/ {targetSessions}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{activeTuition.name}</h3>
                    <p className="text-xs text-gray-500">{sessionsLeft} days remaining this month</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500">Goal:</span>
                      <input
                        type="number" min="1"
                        defaultValue={activeTuition.targetDays || 1}
                        key={`target-${activeTuition.id}-${activeTuition.targetDays}`}
                        onBlur={(e) => handleUpdateTuitionProfile('targetDays', e.target.value)}
                        className="w-12 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-center text-xs font-bold text-green-600 focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500">days/mo</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500">Fare:</span>
                      <span className="text-[10px] text-gray-400">৳</span>
                      <input
                        type="number" min="0" step="any"
                        defaultValue={activeTuition.defaultFare ?? 0}
                        key={`fare-${activeTuition.id}-${activeTuition.defaultFare}`}
                        onBlur={(e) => handleUpdateTuitionProfile('defaultFare', e.target.value)}
                        className="w-16 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-xs font-bold text-green-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Calendar */}
                <div className="animate-fade-up stagger-2 rounded-3xl border border-green-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))} className="rounded-xl p-2 transition hover:scale-110 hover:bg-green-50">
                      <ChevronLeft size={18} className="text-gray-500" />
                    </button>
                    <h3 className="text-sm font-bold text-gray-900">
                      {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))} className="rounded-xl p-2 transition hover:scale-110 hover:bg-green-50">
                      <ChevronRight size={18} className="text-gray-500" />
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <span key={day} className="text-[10px] font-bold text-gray-400">{day}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const targetDate = new Date(year, month, dayNum);
                      const dateStr = getDateKey(targetDate);
                      const isLogged = activeProfileSessions.some(s => getDateKey(s.date) === dateStr);
                      const isToday = dateStr === getDateKey(new Date());
                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDayClick(targetDate)}
                          className={`cal-day flex h-10 flex-col items-center justify-center rounded-xl text-xs font-bold ${
                            isLogged
                              ? 'bg-green-500 text-white shadow-md shadow-green-500/40'
                              : isToday
                                ? 'border-2 border-green-500 bg-green-50 text-green-700'
                                : 'bg-green-50/50 text-gray-700 hover:bg-green-100'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBudget={() => setShowBudgetModal(true)}
      />

    </div>
  );
}