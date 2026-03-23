// Version: 2.4.2

import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, ChevronLeft, ChevronRight, Check, X, AlertTriangle, Calculator, 
  LayoutGrid, User, Users, Lock, Mail, LogOut, ArrowRight, History, Calendar, 
  Award, Settings, Plus, Trash2, Edit2, Save, BookOpen, FileText, Shield, Key,
  Download, Upload, Image as ImageIcon, BarChart, Eye, Copy, Database, Search, Tag, Folder,
  Shuffle, Lightbulb, Printer, UserPlus, UserCheck, UserX
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- KATEX MATH RENDERER COMPONENT ---
// Safely scans text for $...$ and renders it as math without crashing React
const LatexText = ({ text }) => {
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(!!window.katex);

  useEffect(() => {
    const handleLoad = () => setIsLoaded(true);
    window.addEventListener('katex-loaded', handleLoad);
    return () => window.removeEventListener('katex-loaded', handleLoad);
  }, []);

  useEffect(() => {
    if (!text || !containerRef.current) return;

    if (!isLoaded && !window.katex) {
      containerRef.current.textContent = text; // Fallback to raw text until KaTeX loads
      return;
    }

    try {
      const parts = text.split(/(\$[^\$]+\$)/g);
      containerRef.current.innerHTML = '';
      
      parts.forEach(part => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          const span = document.createElement('span');
          window.katex.render(math, span, {
            throwOnError: false,
            displayMode: false
          });
          containerRef.current.appendChild(span);
        } else {
          const span = document.createElement('span');
          span.textContent = part;
          containerRef.current.appendChild(span);
        }
      });
    } catch (err) {
      console.error("KaTeX error:", err);
      containerRef.current.textContent = text; 
    }
  }, [text, isLoaded]);

  return <span ref={containerRef} />;
};

// --- MATHLIVE VISUAL EDITOR COMPONENT ---
// Provides a WYSIWYG math editing experience for teachers
const MathLiveInput = ({ value, onChange, placeholder }) => {
  const mfRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load MathLive script dynamically
    if (!window.customElements.get('math-field')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/mathlive';
      script.defer = true;
      script.onload = () => setIsReady(true);
      document.head.appendChild(script);
    } else {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    const mf = mfRef.current;
    if (mf && isReady) {
      // Initialize the value. We remove the wrapping $ if they exist so it looks clean in the editor.
      const cleanValue = (value || '').replace(/^\$|\$$/g, '');
      if (mf.value !== cleanValue) {
         mf.value = cleanValue;
      }
      
      const handleInput = (ev) => {
        // We wrap the output in $...$ so our LatexText component knows to render it later
        const rawLatex = ev.target.value;
        const formattedValue = rawLatex ? `$${rawLatex}$` : '';
        onChange(formattedValue);
      };
      
      mf.addEventListener('input', handleInput);
      return () => mf.removeEventListener('input', handleInput);
    }
  }, [isReady]); // Intentionally omitting `value` and `onChange` from deps to prevent cursor jumping

  if (!isReady) {
    return <div style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem', background: '#f8fafc', color: '#94a3b8' }}>Loading Math Editor...</div>;
  }

  return (
    // eslint-disable-next-line
    <math-field 
      ref={mfRef} 
      style={{ 
        width: '100%', 
        fontSize: '1.125rem', 
        padding: '0.75rem 1rem', 
        border: '1px solid #cbd5e1', 
        borderRadius: '0.75rem',
        background: '#f8fafc',
        outline: 'none',
        transition: '0.2s',
        display: 'block' // Ensures it takes full width
      }}
    />
  );
};

// --- SECURITY UTILITY: PASSWORD HASHING (Legacy & Admin/Teacher) ---
const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// --- CLOUDINARY CONFIGURATION ---
const CLOUDINARY_CLOUD_NAME = "dm8nurvba"; 
const CLOUDINARY_UPLOAD_PRESET = "ExamBuilder"; 

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAW3I1jRHHzkLHRVQ_BU6wsZfnpphqPNOs",
  authDomain: "exambuilder-2e28c.firebaseapp.com",
  projectId: "exambuilder-2e28c",
  storageBucket: "exambuilder-2e28c.firebasestorage.app",
  messagingSenderId: "433848274913",
  appId: "1:433848274913:web:af0a7deb1bc6525ea88ca0",
  measurementId: "G-1CDXVTT2YL"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "examBuilder-production";

// --- FALLBACK MOCK DATA FOR SEEDING ---
const DEFAULT_EXAM = {
  title: "Grade 10 Practice Assessment",
  description: "This simulated examination covers core Grade 10 concepts including Algebra, Geometry, Functions, and Probability.",
  timeLimit: 30,
  isActive: true,
  category: "Practice",
  openDate: '',
  closeDate: '',
  assignToAll: true,
  assignedStudentIds: []
};

const DEFAULT_QUESTIONS = [
  {
    topic: "Algebra II", text: "Solve for $x$ in the quadratic equation: $x^2 - 8x + 15 = 0$",
    options: [{ id: "A", text: "$x = 3, x = 5$" }, { id: "B", text: "$x = -3, x = -5$" }, { id: "C", text: "$x = 2, x = 6$" }, { id: "D", text: "$x = -2, x = -6$" }],
    correctId: "A", explanation: "Factoring the quadratic equation gives $(x - 3)(x - 5) = 0$. Therefore, the solutions are $x = 3$ and $x = 5$."
  },
  {
    topic: "Functions", text: "Given the function $f(x) = 3x^2 - 2x + 5$, calculate the value of $f(-2)$.",
    options: [{ id: "A", text: "13" }, { id: "B", text: "21" }, { id: "C", text: "9" }, { id: "D", text: "17" }],
    correctId: "B", explanation: "Substitute $x = -2$ into the function: $f(-2) = 3(-2)^2 - 2(-2) + 5 = 3(4) + 4 + 5 = 12 + 4 + 5 = 21$."
  },
  {
    topic: "Geometry", text: "In a right triangle, the length of the hypotenuse is 13 units and one leg is 5 units. What is the length of the other leg?",
    options: [{ id: "A", text: "8 units" }, { id: "B", text: "10 units" }, { id: "C", text: "12 units" }, { id: "D", text: "14 units" }],
    correctId: "C", explanation: "Using the Pythagorean theorem ($a^2 + b^2 = c^2$): $5^2 + b^2 = 13^2$. $25 + b^2 = 169$. $b^2 = 144$, so $b = 12$."
  }
];

