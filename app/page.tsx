'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Home, PlusCircle, BookOpen, ArrowUpRight, ArrowDownLeft, 
  Calendar as CalendarIcon, Clock, CheckCircle2, 
  ChevronLeft, ChevronRight, Search, X, Trash2, 
  Wallet, Target, Download, Sparkles, TrendingUp, TrendingDown,
  PieChart, BarChart3, AlertCircle, RefreshCw, Settings
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, 
  updateDoc 
} from 'firebase/firestore';

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#202124] rounded-2xl border border-[#5f6368] shadow-2xl p-5 text-[#e8eaed]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-medium">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-[#3c4043] rounded-full transition-colors">
            <X size={18} className="text-[#9aa0a6]" />
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
        <p className="text-xs text-[#9aa0a6]">Enter round-trip transport fare for this session:</p>
        <div className="flex items-center gap-2 bg-[#303134] border border-[#5f6368] rounded-xl px-3 py-2">
          <span className="text-sm font-medium text-[#9aa0a6]">৳</span>
          <input
            type="number"
            step="any"
            value={fare}
            onChange={(e) => setFare(e.target.value)}
            className="flex-1 bg-transparent font-medium text-base text-[#8ab4f8] focus:outline-none"
            autoFocus
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 hover:bg-[#3c4043] rounded-lg text-xs font-medium text-[#8ab4f8] transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] rounded-lg text-xs font-medium transition-colors">
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
        <p className="text-xs text-[#9aa0a6]">Are you sure you want to delete this item? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 hover:bg-[#3c4043] rounded-lg text-xs font-medium text-[#8ab4f8] transition-colors">
            Cancel
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-[#f28b82] hover:bg-[#f6aea9] text-[#202124] rounded-lg text-xs font-medium transition-colors">
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
          <div key={cat.name} className="flex items-center gap-3 bg-[#303134] p-3 rounded-xl">
            <span className="text-xs flex-1 text-[#e8eaed]">{cat.name}</span>
            <div className="flex items-center gap-1 bg-[#202124] border border-[#5f6368] px-2 py-1 rounded-lg">
              <span className="text-[10px] text-[#9aa0a6]">৳</span>
              <input
                type="number"
                value={budgetData[cat.name] || 0}
                onChange={(e) => setBudgetData({ ...budgetData, [cat.name]: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-transparent text-xs font-medium text-[#8ab4f8] focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>
        ))}
        <button 
          onClick={handleSave}
          className="w-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-medium py-2.5 rounded-xl transition-colors text-sm mt-2"
        >
          Save Budgets
        </button>
      </div>
    </Modal>
  );
}

// --- MAIN COMPONENT ---
export default function TrackerApp() {
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [tuitionSessions, setTuitionSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [incomeCategories, setIncomeCategories] = useState(SMART_AI_INCOMES);
  const [expenseCategories, setExpenseCategories] = useState(SMART_AI_EXPENSES);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [defaultFare, setDefaultFare] = useState('100');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [budgetLimits, setBudgetLimits] = useState({});

  const [showFareModal, setShowFareModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const getDateKey = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const fetchData = useCallback(async () => {
    try {
      const txQuery = query(collection(db, 'transactions'), orderBy('date', 'desc'));
      const txSnapshot = await getDocs(txQuery);
      const txList = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txList);

      const tuitionQuery = query(collection(db, 'tuition'), orderBy('date', 'desc'));
      const tuitionSnapshot = await getDocs(tuitionQuery);
      const tuitionList = tuitionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTuitionSessions(tuitionList);

      const customIncomes = new Set(SMART_AI_INCOMES);
      const customExpenses = new Set(SMART_AI_EXPENSES);

      txList.forEach(t => {
        if (t.type === 'income') customIncomes.add(t.category);
        if (t.type === 'expense') customExpenses.add(t.category);
      });

      setIncomeCategories(Array.from(customIncomes));
      setExpenseCategories(Array.from(customExpenses));
    } catch (error) {
      console.error("Error fetching data: ", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (!amount || isNaN(amount) || !category.trim()) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        amount: parseFloat(amount),
        type,
        category: category.trim(),
        date: getDateKey(new Date()),
        timestamp: new Date().toISOString()
      });
      
      setAmount('');
      setCategory('');
      setFilteredSuggestions([]);
      setActiveTab('home');
      fetchData();
    } catch (error) {
      console.error("Error saving transaction: ", error);
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      fetchData();
      setShowDeleteModal(false);
      setSelectedTransaction(null);
    } catch (error) {
      console.error("Error deleting transaction: ", error);
    }
  };

  const handleDayClick = (dateObj) => {
    setSelectedDate(dateObj);
    setShowFareModal(true);
  };

  const handleFareConfirm = async (fareAmount) => {
    if (!selectedDate) return;
    const dateKey = getDateKey(selectedDate);
    const existingSession = tuitionSessions.find(s => getDateKey(s.date) === dateKey);

    try {
      if (existingSession) {
        await deleteDoc(doc(db, 'tuition', existingSession.id));
        if (existingSession.transactionId) {
          await deleteDoc(doc(db, 'transactions', existingSession.transactionId));
        }
      } else {
        const sessionRef = await addDoc(collection(db, 'tuition'), { 
          date: dateKey,
          createdAt: new Date().toISOString()
        });

        if (fareAmount > 0) {
          const transportRef = await addDoc(collection(db, 'transactions'), {
            amount: fareAmount,
            type: 'expense',
            category: `Tuition Transport - ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
            date: dateKey,
            timestamp: new Date().toISOString(),
            tuitionSessionId: sessionRef.id
          });

          await updateDoc(sessionRef, { transactionId: transportRef.id });
        }
      }

      setShowFareModal(false);
      setSelectedDate(null);
      fetchData();
    } catch (error) {
      console.error("Error updating tuition date: ", error);
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

  const calculateStreak = useCallback(() => {
    const sortedDates = [...new Set(tuitionSessions.map(s => s.date))].sort();
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
  }, [tuitionSessions]);

  const streakInfo = calculateStreak();

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

  const currentMonthSessions = tuitionSessions.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const sessionsDone = currentMonthSessions.length;
  const targetSessions = 16;
  const sessionsLeft = Math.max(0, targetSessions - sessionsDone);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#202124] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#202124] text-[#e8eaed] flex flex-col font-sans pb-24">
      
      {/* --- MODALS --- */}
      <FareModal
        isOpen={showFareModal}
        onClose={() => { setShowFareModal(false); setSelectedDate(null); }}
        onConfirm={handleFareConfirm}
        date={selectedDate || new Date()}
        defaultFare={defaultFare}
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

      {/* --- HEADER --- */}
      <header className="px-4 py-3 max-w-md mx-auto w-full flex justify-between items-center bg-[#202124] border-b border-[#5f6368]/40 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8ab4f8]/20 flex items-center justify-center text-[#8ab4f8]">
            <Wallet size={18} />
          </div>
          <span className="font-medium text-base text-[#e8eaed] tracking-wide">KeepNotes & Finance</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={exportData} className="p-2 hover:bg-[#3c4043] rounded-full text-[#9aa0a6] transition-colors" title="Export CSV">
            <Download size={18} />
          </button>
          <button onClick={() => setShowBudgetModal(true)} className="p-2 hover:bg-[#3c4043] rounded-full text-[#9aa0a6] transition-colors" title="Set Budgets">
            <Target size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#5f6368] flex items-center justify-center text-white text-xs font-medium">
            DI
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-3 max-w-md mx-auto w-full space-y-3">
        
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            
            {/* Balance Card */}
            <div className="bg-[#202124] border border-[#5f6368] hover:border-[#8ab4f8]/50 transition-all rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-medium text-[#9aa0a6] uppercase tracking-wider block mb-1">Total Balance</span>
                  <h2 className={`text-3xl font-normal tracking-tight ${currentBalance < 0 ? 'text-[#f28b82]' : 'text-[#e8eaed]'}`}>
                    ৳{currentBalance.toLocaleString()}
                  </h2>
                </div>
                <button onClick={() => setShowAnalytics(!showAnalytics)} className="p-2 hover:bg-[#3c4043] rounded-full transition-colors">
                  <PieChart size={18} className="text-[#9aa0a6]" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#3c4043]">
                <div>
                  <span className="text-[10px] text-[#9aa0a6] block">Income</span>
                  <span className="text-sm font-medium text-[#81c995]">৳{totalIncome.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#9aa0a6] block">Expenses</span>
                  <span className="text-sm font-medium text-[#f28b82]">৳{totalExpense.toLocaleString()}</span>
                </div>
              </div>

              {/* Budget Alerts */}
              {Object.entries(budgetLimits).map(([category, limit]) => {
                const status = getBudgetStatus(category);
                if (status.percentage > 80 && status.budget > 0) {
                  return (
                    <div key={category} className="mt-2 p-2 bg-[#f28b82]/10 border border-[#f28b82]/30 rounded-xl flex items-center gap-2">
                      <AlertCircle size={14} className="text-[#f28b82]" />
                      <span className="text-[10px] text-[#f28b82]">
                        {category}: {status.percentage.toFixed(0)}% of budget used
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Today & Streak */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-3.5 shadow-sm">
                <span className="text-[10px] font-medium text-[#9aa0a6] uppercase tracking-wider block mb-1">Today</span>
                <p className={`text-lg font-medium ${todayNet >= 0 ? 'text-[#81c995]' : 'text-[#f28b82]'}`}>
                  ৳{todayNet.toLocaleString()}
                </p>
                <div className="text-[10px] text-[#9aa0a6] mt-1 flex justify-between">
                  <span>+৳{todayIncome}</span>
                  <span>-৳{todayExpense}</span>
                </div>
              </div>

              <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] font-medium text-[#9aa0a6] uppercase tracking-wider block">Tuition Streak</span>
                <div className="flex items-center gap-2 my-1">
                  <span className="text-xl">🔥</span>
                  <span className="text-lg font-medium text-[#fadd6d]">{streakInfo.streak} Days</span>
                </div>
                <span className="text-[10px] text-[#9aa0a6]">Target: {sessionsDone}/16</span>
              </div>
            </div>

            {/* Analytics Section */}
            {showAnalytics && (
              <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-4 shadow-sm animate-in fade-in duration-200">
                <h3 className="text-xs font-medium text-[#9aa0a6] uppercase tracking-wider mb-3">Monthly Trend</h3>
                <div className="space-y-2">
                  {getMonthlyTrend.map(([month, data]) => (
                    <div key={month} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9aa0a6] w-16">{month}</span>
                      <div className="flex-1 h-2 bg-[#303134] rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-[#81c995] transition-all"
                          style={{ width: `${(data.income / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense))) * 100}%` }}
                        />
                        <div 
                          className="h-full bg-[#f28b82] transition-all"
                          style={{ width: `${(data.expense / Math.max(...getMonthlyTrend.map(([,d]) => d.income + d.expense))) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 gap-2.5">
              <button 
                onClick={() => setActiveTab('expense-hub')}
                className="w-full bg-[#202124] border border-[#5f6368] hover:border-[#8ab4f8] p-4 rounded-2xl flex items-center justify-between transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#8ab4f8]/10 text-[#8ab4f8] flex items-center justify-center">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#e8eaed]">Log & Track Expenses</h3>
                    <p className="text-[11px] text-[#9aa0a6]">Add income or quick daily expenses</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#9aa0a6]" />
              </button>

              <button 
                onClick={() => setActiveTab('history')}
                className="w-full bg-[#202124] border border-[#5f6368] hover:border-[#c58af9] p-4 rounded-2xl flex items-center justify-between transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#c58af9]/10 text-[#c58af9] flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#e8eaed]">Month-wise Ledger</h3>
                    <p className="text-[11px] text-[#9aa0a6]">View transaction history</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#9aa0a6]" />
              </button>

              <button 
                onClick={() => setActiveTab('tuition')}
                className="w-full bg-[#202124] border border-[#5f6368] hover:border-[#81c995] p-4 rounded-2xl flex items-center justify-between transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#81c995]/10 text-[#81c995] flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#e8eaed]">Tuition Calendar</h3>
                    <p className="text-[11px] text-[#9aa0a6]">16-day tracker & fare sync</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#9aa0a6]" />
              </button>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setActiveTab('add-money'); setAmount(''); setCategory(''); }}
                  className="bg-[#303134] border border-[#5f6368] hover:border-[#81c995] p-3 rounded-xl text-xs font-medium text-[#81c995] transition-colors"
                >
                  Quick Add Income
                </button>
                <button 
                  onClick={() => { setActiveTab('add-expense'); setAmount(''); setCategory(''); }}
                  className="bg-[#303134] border border-[#5f6368] hover:border-[#f28b82] p-3 rounded-xl text-xs font-medium text-[#f28b82] transition-colors"
                >
                  Quick Add Expense
                </button>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-[#9aa0a6] uppercase tracking-wider">Recent Notes</span>
                <button onClick={() => setActiveTab('history')} className="text-xs text-[#8ab4f8] hover:underline">View all</button>
              </div>

              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-xs text-[#9aa0a6] text-center py-4">No notes or transactions yet.</p>
                ) : (
                  transactions.slice(0, 4).map(t => (
                    <div key={t.id} className="group bg-[#303134] border border-transparent hover:border-[#5f6368] p-3 rounded-xl flex justify-between items-center transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-[#81c995]' : 'bg-[#f28b82]'}`} />
                        <div>
                          <p className="text-xs font-medium text-[#e8eaed]">{t.category}</p>
                          <span className="text-[10px] text-[#9aa0a6]">{t.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${t.type === 'income' ? 'text-[#81c995]' : 'text-[#f28b82]'}`}>
                          {t.type === 'income' ? '+' : '-'}৳{t.amount.toLocaleString()}
                        </span>
                        <button onClick={() => { setSelectedTransaction(t.id); setShowDeleteModal(true); }} className="opacity-0 group-hover:opacity-100 p-1 text-[#9aa0a6] hover:text-[#f28b82] transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* EXPENSE HUB */}
        {activeTab === 'expense-hub' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <button onClick={() => setActiveTab('home')} className="text-xs text-[#8ab4f8] font-medium mb-1">
              ← Back
            </button>
            <h2 className="text-lg font-medium text-[#e8eaed] mb-3">Choose Action</h2>

            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => setActiveTab('add-money')}
                className="bg-[#202124] border border-[#5f6368] hover:border-[#81c995] p-5 rounded-2xl flex items-center justify-between text-left transition-all"
              >
                <div>
                  <span className="text-[10px] text-[#81c995] uppercase font-medium tracking-wider">Flow A</span>
                  <h3 className="text-base font-medium text-[#e8eaed] mt-0.5">Add Money</h3>
                  <p className="text-xs text-[#9aa0a6] mt-1">Record salary, parent support, or stipends</p>
                </div>
                <ArrowDownLeft size={22} className="text-[#81c995]" />
              </button>

              <button 
                onClick={() => setActiveTab('add-expense')}
                className="bg-[#202124] border border-[#5f6368] hover:border-[#f28b82] p-5 rounded-2xl flex items-center justify-between text-left transition-all"
              >
                <div>
                  <span className="text-[10px] text-[#f28b82] uppercase font-medium tracking-wider">Flow B</span>
                  <h3 className="text-base font-medium text-[#e8eaed] mt-0.5">Add Expense</h3>
                  <p className="text-xs text-[#9aa0a6] mt-1">Log khichuri, transport, utilities, or snacks</p>
                </div>
                <ArrowUpRight size={22} className="text-[#f28b82]" />
              </button>
            </div>
          </div>
        )}

        {/* ADD MONEY */}
        {activeTab === 'add-money' && (
          <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-medium text-[#e8eaed]">Add Income</h2>
              <button onClick={() => setActiveTab('expense-hub')} className="text-xs text-[#8ab4f8]">Cancel</button>
            </div>

            <form onSubmit={(e) => handleSubmitTransaction(e, 'income')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-[#9aa0a6] mb-1">Category</label>
                <input 
                  type="text"
                  placeholder="e.g. Mom, Salary, Tuition"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'income')}
                  className="w-full bg-[#303134] border border-[#5f6368] focus:border-[#8ab4f8] p-3 rounded-xl text-sm text-[#e8eaed] focus:outline-none"
                  required
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#303134] border border-[#5f6368] rounded-xl shadow-lg overflow-hidden">
                    {filteredSuggestions.map((s, idx) => (
                      <div key={idx} onClick={() => { setCategory(s); setFilteredSuggestions([]); }} className="p-2.5 text-xs text-[#e8eaed] hover:bg-[#3c4043] cursor-pointer border-b border-[#202124] last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9aa0a6] mb-1">Amount (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#303134] border border-[#5f6368] focus:border-[#81c995] p-3 rounded-xl font-medium text-base text-[#81c995] focus:outline-none"
                  required
                />
              </div>

              <button type="submit" className="w-full bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-medium py-3 rounded-xl transition-colors text-sm">
                Save Income
              </button>
            </form>
          </div>
        )}

        {/* ADD EXPENSE */}
        {activeTab === 'add-expense' && (
          <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-medium text-[#e8eaed]">Add Expense</h2>
              <button onClick={() => setActiveTab('expense-hub')} className="text-xs text-[#8ab4f8]">Cancel</button>
            </div>

            <form onSubmit={(e) => handleSubmitTransaction(e, 'expense')} className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-[#9aa0a6] mb-1">Category Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Khichuri, Cigarettes, Transport"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value, 'expense')}
                  className="w-full bg-[#303134] border border-[#5f6368] focus:border-[#f28b82] p-3 rounded-xl text-sm text-[#e8eaed] focus:outline-none"
                  required
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-[#303134] border border-[#5f6368] rounded-xl shadow-lg overflow-hidden">
                    {filteredSuggestions.map((s, idx) => (
                      <div key={idx} onClick={() => { setCategory(s); setFilteredSuggestions([]); }} className="p-2.5 text-xs text-[#e8eaed] hover:bg-[#3c4043] cursor-pointer border-b border-[#202124] last:border-none">
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9aa0a6] mb-1">Amount Spent (৳)</label>
                <input 
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#303134] border border-[#5f6368] focus:border-[#f28b82] p-3 rounded-xl font-medium text-base text-[#f28b82] focus:outline-none"
                  required
                />
              </div>

              <button type="submit" className="w-full bg-[#f28b82] hover:bg-[#f6aea9] text-[#202124] font-medium py-3 rounded-xl transition-colors text-sm">
                Save Expense
              </button>
            </form>
          </div>
        )}

        {/* LEDGER HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <button onClick={() => setActiveTab('home')} className="text-xs text-[#8ab4f8] font-medium mb-1">
              ← Back
            </button>
            <h2 className="text-lg font-medium text-[#e8eaed] mb-2">Month-wise Ledger</h2>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3.5 top-3 text-[#9aa0a6]" />
              <input
                type="text"
                placeholder="Search notes & expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#202124] border border-[#5f6368] pl-10 pr-4 py-2.5 rounded-xl text-xs text-[#e8eaed] focus:outline-none focus:border-[#8ab4f8]"
              />
            </div>

            <div className="space-y-3">
              {Object.keys(groupedTransactions).length === 0 ? (
                <p className="text-center text-[#9aa0a6] py-10 text-xs">No records found.</p>
              ) : (
                Object.entries(groupedTransactions).map(([dateLabel, dayItems]) => {
                  const dayTotal = dayItems.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                  return (
                    <div key={dateLabel} className="bg-[#202124] border border-[#5f6368] rounded-2xl p-3.5 shadow-sm space-y-2">
                      <div className="flex justify-between items-center border-b border-[#3c4043] pb-2">
                        <span className="text-[11px] font-medium text-[#8ab4f8]">{dateLabel}</span>
                        <span className={`text-[10px] font-medium ${dayTotal >= 0 ? 'text-[#81c995]' : 'text-[#f28b82]'}`}>
                          Net: ৳{dayTotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {dayItems.map((item) => (
                          <div key={item.id} className="group bg-[#303134] p-2.5 rounded-xl flex justify-between items-center">
                            <div>
                              <p className="text-xs font-medium text-[#e8eaed]">{item.category}</p>
                              <span className="text-[9px] text-[#9aa0a6]">{item.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${item.type === 'income' ? 'text-[#81c995]' : 'text-[#f28b82]'}`}>
                                {item.type === 'income' ? '+' : '-'}৳{item.amount.toLocaleString()}
                              </span>
                              <button onClick={() => { setSelectedTransaction(item.id); setShowDeleteModal(true); }} className="opacity-0 group-hover:opacity-100 text-[#9aa0a6] hover:text-[#f28b82]">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TUITION CALENDAR */}
        {activeTab === 'tuition' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <button onClick={() => setActiveTab('home')} className="text-xs text-[#8ab4f8] font-medium mb-1">
              ← Back
            </button>

            <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-medium text-[#e8eaed]">Tuition Tracker</h2>
                <span className="text-[10px] bg-[#81c995]/10 text-[#81c995] px-2 py-0.5 rounded-md">Goal: 16 Days</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#303134] p-3 rounded-xl text-center">
                  <span className="text-2xl font-normal text-[#81c995]">{sessionsDone}</span>
                  <span className="text-[9px] text-[#9aa0a6] block uppercase mt-0.5">Completed</span>
                </div>
                <div className="bg-[#303134] p-3 rounded-xl text-center">
                  <span className="text-2xl font-normal text-[#8ab4f8]">{sessionsLeft}</span>
                  <span className="text-[9px] text-[#9aa0a6] block uppercase mt-0.5">Remaining</span>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#303134] p-2.5 rounded-xl">
                <span className="text-xs text-[#9aa0a6]">Transport Fare / Trip</span>
                <div className="flex items-center gap-1 bg-[#202124] border border-[#5f6368] px-2.5 py-1 rounded-lg">
                  <span className="text-xs text-[#9aa0a6]">৳</span>
                  <input 
                    type="number"
                    value={defaultFare}
                    onChange={(e) => setDefaultFare(e.target.value)}
                    className="w-12 bg-transparent text-xs font-medium text-[#81c995] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#202124] border border-[#5f6368] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <button onClick={() => setCalendarDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-[#3c4043] rounded-full text-[#9aa0a6]">
                  <ChevronLeft size={16} />
                </button>
                <h3 className="font-medium text-sm text-[#e8eaed]">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => setCalendarDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-[#3c4043] rounded-full text-[#9aa0a6]">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <span key={day} className="text-[10px] text-[#9aa0a6] font-medium">{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const targetDate = new Date(year, month, dayNum);
                  const dateStr = getDateKey(targetDate);
                  const isLogged = tuitionSessions.some(s => getDateKey(s.date) === dateStr);
                  const isToday = dateStr === getDateKey(new Date());

                  return (
                    <button
                      key={dayNum}
                      onClick={() => handleDayClick(targetDate)}
                      className={`h-9 rounded-xl font-medium text-xs flex flex-col items-center justify-center transition-all ${
                        isLogged 
                          ? 'bg-[#81c995]/20 border border-[#81c995] text-[#81c995]' 
                          : isToday 
                            ? 'bg-[#8ab4f8]/20 border border-[#8ab4f8] text-[#8ab4f8]' 
                            : 'bg-[#303134] border border-transparent text-[#e8eaed] hover:border-[#5f6368]'
                      }`}
                    >
                      <span>{dayNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* --- BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#202124] border-t border-[#5f6368]/40 flex justify-around items-center py-2 z-50">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'home' ? 'text-[#8ab4f8]' : 'text-[#9aa0a6]'}`}
        >
          <Home size={20} className="mb-0.5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('expense-hub')}
          className={`flex flex-col items-center p-2 transition-colors ${['expense-hub', 'add-money', 'add-expense'].includes(activeTab) ? 'text-[#8ab4f8]' : 'text-[#9aa0a6]'}`}
        >
          <PlusCircle size={20} className="mb-0.5" />
          <span className="text-[10px]">Add</span>
        </button>

        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'history' ? 'text-[#8ab4f8]' : 'text-[#9aa0a6]'}`}
        >
          <Clock size={20} className="mb-0.5" />
          <span className="text-[10px]">Ledger</span>
        </button>

        <button 
          onClick={() => setActiveTab('tuition')}
          className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'tuition' ? 'text-[#8ab4f8]' : 'text-[#9aa0a6]'}`}
        >
          <BookOpen size={20} className="mb-0.5" />
          <span className="text-[10px]">Tuition</span>
        </button>

        <button 
          onClick={() => setShowBudgetModal(true)}
          className={`flex flex-col items-center p-2 transition-colors text-[#9aa0a6] hover:text-[#8ab4f8]`}
        >
          <Settings size={20} className="mb-0.5" />
          <span className="text-[10px]">Budget</span>
        </button>
      </nav>

    </div>
  );
}