// --- NATIVE CSS ---
const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; color: #0f172a; line-height: 1.5; }
  button, input, textarea, select { font-family: inherit; }
  
  .min-h-screen { min-height: 100vh; display: flex; flex-direction: column; }
  .flex { display: flex; }
  .flex-col { display: flex; flex-direction: column; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .gap-6 { gap: 1.5rem; }
  .shrink-0 { flex-shrink: 0; }
  .flex-1 { flex: 1; min-width: 0; }
  
  .container { width: 100%; max-width: 64rem; margin: 0 auto; padding: 2rem; }
  .container-sm { max-width: 28rem; }
  
  .card { background: white; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; padding: 2rem; }
  .card-header { background: #0f172a; color: white; padding: 2rem; text-align: center; border-radius: 1rem 1rem 0 0; margin: -2rem -2rem 2rem -2rem; }
  .card-header-icon { width: 4rem; height: 4rem; background: rgba(37,99,235,0.2); color: #60a5fa; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; border: 1px solid rgba(59,130,246,0.3); }
  .card-header-icon.admin { background: rgba(139,92,246,0.2); color: #c4b5fd; border-color: rgba(139,92,246,0.3); }
  
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-muted { color: #64748b; }
  .text-danger { color: #ef4444; }
  .text-success { color: #22c55e; }
  .text-warning { color: #f59e0b; }
  .font-bold { font-weight: 700; }
  
  .title { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
  .subtitle { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.25rem; }
  
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: 0.2s; background: transparent; font-size: 1rem; }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
  .btn-secondary { background: #1e293b; color: white; }
  .btn-secondary:hover:not(:disabled) { background: #0f172a; }
  .btn-outline { border-color: #cbd5e1; color: #475569; background: white; }
  .btn-outline:hover:not(:disabled) { background: #f8fafc; }
  .btn-danger { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }
  .btn-danger:hover:not(:disabled) { background: #fee2e2; }
  .btn-icon { padding: 0.5rem; border-radius: 0.5rem; color: #94a3b8; background: transparent; cursor: pointer; border: none; outline: none; }
  .btn-icon:hover { color: #2563eb; background: #eff6ff; }
  .btn-icon-danger:hover { color: #ef4444; background: #fef2f2; }
  .btn-link { color: #2563eb; font-weight: 600; background: none; border: none; cursor: pointer; padding: 0.5rem; transition: 0.2s; }
  .btn-link:hover { text-decoration: underline; color: #1d4ed8; }
  
  .w-full { width: 100%; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-4 { margin-top: 1rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-4 { margin-bottom: 1rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mb-8 { margin-bottom: 2rem; }
  
  .input-group { margin-bottom: 1rem; text-align: left; }
  .label { display: block; font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 0.5rem; }
  .input-wrapper { position: relative; display: flex; align-items: center; }
  .input-icon { position: absolute; left: 1rem; color: #94a3b8; }
  .input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.75rem; border-radius: 0.75rem; border: 1px solid #cbd5e1; background: #f8fafc; outline: none; font-size: 1rem; transition: 0.2s; }
  .input.no-icon { padding-left: 1rem; }
  .input:focus { border-color: #2563eb; background: white; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
  textarea.input { resize: vertical; min-height: 80px; }
  select.input { padding-left: 1rem; cursor: pointer; }
  
  .nav { background: white; border-bottom: 1px solid #e2e8f0; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
  .nav.dark { background: #0f172a; border-bottom-color: #1e293b; color: white; }
  .nav-brand { font-weight: 700; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; }
  .nav.dark .nav-brand { color: white; }
  .badge { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 0.375rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem; color: #475569; }
  .nav.dark .badge { background: transparent; border: none; color: #cbd5e1; }
  
  .grid { display: grid; gap: 1.5rem; }
  .grid-cols-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  
  .exam-card { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.5rem; display: flex; flex-direction: column; transition: 0.2s; cursor: pointer; }
  .exam-card:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border-color: #cbd5e1; }
  .exam-meta { display: flex; justify-content: space-between; background: #f8fafc; padding: 0.75rem; border-radius: 0.75rem; margin-bottom: 1.5rem; font-size: 0.875rem; font-weight: 600; color: #64748b; border: 1px solid #f1f5f9; }
  .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  
  .history-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 0.75rem; }
  .history-icon { background: white; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; color: #94a3b8; }
  
  .question-box { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2rem; margin-bottom: 1.5rem; }
  .option-btn { width: 100%; text-align: left; padding: 1.25rem; border: 2px solid #e2e8f0; background: white; border-radius: 0.75rem; margin-bottom: 0.75rem; cursor: pointer; display: flex; align-items: center; font-size: 1.125rem; transition: 0.2s; outline: none; }
  .option-btn:hover { border-color: #bfdbfe; background: #f8fafc; }
  .option-btn.selected { border-color: #2563eb; background: #eff6ff; }
  .option-btn:disabled { cursor: default; }
  .option-letter { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border: 2px solid #cbd5e1; border-radius: 0.5rem; margin-right: 1rem; font-weight: 700; background: #f1f5f9; color: #64748b; flex-shrink: 0; }
  .option-btn.selected .option-letter { background: #2563eb; color: white; border-color: #2563eb; }
  
  .timer { font-family: monospace; font-size: 1.125rem; font-weight: 700; padding: 0.375rem 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; gap: 0.5rem; color: #334155; }
  .timer.urgent { background: #fef2f2; color: #ef4444; border-color: #fca5a5; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  
  .progress-nav { display: flex; justify-content: space-between; align-items: center; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; margin-top: auto; }
  .progress-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; max-width: 400px; margin: 0 auto; }
  .progress-dot { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border-radius: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: 1px solid #cbd5e1; background: white; color: #64748b; }
  .progress-dot.answered { background: #1e293b; color: white; border-color: #1e293b; }
  .progress-dot.current { border: 2px solid #2563eb; color: #2563eb; }
  
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
  .modal-content { background: white; border-radius: 1.5rem; padding: 2rem; max-width: 28rem; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center; }
  
  .result-circle { width: 12rem; height: 12rem; border: 8px solid #f1f5f9; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 2rem; }
  .result-score { font-size: 3.5rem; font-weight: 900; line-height: 1; color: #0f172a; }
  
  .role-toggle { display: flex; background: #e2e8f0; padding: 0.375rem; border-radius: 0.75rem; margin-bottom: 1.5rem; gap: 0.375rem; }
  .role-btn { flex: 1; padding: 0.75rem 0.5rem; text-align: center; font-size: 0.875rem; font-weight: 700; color: #64748b; border-radius: 0.5rem; cursor: pointer; border: none; outline: none; background: transparent; transition: all 0.2s ease; appearance: none; white-space: nowrap; }
  .role-btn:hover { color: #334155; }
  .role-btn.active { background: white; color: #2563eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); pointer-events: none; }
  
  .admin-form-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
  @media (min-width: 768px) {
    .admin-form-grid { grid-template-columns: 1fr 1fr; }
    .col-span-2 { grid-column: span 2; }
  }

  .admin-list-item { display: flex; gap: 1.5rem; padding: 1.5rem; border-bottom: 1px solid #e2e8f0; align-items: flex-start; }
  .admin-list-item:last-child { border-bottom: none; }
  .item-number { background: #eff6ff; color: #2563eb; width: 3rem; height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; font-weight: 700; flex-shrink: 0; font-size: 1.125rem; }
  
  .review-item { border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; margin-bottom: 1.5rem; background: white; }
  .review-header { padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.75rem; background: #f8fafc; font-weight: 700; }
  .review-header.correct { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  .review-header.incorrect { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  .review-icon { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; color: white; flex-shrink: 0; }
  .bg-success { background: #22c55e; }
  .bg-danger { background: #ef4444; }
  .bg-muted { background: #94a3b8; }
  .review-body { padding: 1.5rem; }
  .review-option { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 0.75rem; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .review-option.is-correct { background: #f0fdf4; border-color: #22c55e; color: #166534; }
  .review-option.is-wrong { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
  .review-explanation { background: #eff6ff; padding: 1.25rem; border-radius: 0.75rem; border: 1px solid #bfdbfe; margin-top: 1.5rem; color: #1e3a8a; }
  
  .empty-state { border: 2px dashed #cbd5e1; padding: 3rem; text-align: center; border-radius: 1rem; background: white; }
  
  .math-scroll { overflow-x: auto; overflow-y: hidden; overflow-wrap: break-word; word-break: break-word; max-width: 100%; padding-bottom: 4px; }
  .math-scroll::-webkit-scrollbar { height: 4px; }
  .math-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 2px; }
  .math-scroll::-webkit-scrollbar-track { background: transparent; }

  .error-message { background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; padding: 1rem; border-radius: 0.75rem; font-weight: 600; text-align: center; font-size: 0.875rem; }
  .success-message { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 0.75rem; font-weight: 600; text-align: center; font-size: 0.875rem; }

  .status-badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; white-space: nowrap; }
  .status-active { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .status-draft { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
  .status-locked { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .checkbox-wrapper { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; text-align: left; }
  .checkbox { width: 1.25rem; height: 1.25rem; cursor: pointer; accent-color: #2563eb; }

  .stat-bar-bg { width: 100%; background: #e2e8f0; border-radius: 999px; height: 0.75rem; overflow: hidden; margin-top: 0.5rem; }
  .stat-bar-fill { height: 100%; transition: width 0.5s ease-out; }

  /* --- PRINT SPECIFIC CSS --- */
  @media print {
    body { background: white !important; color: black !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .print-container { padding: 0 !important; max-width: 100% !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
    .page-break-avoid { page-break-inside: avoid; }
    .card, .container, .min-h-screen { box-shadow: none !important; background: transparent !important; }
  }

  /* --- SIDEBAR ADMIN CSS --- */
  .admin-layout { display: flex; flex: 1; overflow: hidden; }
  .sidebar { width: 250px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 1.5rem; flex-shrink: 0; overflow-y: auto; }
  .sidebar-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; font-weight: 600; color: #475569; text-decoration: none; border: none; background: transparent; cursor: pointer; transition: 0.2s; width: 100%; text-align: left; font-size: 0.875rem; margin-bottom: 0.25rem; }
  .sidebar-btn:hover { background: #f8fafc; color: #0f172a; }
  .sidebar-btn.active { background: #eff6ff; color: #2563eb; }
  .menu-label { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; padding-left: 1rem; margin-top: 1rem; }
  .create-exam-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #2563eb; color: white; border-radius: 0.75rem; padding: 0.75rem 1.5rem; font-weight: 600; cursor: pointer; border: none; transition: 0.2s; width: 100%; font-size: 14px; margin-bottom: 1rem; flex-shrink: 0; }
  .create-exam-btn:hover { background: #1d4ed8; }

  @media (max-width: 768px) {
    .admin-layout { flex-direction: column; overflow: auto; }
    .sidebar { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; padding: 1rem; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; align-items: center; }
    .sidebar-btn { width: auto; white-space: nowrap; margin-bottom: 0; padding: 0.5rem 1rem; flex-shrink: 0; }
    .create-exam-btn { width: auto; margin-bottom: 0; margin-right: 1rem; }
    .menu-label { display: none; }
  }

  @media (max-width: 640px) {
    .nav { padding: 1rem; }
    .container { padding: 1rem; }
    .hidden-sm { display: none; }
    .flex-col-sm { flex-direction: column; }
    .w-full-sm { width: 100%; }
    .title { font-size: 1.5rem; }
  }
`;

export default function App() {
  const [appState, setAppState] = useState('loading'); 
  
  const [activeSession, setActiveSession] = useState(() => {
    const saved = localStorage.getItem('olyst_session');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      localStorage.removeItem('olyst_session');
      return null;
    }
  });

  const [user, setUser] = useState(null);

  // Login Form
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loginMode, setLoginMode] = useState('student');
  const [isRegistering, setIsRegistering] = useState(false); 

  // SuperAdmin state
  const [newTeacherForm, setNewTeacherForm] = useState({ name: '', email: '', password: '' });
  const [hashInput, setHashInput] = useState('');
  const [generatedHash, setGeneratedHash] = useState('');
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  // Global DB Data
  const [adminsList, setAdminsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);
  const [studentProfiles, setStudentProfiles] = useState([]);
  const [exams, setExams] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [allResults, setAllResults] = useState([]); 
  const [topicsList, setTopicsList] = useState([]); 
  const [examCategoriesList, setExamCategoriesList] = useState([]); 
  const [studentGroupsList, setStudentGroupsList] = useState([]); 
  
  const [pastResults, setPastResults] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [sessionQuestions, setSessionQuestions] = useState([]); 
  const [examMode, setExamMode] = useState('timed'); 

  // Student Exam Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentScore, setCurrentScore] = useState({ score: 0, percentage: 0 });

  // Admin Builder State
  const [adminView, setAdminView] = useState('list_exams'); 
  const [homeView, setHomeView] = useState('dashboard');
  const [editingExamDetails, setEditingExamDetails] = useState(null);
  
  // Question & Upload States
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [explanationImageFile, setExplanationImageFile] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  
  const [selectedStudentResult, setSelectedStudentResult] = useState(null);
  
  // Question Bank States
  const [bankSelection, setBankSelection] = useState([]); 
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankTopicFilter, setBankTopicFilter] = useState(''); 
  
  // Manage Categories/Topics/Groups States
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  
  const [newExamCategoryName, setNewExamCategoryName] = useState(''); 
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);

  // Print States
  const [printMode, setPrintMode] = useState('student');

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 1. Fetch Public Collections
  useEffect(() => {
    const publicDataPath = `artifacts/${appId}/public/data`;

    const unsubAdmins = onSnapshot(collection(db, `${publicDataPath}/admins`), (snapshot) => {
      setAdminsList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubTeachers = onSnapshot(collection(db, `${publicDataPath}/teachers`), (snapshot) => {
      setTeachersList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStudents = onSnapshot(collection(db, `${publicDataPath}/studentProfiles`), (snapshot) => {
      setStudentProfiles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubExams = onSnapshot(collection(db, `${publicDataPath}/exams`), (snapshot) => {
      const loadedExams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedExams.sort((a, b) => b.createdAt - a.createdAt); 
      setExams(loadedExams);
    });

    const unsubQuestions = onSnapshot(collection(db, `${publicDataPath}/questions`), (snapshot) => {
      setAllQuestions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubAllResults = onSnapshot(collection(db, `${publicDataPath}/allResults`), (snapshot) => {
      setAllResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubTopics = onSnapshot(collection(db, `${publicDataPath}/topics`), (snapshot) => {
      const loadedTopics = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedTopics.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTopicsList(loadedTopics);
    });

    const unsubExamCategories = onSnapshot(collection(db, `${publicDataPath}/examCategories`), (snapshot) => {
      const loadedCategories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedCategories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setExamCategoriesList(loadedCategories);
    });

    const unsubStudentGroups = onSnapshot(collection(db, `${publicDataPath}/studentGroups`), (snapshot) => {
      const loadedGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedGroups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStudentGroupsList(loadedGroups);
    });

    return () => { 
      unsubAdmins(); unsubTeachers(); unsubStudents(); unsubExams(); 
      unsubQuestions(); unsubAllResults(); unsubTopics(); unsubExamCategories(); unsubStudentGroups();
    };
  }, []);

  // 2. Routing based on Active Session
  useEffect(() => {
    if (activeSession) {
      if (activeSession.role === 'superadmin') {
        setAppState('superadmin');
      } else if (activeSession.role === 'teacher') {
        if (appState !== 'print_exam') {
           setAppState('admin');
           setAdminView('list_exams');
        }
      } else {
        setAppState('home');
        setHomeView('dashboard');
      }
    } else {
      setAppState('login');
    }
  }, [activeSession]);

  // 3. Fetch private results for logged in Student
  useEffect(() => {
    if (activeSession && activeSession.role === 'student' && user) {
      const q = collection(db, `artifacts/${appId}/users/${activeSession.studentId}/results`);
      const unsubResults = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        results.sort((a, b) => b.timestamp - a.timestamp);
        setPastResults(results);
      }, (error) => console.error("Error fetching results:", error));

      return () => unsubResults();
    } else {
      setPastResults([]);
    }
  }, [activeSession, user]);

  // Load KaTeX scripts dynamically for the whole app
  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById('katex-js')) {
      const script = document.createElement('script');
      script.id = 'katex-js';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
      script.async = true;
      script.onload = () => window.dispatchEvent(new Event('katex-loaded'));
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    let timer;
    if (appState === 'exam' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (appState === 'exam' && timeLeft === 0) {
      finishExam();
    }
    return () => clearInterval(timer);
  }, [appState, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCurrentExamQuestions = () => {
    if (!selectedExam) return [];
    return allQuestions
      .filter(q => q.examId === selectedExam.id)
      .sort((a, b) => a.order - b.order);
  };

  const currentQuestions = getCurrentExamQuestions();

  const handleStudentPostLogin = async (fbUser, email, isMigrating = false) => {
    const profile = studentProfiles.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (!profile) {
       setAuthError("User profile not found in database.");
       await signOut(auth);
       await signInAnonymously(auth); // Restore read access
       return;
    }
    
    // Treat old users missing a status as 'active' for backwards compatibility
    const currentStatus = profile.status || 'active';

    if (currentStatus === 'pending_approval') {
       setAuthError("Your account is pending teacher approval.");
       await signOut(auth);
       await signInAnonymously(auth);
       return;
    }
    
    // Email verification check (bypassed if legacy migrated)
    if (!fbUser.emailVerified && !profile.legacyMigrated) {
       setAuthError("Please verify your email address. Check your inbox.");
       await signOut(auth);
       await signInAnonymously(auth);
       return;
    }
    
    // Success!
    const session = { role: 'student', name: profile.name, email: email, studentId: profile.studentId, userId: profile.id };
    localStorage.setItem('olyst_session', JSON.stringify(session));
    setActiveSession(session);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const userEmail = String(authForm.email || '').toLowerCase().trim();

    try {
      if (loginMode === 'admin') {
        const userPasswordHash = await hashPassword(authForm.password || '');
        const adminUser = adminsList.find(a => String(a.email || '').toLowerCase().trim() === userEmail && String(a.password || '').trim() === userPasswordHash);
        if (adminUser) {
          const session = { role: 'superadmin', name: 'System Admin', email: userEmail, userId: adminUser.id };
          localStorage.setItem('olyst_session', JSON.stringify(session));
          setActiveSession(session);
        } else {
          setAuthError("Invalid admin credentials. Please check your system admin email and password.");
        }
      } else if (loginMode === 'teacher') {
        const userPasswordHash = await hashPassword(authForm.password || '');
        const teacher = teachersList.find(t => String(t.email || '').toLowerCase().trim() === userEmail && String(t.password || '').trim() === userPasswordHash);
        if (teacher) {
          const session = { role: 'teacher', name: teacher.name || 'Teacher', email: userEmail, studentId: 'teacher', userId: teacher.id };
          localStorage.setItem('olyst_session', JSON.stringify(session));
          setActiveSession(session);
        } else {
          setAuthError("Invalid teacher credentials. Please verify your email and password or contact the system admin.");
        }
      } else {
        // STUDENT LOGIN / REGISTRATION FLOW
        if (isRegistering) {
          const existingStudent = studentProfiles.find(s => String(s.email || '').toLowerCase().trim() === userEmail);
          if (existingStudent) {
            setAuthError("This email is already registered. Please click 'Sign in' instead.");
          } else {
            // New Firebase Auth Registration
            const userCred = await createUserWithEmailAndPassword(auth, userEmail, authForm.password);
            await sendEmailVerification(userCred.user);
            
            const newStudentId = `stu_${Date.now()}`;
            await addDoc(collection(db, `artifacts/${appId}/public/data/studentProfiles`), {
              email: userEmail, 
              name: authForm.name, 
              studentId: newStudentId, 
              status: 'pending_approval',
              legacyMigrated: false,
              createdAt: Date.now()
            });
            
            setAuthSuccess("Registration successful! Please check your email to verify your address, then wait for teacher approval.");
            setIsRegistering(false);
            setAuthForm({ name: '', email: '', password: '' });
            await signOut(auth);
            await signInAnonymously(auth); // Restore read access
          }
        } else {
          // Standard Student Login
          try {
            const userCredential = await signInWithEmailAndPassword(auth, userEmail, authForm.password);
            await handleStudentPostLogin(userCredential.user, userEmail);
          } catch (firebaseErr) {
            // --- LAZY MIGRATION BLOCK (Delete in future once all students have logged in once) ---
            const hashedPass = await hashPassword(authForm.password);
            const legacyStudent = studentProfiles.find(s => String(s.email || '').toLowerCase() === userEmail && s.password === hashedPass);
            
            if (legacyStudent) {
              try {
                // Quietly create their official Firebase account with the password they just typed
                const newUserCred = await createUserWithEmailAndPassword(auth, userEmail, authForm.password);
                
                // Update their Firestore doc to mark them as migrated and active
                const docRef = doc(db, `artifacts/${appId}/public/data/studentProfiles/${legacyStudent.id}`);
                await updateDoc(docRef, { status: 'active', legacyMigrated: true });
                
                // Log them in immediately
                await handleStudentPostLogin(newUserCred.user, userEmail, true);
              } catch (migErr) {
                 console.error("Migration Error:", migErr);
                 setAuthError("Account migration failed. Please contact your teacher.");
              }
            } else {
               setAuthError("Invalid student credentials. Please verify your email and password.");
            }
            // --- END LAZY MIGRATION BLOCK ---
          }
        }
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setAuthError(`Database Error: ${err.message}`);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('olyst_session');
    setActiveSession(null);
    setAuthForm({ name: '', email: '', password: '' });
    setSelectedExam(null);
    setAuthError('');
    setAuthSuccess('');
    setIsRegistering(false);
    setHomeView('dashboard');
    setAdminView('list_exams');
    setAppState('login');
    signOut(auth).then(() => signInAnonymously(auth));
  };

  const handleRegisterTeacher = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    const emailToRegister = String(newTeacherForm.email || '').toLowerCase().trim();
    
    if (teachersList.find(t => String(t.email || '').toLowerCase().trim() === emailToRegister)) {
      setAuthError("A teacher with this email already exists.");
      return;
    }

    try {
      const hashedPassword = await hashPassword(newTeacherForm.password);
      await addDoc(collection(db, `artifacts/${appId}/public/data/teachers`), {
        name: newTeacherForm.name,
        email: emailToRegister,
        password: hashedPassword,
        createdAt: Date.now()
      });
      setAuthSuccess(`Successfully created account for ${newTeacherForm.name}!`);
      setNewTeacherForm({ name: '', email: '', password: '' });
    } catch (err) {
      console.error("Error creating teacher:", err);
      setAuthError("Failed to create teacher account.");
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
    if (!window.confirm("Are you sure you want to delete this teacher account? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/teachers/${teacherId}`));
      setAuthSuccess("Teacher account permanently deleted.");
      setTimeout(() => setAuthSuccess(''), 3000);
    } catch (err) {
      console.error("Error deleting teacher:", err);
      setAuthError("Failed to delete teacher account.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (!activeSession?.userId) {
      setAuthError("Session expired. Please log out and sign in again to use this feature.");
      return;
    }

    try {
      const hashedPassword = await hashPassword(passwordForm.newPassword);
      const collectionName = activeSession.role === 'teacher' ? 'teachers' : 'studentProfiles';
      const docRef = doc(db, `artifacts/${appId}/public/data/${collectionName}/${activeSession.userId}`);
      await updateDoc(docRef, { password: hashedPassword });
      setAuthSuccess("Your password has been successfully updated!");
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        if (activeSession.role === 'teacher') setAdminView('list_exams');
        else setHomeView('dashboard');
        setAuthSuccess('');
      }, 2500);
    } catch (err) {
      console.error("Error changing password:", err);
      setAuthError("Failed to update password.");
    }
  };

  const selectExamForTaking = (exam) => {
    setSelectedExam(exam);
    setAppState('exam_intro');
  };

  const startExam = (mode) => {
    const rawQuestions = getExamQuestionsFromDB();
    if (rawQuestions.length === 0) return;
    
    let preppedQuestions = rawQuestions;
    if (mode === 'timed') {
      preppedQuestions = [...rawQuestions].sort(() => Math.random() - 0.5);
    }
    
    setSessionQuestions(preppedQuestions);
    setExamMode(mode);
    setAppState('exam');
    setTimeLeft(mode === 'timed' ? (selectedExam.timeLimit || 30) * 60 : 0);
    setAnswers({});
    setCurrentQIndex(0);
  };

  const getExamQuestionsFromDB = () => {
    if (!selectedExam) return [];
    return allQuestions
      .filter(q => q.examId === selectedExam.id)
      .sort((a, b) => a.order - b.order);
  };

  const handleSelectOption = (optionId) => {
    setAnswers({ ...answers, [sessionQuestions[currentQIndex].id]: optionId });
  };

  const finishExam = async () => {
    let score = 0;
    sessionQuestions.forEach(q => {
      if (answers[q.id] === q.correctId) score++;
    });
    const percentage = Math.round((score / sessionQuestions.length) * 100);
    setCurrentScore({ score, percentage });

    if (activeSession && activeSession.role === 'student' && user && examMode === 'timed') {
      try {
        const resultsRef = collection(db, `artifacts/${appId}/users/${activeSession.studentId}/results`);
        await addDoc(resultsRef, {
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          score,
          total: sessionQuestions.length,
          percentage,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("Error saving result:", err);
      }
    }

    setAppState('results');
    setShowSubmitModal(false);
  };

  const handleAttemptSubmit = () => {
    const unansweredCount = sessionQuestions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      setShowSubmitModal(true);
    } else {
      finishExam();
    }
  };

  const seedDemoExam = async () => {
    if (!activeSession) return;
    try {
      const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
      const examDocRef = await addDoc(examsRef, { ...DEFAULT_EXAM, createdAt: Date.now() });

      const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
      for (let i = 0; i < DEFAULT_QUESTIONS.length; i++) {
        await addDoc(questionsRef, { 
          ...DEFAULT_QUESTIONS[i], 
          examId: examDocRef.id,
          order: Date.now() + i 
        });
      }
    } catch (err) {
      console.error("Error seeding exam", err);
    }
  };

  const openNewExam = () => {
    setEditingExamDetails({ 
      isNew: true, 
      title: '', 
      description: '', 
      timeLimit: 30, 
      isActive: false, 
      category: examCategoriesList.length > 0 ? examCategoriesList[0].name : '',
      openDate: '',
      closeDate: '',
      assignToAll: true,
      assignedStudentIds: []
    });
    setAdminView('edit_exam_details');
  };

  const saveExamDetails = async (e) => {
    e.preventDefault();
    if (!activeSession) return;
    
    const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
    const examData = {
      title: editingExamDetails.title,
      description: editingExamDetails.description,
      timeLimit: Number(editingExamDetails.timeLimit),
      isActive: Boolean(editingExamDetails.isActive),
      category: editingExamDetails.category || '',
      openDate: editingExamDetails.openDate || '',
      closeDate: editingExamDetails.closeDate || '',
      assignToAll: Boolean(editingExamDetails.assignToAll !== false),
      assignedStudentIds: editingExamDetails.assignedStudentIds || [],
      updatedAt: Date.now()
    };

    try {
      if (editingExamDetails.isNew) {
        examData.createdAt = Date.now();
        await addDoc(examsRef, examData);
      } else {
        const docRef = doc(db, `artifacts/${appId}/public/data/exams/${editingExamDetails.id}`);
        await updateDoc(docRef, examData);
      }
      setAdminView('list_exams');
      setEditingExamDetails(null);
    } catch (err) {
      console.error("Error saving exam:", err);
    }
  };

  const deleteExam = async (examId) => {
    if (!activeSession || !window.confirm("Are you sure? This will delete the exam.")) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/exams/${examId}`));
      const qsToDelete = allQuestions.filter(q => q.examId === examId);
      qsToDelete.forEach(async (q) => {
         await deleteDoc(doc(db, `artifacts/${appId}/public/data/questions/${q.id}`));
      });
    } catch (err) {
      console.error("Error deleting exam:", err);
    }
  };

  const duplicateExam = async (examToCopy) => {
    if (!activeSession || !window.confirm(`Are you sure you want to duplicate "${examToCopy.title}"?`)) return;
    try {
      const examsRef = collection(db, `artifacts/${appId}/public/data/exams`);
      const newExamRef = await addDoc(examsRef, {
        title: `${examToCopy.title} (Copy)`,
        description: examToCopy.description,
        timeLimit: examToCopy.timeLimit,
        category: examToCopy.category || '',
        openDate: examToCopy.openDate || '',
        closeDate: examToCopy.closeDate || '',
        assignToAll: examToCopy.assignToAll !== false,
        assignedStudentIds: examToCopy.assignedStudentIds || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isActive: false // Default to draft so they can edit it first before publishing
      });

      const qsToCopy = allQuestions.filter(q => q.examId === examToCopy.id);
      const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
      for (const q of qsToCopy) {
        const { id, ...qData } = q;
        await addDoc(questionsRef, {
          ...qData,
          examId: newExamRef.id,
          order: Date.now() + Math.random()
        });
      }
      setAuthSuccess(`Exam "${examToCopy.title}" duplicated successfully!`);
      setTimeout(() => setAuthSuccess(''), 3000);
    } catch (err) {
      console.error("Error duplicating exam:", err);
      setAuthError("Failed to duplicate exam.");
      setTimeout(() => setAuthError(''), 3000);
    }
  };

  // --- Inline Editing Handlers ---
  const saveEditTopic = async (topicId, oldName) => {
    const newName = editingTopicName.trim();
    if (!newName || newName === oldName) {
      setEditingTopicId(null);
      return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/topics/${topicId}`), { name: newName });
      const questionsToUpdate = allQuestions.filter(q => q.topic === oldName);
      for (const q of questionsToUpdate) {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/questions/${q.id}`), { topic: newName });
      }
      setEditingTopicId(null);
    } catch(err) { console.error("Error updating topic:", err); }
  };

  const saveEditCategory = async (categoryId, oldName) => {
    const newName = editingCategoryName.trim();
    if (!newName || newName === oldName) {
      setEditingCategoryId(null);
      return;
    }
    try {
      await updateDoc(doc(db, `artifacts/${appId}/public/data/examCategories/${categoryId}`), { name: newName });
      const examsToUpdate = exams.filter(e => e.category === oldName);
      for (const e of examsToUpdate) {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/exams/${e.id}`), { category: newName });
      }
      setEditingCategoryId(null);
    } catch(err) { console.error("Error updating category:", err); }
  };

  const openNewQuestion = () => {
    setEditingQuestion({
      isNew: true, 
      topic: topicsList.length > 0 ? topicsList[0].name : '', 
      text: '',
      options: [ { id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' } ],
      correctId: 'A', 
      explanation: '',
      imageUrl: '', 
      explanationImageUrl: ''
    });
    setImageFile(null);
    setExplanationImageFile(null);
    setAdminView('edit_question');
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    if (!activeSession || !selectedExam) return;
    
    setIsUploadingImage(true);
    setAuthError('');
    let uploadedImageUrl = editingQuestion.imageUrl || '';
    let uploadedExplanationImageUrl = editingQuestion.explanationImageUrl || '';

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error("Failed to upload question image.");
        const uploadData = await uploadRes.json();
        uploadedImageUrl = uploadData.secure_url;
      }

      if (explanationImageFile) {
        const explanationFormData = new FormData();
        explanationFormData.append('file', explanationImageFile);
        explanationFormData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const explanationUploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: explanationFormData });
        if (!explanationUploadRes.ok) throw new Error("Failed to upload explanation image.");
        const explanationUploadData = await explanationUploadRes.json();
        uploadedExplanationImageUrl = explanationUploadData.secure_url;
      }

      const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
      const qData = {
        examId: selectedExam.id, 
        topic: editingQuestion.topic, 
        text: editingQuestion.text,
        options: editingQuestion.options, 
        correctId: editingQuestion.correctId,
        explanation: editingQuestion.explanation, 
        order: editingQuestion.order || Date.now(),
        imageUrl: uploadedImageUrl,
        explanationImageUrl: uploadedExplanationImageUrl
      };

      if (editingQuestion.isNew) {
        await addDoc(questionsRef, qData);
      } else {
        const docRef = doc(db, `artifacts/${appId}/public/data/questions/${editingQuestion.id}`);
        await updateDoc(docRef, qData);
      }
      
      setEditingQuestion(null);
      setImageFile(null);
      setExplanationImageFile(null);
      setAdminView('manage_questions');
    } catch (err) {
      console.error("Error saving question:", err);
      setAuthError(err.message || "Failed to save question.");
      setTimeout(() => setAuthError(''), 6000);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!activeSession || !window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/questions/${id}`));
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = `Topic,Question Text,Option A,Option B,Option C,Option D,Correct Answer (A/B/C/D),Explanation\nAlgebra I,Solve for $x$: $2x + 4 = 10$,2,3,4,5,B,Subtract 4 from both sides to get $2x = 6$. Divide by 2 to get $x = 3$.\nGeometry,What is the area of a rectangle with length 5 and width 4?,9,18,20,40,C,The area of a rectangle is length multiplied by width ($5 \\times 4 = 20$).\nFractions,"What is $\\frac{1}{2} + \\frac{1}{4}$?","$\\frac{1}{4}$","$\\frac{3}{4}$","$\\frac{2}{6}$","1",B,"To add fractions find a common denominator. $\\frac{1}{2}$ becomes $\\frac{2}{4}$. $\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}$."`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "questions_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedExam || !activeSession) return;

    setIsUploadingCSV(true);
    setAuthError('');
    setAuthSuccess('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).filter(row => row.trim().length > 0);
        
        if (rows.length <= 1) {
          throw new Error("CSV appears to be empty or missing data rows.");
        }

        const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
        let addedCount = 0;

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => {
            let clean = s.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.slice(1, -1).replace(/""/g, '"');
            }
            return clean;
          });

          if (values.length >= 8) {
            const qData = {
              examId: selectedExam.id,
              topic: values[0] || 'General',
              text: values[1] || '',
              options: [
                { id: 'A', text: values[2] || '' },
                { id: 'B', text: values[3] || '' },
                { id: 'C', text: values[4] || '' },
                { id: 'D', text: values[5] || '' }
              ],
              correctId: (values[6] || 'A').toUpperCase().trim(),
              explanation: values[7] || '',
              imageUrl: '', 
              explanationImageUrl: '',
              order: Date.now() + addedCount
            };
            await addDoc(questionsRef, qData);
            addedCount++;
          }
        }

        setAuthSuccess(`Successfully imported ${addedCount} questions!`);
        setTimeout(() => setAuthSuccess(''), 4000);
      } catch (err) {
        console.error("CSV Upload Error:", err);
        setAuthError("Failed to parse CSV. Please ensure you are using the correct template.");
        setTimeout(() => setAuthError(''), 4000);
      } finally {
        setIsUploadingCSV(false);
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const importFromBank = async () => {
    if (!activeSession || !selectedExam || bankSelection.length === 0) return;
    setIsUploadingCSV(true); 
    try {
      const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
      for (const qId of bankSelection) {
        const originalQ = allQuestions.find(q => q.id === qId);
        if (originalQ) {
          const { id, ...qData } = originalQ;
          await addDoc(questionsRef, {
            ...qData,
            examId: selectedExam.id,
            order: Date.now() + Math.random()
          });
        }
      }
      setAuthSuccess(`Successfully imported ${bankSelection.length} questions from the bank!`);
      setTimeout(() => setAuthSuccess(''), 4000);
      setAdminView('manage_questions');
      setBankSelection([]);
      setBankSearchQuery('');
      setBankTopicFilter('');
    } catch (err) {
      console.error("Error importing from bank:", err);
      setAuthError("Failed to import questions.");
      setTimeout(() => setAuthError(''), 4000);
    } finally {
      setIsUploadingCSV(false);
    }
  };

  // --- VIEWS ---

  const renderContent = () => {
    if (appState === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted font-bold">Loading Platform...</p>
        </div>
      );
    }

    if (appState === 'print_exam' && selectedExam) {
      const qs = getExamQuestionsFromDB();
      return (
         <div className="bg-white min-h-screen text-black print-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'serif' }}>
             <div className="no-print flex justify-between mb-8 bg-slate-100 p-4 rounded-lg items-center border border-slate-200 shadow-sm">
                 <button onClick={() => { setAppState('admin'); setSelectedExam(null); }} className="btn btn-outline" style={{ background: 'white' }}><ChevronLeft size={18}/> Back</button>
                 <div className="flex gap-4 items-center">
                     <select value={printMode} onChange={e => setPrintMode(e.target.value)} className="input no-icon w-auto" style={{ background: 'white', padding: '0.5rem 1rem' }}>
                         <option value="student">Student Copy (Questions Only)</option>
                         <option value="key">Answer Key (Highlights + Explanations)</option>
                     </select>
                     <button onClick={() => window.print()} className="btn btn-primary"><Printer size={18}/> Print PDF</button>
                 </div>
             </div>
             
             {/* Printable Header */}
             <div className="pb-4 mb-8" style={{ borderBottom: '2px solid black' }}>
                 <h1 className="text-3xl font-bold mb-4">{selectedExam.title} {printMode === 'key' && <span style={{ color: '#dc2626' }}>- ANSWER KEY</span>}</h1>
                 <div className="flex justify-between font-bold" style={{ fontSize: '1.1rem' }}>
                     <div>Name: __________________________________</div>
                     <div>Date: _______________</div>
                     <div>Score: _______ / {qs.length}</div>
                 </div>
             </div>
             
             {/* Printable Body */}
             <div>
                 {qs.map((q, idx) => (
                     <div key={q.id} className="mb-8 page-break-avoid">
                         <div className="flex gap-3 mb-3">
                             <span className="font-bold text-lg">{idx + 1}.</span>
                             <div className="flex-1 text-lg"><LatexText text={q.text} /></div>
                         </div>
                         {q.imageUrl && <img src={q.imageUrl} alt="Question" className="mb-4" style={{ maxHeight: '250px', objectFit: 'contain' }} />}
                         
                         <div className="grid grid-cols-2 gap-4 pl-8 mb-2">
                             {q.options.map(opt => {
                                 const isCorrect = printMode === 'key' && q.correctId === opt.id;
                                 return (
                                     <div key={opt.id} className="flex gap-3 items-start">
                                         <span className={`font-bold ${isCorrect ? 'text-blue-700' : ''}`} style={isCorrect ? { backgroundColor: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', border: '1px solid #bfdbfe' } : {}}>{opt.id})</span>
                                         <span className={isCorrect ? 'font-bold text-blue-800' : ''}><LatexText text={opt.text} /></span>
                                     </div>
                                 );
                             })}
                         </div>
                         
                         {printMode === 'key' && (
                             <div className="mt-4 pl-8 pt-3 pb-3 pr-4 text-sm" style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6' }}>
                                 <strong style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e3a8a', display: 'block', marginBottom: '0.25rem' }}>Explanation:</strong>
                                 <div style={{ color: '#334155' }}><LatexText text={q.explanation || 'No detailed explanation provided.'} /></div>
                                 {q.explanationImageUrl && <img src={q.explanationImageUrl} alt="Explanation Graphic" style={{ maxHeight: '150px', objectFit: 'contain', marginTop: '0.5rem' }} />}
                             </div>
                         )}
                     </div>
                 ))}
             </div>
         </div>
      );
    }

    if (appState === 'login') {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ padding: '1.5rem' }}>
          <div className="card container-sm" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
            <div className="card-header">
              <div className={`card-header-icon ${loginMode === 'admin' ? 'admin' : ''}`}>
                {loginMode === 'admin' ? <Shield size={32} /> : <Calculator size={32} />}
              </div>
              <h1 className="title" style={{ color: 'white' }}>Exam Platform</h1>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Interactive Assessment Environment</p>
            </div>
            <div style={{ padding: '2rem' }}>
              
              <div className="role-toggle">
                <button type="button" onClick={() => { setLoginMode('student'); setAuthError(''); setIsRegistering(false); }} className={`role-btn ${loginMode === 'student' ? 'active' : ''}`}>Student</button>
                <button type="button" onClick={() => { setLoginMode('teacher'); setAuthError(''); setIsRegistering(false); }} className={`role-btn ${loginMode === 'teacher' ? 'active' : ''}`}>Teacher</button>
                <button type="button" onClick={() => { setLoginMode('admin'); setAuthError(''); setIsRegistering(false); }} className={`role-btn ${loginMode === 'admin' ? 'active' : ''}`}>Admin</button>
              </div>

              {authError && (
                <div className="error-message mb-6">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="success-message mb-6">
                  {authSuccess}
                </div>
              )}

              <form onSubmit={handleAuthSubmit}>
                <h2 className="subtitle text-center mb-6">
                  {loginMode === 'admin' ? 'System Admin Sign In' : (loginMode === 'teacher' ? 'Teacher Sign In' : (isRegistering ? 'Create Student Account' : 'Student Sign In'))}
                </h2>
                
                {isRegistering && loginMode === 'student' && (
                  <div className="input-group">
                    <label className="label">Full Name</label>
                    <div className="input-wrapper">
                      <User size={18} className="input-icon" />
                      <input type="text" required value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} className="input" placeholder="e.g. John Doe" />
                    </div>
                  </div>
                )}

                <div className="input-group">
                  <label className="label">Email Address</label>
                  <div className="input-wrapper">
                    <Mail size={18} className="input-icon" />
                    <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="input" placeholder={loginMode === 'admin' ? "admin@system.com" : (loginMode === 'teacher' ? "teacher@school.edu" : "student@school.edu")} />
                  </div>
                </div>

                <div className="input-group">
                  <label className="label">Password</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input type="password" required value={authForm.password || ''} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} className="input" placeholder="••••••••" />
                  </div>
                </div>

                <button type="submit" disabled={isSubmittingAuth} className="btn btn-primary w-full mt-4">
                  {isSubmittingAuth ? 'Processing...' : (isRegistering && loginMode === 'student' ? 'Complete Registration' : 'Secure Sign In')} <ArrowRight size={18} />
                </button>
              </form>

              {loginMode === 'student' && (
                <div className="text-center mt-6">
                  <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); setAuthSuccess(''); setAuthForm({ name: '', email: '', password: '' }); }} className="btn-link">
                    {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Register"}
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      );
    }

    if (appState === 'superadmin') {
      return (
        <div className="min-h-screen">
          <nav className="nav dark">
            <div className="nav-brand"><Shield size={24} color="#a78bfa" /> <span className="hidden-sm">System Admin Portal</span></div>
            <div className="flex items-center gap-4">
              <span className="badge hidden-sm">Admin Access</span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}><LogOut size={16} /> <span className="hidden-sm">Logout</span></button>
            </div>
          </nav>
          <main className="container">
             <div className="grid md:grid-cols-2 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
               
               <div className="card">
                 <h2 className="title mb-6 flex items-center gap-3"><User size={24} color="#2563eb" /> Register New Teacher</h2>
                 {authError && <div className="error-message mb-4">{authError}</div>}
                 {authSuccess && <div className="success-message mb-4">{authSuccess}</div>}
                 <form onSubmit={handleRegisterTeacher}>
                    <div className="input-group">
                      <label className="label">Teacher Full Name</label>
                      <div className="input-wrapper">
                        <User size={18} className="input-icon" />
                        <input type="text" required value={newTeacherForm.name} onChange={(e) => setNewTeacherForm({...newTeacherForm, name: e.target.value})} className="input" placeholder="e.g. Jane Smith" />
                      </div>
                    </div>
                    <div className="input-group">
                      <label className="label">Teacher Email</label>
                      <div className="input-wrapper">
                        <Mail size={18} className="input-icon" />
                        <input type="email" required value={newTeacherForm.