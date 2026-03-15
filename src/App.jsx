import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, ChevronLeft, ChevronRight, Check, X, AlertTriangle, Calculator, 
  LayoutGrid, User, Lock, Mail, LogOut, ArrowRight, History, Calendar, 
  Award, Settings, Plus, Trash2, Edit2, Save, BookOpen, FileText, Shield, Key,
  Download, Upload, Image as ImageIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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

  // Self-closing span prevents React from conflicting with our innerHTML DOM mutations
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

// --- SECURITY UTILITY: PASSWORD HASHING ---
const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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
  timeLimit: 30
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
  .flex-1 { flex: 1; }
  
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
  .option-letter { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; border: 2px solid #cbd5e1; border-radius: 0.5rem; margin-right: 1rem; font-weight: 700; background: #f1f5f9; color: #64748b; }
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
  
  .error-message { background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; padding: 1rem; border-radius: 0.75rem; font-weight: 600; text-align: center; font-size: 0.875rem; }
  .success-message { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 0.75rem; font-weight: 600; text-align: center; font-size: 0.875rem; }

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
  
  // Persistent active session handled locally for multi-device sync
  const [activeSession, setActiveSession] = useState(() => {
    const saved = localStorage.getItem('olyst_session');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      localStorage.removeItem('olyst_session');
      return null;
    }
  });

  const [user, setUser] = useState(null); // Keep for Firebase backend auth

  // Login Form
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loginMode, setLoginMode] = useState('student'); // 'student', 'teacher', or 'admin'
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
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

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

    return () => { unsubAdmins(); unsubTeachers(); unsubStudents(); unsubExams(); unsubQuestions(); unsubAllResults(); };
  }, []);

  // 2. Routing based on Active Session
  useEffect(() => {
    if (activeSession) {
      if (activeSession.role === 'superadmin') {
        setAppState('superadmin');
      } else if (activeSession.role === 'teacher') {
        setAppState('admin');
        setAdminView('list_exams');
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const userEmail = String(authForm.email || '').toLowerCase().trim();
    const userPasswordHash = await hashPassword(authForm.password || '');

    try {
      if (loginMode === 'admin') {
        const adminUser = adminsList.find(a => String(a.email || '').toLowerCase().trim() === userEmail && String(a.password || '').trim() === userPasswordHash);
        if (adminUser) {
          const session = { role: 'superadmin', name: 'System Admin', email: userEmail, userId: adminUser.id };
          localStorage.setItem('olyst_session', JSON.stringify(session));
          setActiveSession(session);
        } else {
          setAuthError("Invalid admin credentials. Please check your system admin email and password.");
        }
      } else if (loginMode === 'teacher') {
        const teacher = teachersList.find(t => String(t.email || '').toLowerCase().trim() === userEmail && String(t.password || '').trim() === userPasswordHash);
        if (teacher) {
          const session = { role: 'teacher', name: teacher.name || 'Teacher', email: userEmail, studentId: 'teacher', userId: teacher.id };
          localStorage.setItem('olyst_session', JSON.stringify(session));
          setActiveSession(session);
        } else {
          setAuthError("Invalid teacher credentials. Please verify your email and password or contact the system admin.");
        }
      } else {
        if (isRegistering) {
          const existingStudent = studentProfiles.find(s => String(s.email || '').toLowerCase().trim() === userEmail);
          if (existingStudent) {
            setAuthError("This email is already registered. Please click 'Sign in' instead.");
          } else {
            const newStudentId = `stu_${Date.now()}`;
            const newDocRef = await addDoc(collection(db, `artifacts/${appId}/public/data/studentProfiles`), {
              email: userEmail, password: userPasswordHash, name: authForm.name, studentId: newStudentId, createdAt: Date.now()
            });
            const session = { role: 'student', name: authForm.name, email: userEmail, studentId: newStudentId, userId: newDocRef.id };
            localStorage.setItem('olyst_session', JSON.stringify(session));
            setActiveSession(session);
          }
        } else {
          const student = studentProfiles.find(s => String(s.email || '').toLowerCase().trim() === userEmail && String(s.password || '').trim() === userPasswordHash);
          if (student) {
            const session = { role: 'student', name: student.name, email: userEmail, studentId: student.studentId, userId: student.id };
            localStorage.setItem('olyst_session', JSON.stringify(session));
            setActiveSession(session);
          } else {
            setAuthError("Invalid student credentials. Please verify your email and password.");
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

  const startExam = () => {
    if (currentQuestions.length === 0) return;
    setAppState('exam');
    setTimeLeft((selectedExam.timeLimit || 30) * 60);
    setAnswers({});
    setCurrentQIndex(0);
  };

  const handleSelectOption = (optionId) => {
    setAnswers({ ...answers, [currentQuestions[currentQIndex].id]: optionId });
  };

  const finishExam = async () => {
    let score = 0;
    currentQuestions.forEach(q => {
      if (answers[q.id] === q.correctId) score++;
    });
    const percentage = Math.round((score / currentQuestions.length) * 100);
    setCurrentScore({ score, percentage });

    if (activeSession && activeSession.role === 'student' && user) {
      try {
        const resultsRef = collection(db, `artifacts/${appId}/users/${activeSession.studentId}/results`);
        await addDoc(resultsRef, {
          examId: selectedExam.id,
          examTitle: selectedExam.title,
          score,
          total: currentQuestions.length,
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
    const unansweredCount = currentQuestions.length - Object.keys(answers).length;
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
    setEditingExamDetails({ isNew: true, title: '', description: '', timeLimit: 30 });
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

  const openNewQuestion = () => {
    setEditingQuestion({
      isNew: true, topic: '', text: '',
      options: [ { id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' } ],
      correctId: 'A', explanation: ''
    });
    setAdminView('edit_question');
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    if (!activeSession || !selectedExam) return;
    
    const questionsRef = collection(db, `artifacts/${appId}/public/data/questions`);
    const qData = {
      examId: selectedExam.id, topic: editingQuestion.topic, text: editingQuestion.text,
      options: editingQuestion.options, correctId: editingQuestion.correctId,
      explanation: editingQuestion.explanation, order: editingQuestion.order || Date.now()
    };

    try {
      if (editingQuestion.isNew) {
        await addDoc(questionsRef, qData);
      } else {
        const docRef = doc(db, `artifacts/${appId}/public/data/questions/${editingQuestion.id}`);
        await updateDoc(docRef, qData);
      }
      setEditingQuestion(null);
      setAdminView('manage_questions');
    } catch (err) {
      console.error("Error saving question:", err);
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

  // --- CSV UPLOAD/DOWNLOAD HANDLERS ---
  const handleDownloadTemplate = () => {
    // Template formatted perfectly to show how to use $LaTeX$ inside the CSV
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

  // --- VIEWS ---

  const renderContent = () => {
    if (appState === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted font-bold">Loading Platform...</p>
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
              <h1 className="title" style={{ color: 'white' }}>Olyst Platform</h1>
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
                  <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); setAuthForm({ name: '', email: '', password: '' }); }} className="btn-link">
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
                        <input type="email" required value={newTeacherForm.email} onChange={(e) => setNewTeacherForm({...newTeacherForm, email: e.target.value})} className="input" placeholder="teacher@school.edu" />
                      </div>
                    </div>
                    <div className="input-group mb-6">
                      <label className="label">Temporary Password</label>
                      <div className="input-wrapper">
                        <Lock size={18} className="input-icon" />
                        <input type="text" required value={newTeacherForm.password} onChange={(e) => setNewTeacherForm({...newTeacherForm, password: e.target.value})} className="input" placeholder="Assign a password" />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary w-full"><Plus size={18} /> Create Teacher Account</button>
                 </form>
               </div>

               <div className="card">
                 <h2 className="title mb-6 flex items-center gap-3"><Key size={24} color="#2563eb" /> Password Hash Generator</h2>
                 <p className="text-muted mb-4">Generate exact SHA-256 hashes for manual database entry.</p>
                 <div className="input-group mb-4">
                   <div className="input-wrapper">
                     <Lock size={18} className="input-icon" />
                     <input type="text" value={hashInput} onChange={async (e) => {
                       setHashInput(e.target.value);
                       if(e.target.value) setGeneratedHash(await hashPassword(e.target.value));
                       else setGeneratedHash('');
                     }} className="input" placeholder="Type password here..." />
                   </div>
                 </div>
                 {generatedHash && (
                   <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #cbd5e1' }}>
                     {generatedHash}
                   </div>
                 )}
               </div>

               <div className="card col-span-2" style={{ padding: 0, overflow: 'hidden' }}>
                 <div className="card-header" style={{ margin: 0, borderRadius: 0, padding: '1.5rem', textAlign: 'left', background: '#f8fafc', color: '#0f172a', borderBottom: '1px solid #e2e8f0' }}>
                   <h2 className="subtitle" style={{ margin: 0 }}>Registered Teachers</h2>
                 </div>
                 <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                   {teachersList.length === 0 ? (
                     <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No teachers registered yet.</div>
                   ) : (
                     teachersList.map((teacher, idx) => (
                       <div key={teacher.id || idx} className="admin-list-item" style={{ alignItems: 'center' }}>
                         <div className="flex-1">
                           <div className="font-bold">{teacher.name || 'Unnamed Teacher'}</div>
                           <div className="text-muted" style={{ fontSize: '0.875rem' }}>{teacher.email}</div>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="badge">Active</div>
                           <button onClick={() => handleDeleteTeacher(teacher.id)} className="btn-icon btn-icon-danger" title="Delete Teacher"><Trash2 size={18} /></button>
                         </div>
                       </div>
                     ))
                   )}
                 </div>
               </div>

             </div>
          </main>
        </div>
      );
    }

    if (appState === 'admin') {
      return (
        <div className="min-h-screen">
          <nav className="nav dark">
            <div className="nav-brand"><Settings size={24} color="#60a5fa" /> <span className="hidden-sm">Olyst Admin Portal</span></div>
            <div className="flex items-center gap-4">
              <span className="badge hidden-sm">Teacher: {activeSession?.name}</span>
              <button onClick={() => { setAuthError(''); setAuthSuccess(''); setAdminView('change_password'); }} className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <Key size={16} /> <span className="hidden-sm">Password</span>
              </button>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}><LogOut size={16} /> <span className="hidden-sm">Logout</span></button>
            </div>
          </nav>
          <main className="container">
            {adminView === 'change_password' && (
              <div className="card container-sm" style={{ padding: 0, overflow: 'hidden', margin: '0 auto' }}>
                <div className="nav">
                  <h2 className="subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Key size={20} color="#2563eb" /> Update Password
                  </h2>
                  <button onClick={() => setAdminView('list_exams')} className="btn-icon"><X size={24} /></button>
                </div>
                <form onSubmit={handleChangePassword} style={{ padding: '2rem' }}>
                  {authError && <div className="error-message mb-4">{authError}</div>}
                  {authSuccess && <div className="success-message mb-4">{authSuccess}</div>}
                  <div className="input-group">
                    <label className="label">New Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" />
                      <input type="password" required minLength="6" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="input" placeholder="Enter new password" />
                    </div>
                  </div>
                  <div className="input-group mb-8">
                    <label className="label">Confirm New Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" />
                      <input type="password" required minLength="6" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="input" placeholder="Confirm new password" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={() => setAdminView('list_exams')} className="btn btn-outline">Cancel</button>
                    <button type="submit" className="btn btn-primary"><Save size={18} /> Update Password</button>
                  </div>
                </form>
              </div>
            )}

            {adminView === 'list_exams' && (
              <>
                <div className="flex justify-between items-center mb-6 flex-col-sm gap-4">
                  <div>
                    <h1 className="title">Exam Dashboard</h1>
                    <p className="text-muted">Create and manage your assessments.</p>
                  </div>
                  <div className="flex gap-2 w-full-sm">
                    {exams.length === 0 && (
                      <button onClick={seedDemoExam} className="btn btn-outline flex-1"><BookOpen size={18} /> Load Demo</button>
                    )}
                    <button onClick={openNewExam} className="btn btn-primary flex-1"><Plus size={18} /> Create Exam</button>
                  </div>
                </div>
                {exams.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} className="text-muted" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 className="subtitle">No exams found</h3>
                    <p className="text-muted mb-6">Start building your first exam to evaluate students.</p>
                    <button onClick={openNewExam} className="btn btn-outline">Create Exam</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2">
                    {exams.map(exam => {
                      const qCount = allQuestions.filter(q => q.examId === exam.id).length;
                      return (
                        <div key={exam.id} className="exam-card">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="subtitle" style={{ margin: 0 }}>{exam.title}</h3>
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingExamDetails(exam); setAdminView('edit_exam_details'); }} className="btn-icon"><Edit2 size={16} /></button>
                              <button onClick={() => deleteExam(exam.id)} className="btn-icon btn-icon-danger"><Trash2 size={16} /></button>
                            </div>
                          </div>
                          <p className="text-muted line-clamp-2" style={{ flex: 1, marginBottom: '1.5rem', fontSize: '0.875rem' }}>{exam.description}</p>
                          <div className="exam-meta">
                            <div className="flex items-center gap-2"><LayoutGrid size={14}/> {qCount} Questions</div>
                            <div className="flex items-center gap-2"><Clock size={14}/> {exam.timeLimit} Min</div>
                          </div>
                          <button onClick={() => { setSelectedExam(exam); setAdminView('manage_questions'); }} className="btn btn-secondary w-full">Manage Questions</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {adminView === 'edit_exam_details' && editingExamDetails && (
              <div className="card container-sm" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="nav">
                  <h2 className="subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Settings size={20} color="#2563eb" /> {editingExamDetails.isNew ? "Create Exam" : "Exam Settings"}
                  </h2>
                  <button onClick={() => { setEditingExamDetails(null); setAdminView('list_exams'); }} className="btn-icon"><X size={24} /></button>
                </div>
                <form onSubmit={saveExamDetails} style={{ padding: '2rem' }}>
                  <div className="input-group">
                    <label className="label">Exam Title</label>
                    <input required type="text" value={editingExamDetails.title} onChange={e => setEditingExamDetails({...editingExamDetails, title: e.target.value})} className="input no-icon" placeholder="e.g. Midterm Assessment" />
                  </div>
                  <div className="input-group">
                    <label className="label">Description</label>
                    <textarea required rows={3} value={editingExamDetails.description} onChange={e => setEditingExamDetails({...editingExamDetails, description: e.target.value})} className="input no-icon" placeholder="Provide instructions..." />
                  </div>
                  <div className="input-group mb-8">
                    <label className="label">Time Limit (Minutes)</label>
                    <input required type="number" min="1" max="300" value={editingExamDetails.timeLimit} onChange={e => setEditingExamDetails({...editingExamDetails, timeLimit: e.target.value})} className="input no-icon" />
                  </div>
                  <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={() => { setEditingExamDetails(null); setAdminView('list_exams'); }} className="btn btn-outline">Cancel</button>
                    <button type="submit" className="btn btn-primary"><Save size={18} /> Save Exam</button>
                  </div>
                </form>
              </div>
            )}

            {adminView === 'manage_questions' && selectedExam && (
              <>
                <button onClick={() => { setSelectedExam(null); setAdminView('list_exams'); setAuthError(''); setAuthSuccess(''); }} className="btn btn-outline mb-6"><ChevronLeft size={16} /> Back to Exams</button>
                <div className="flex justify-between items-center mb-6 flex-col-sm gap-4">
                  <div>
                    <h1 className="title">{selectedExam.title} - Questions</h1>
                    <p className="text-muted">Manage the questions for this specific assessment.</p>
                  </div>
                  <div className="flex gap-2 w-full-sm" style={{ flexWrap: 'wrap' }}>
                    <button onClick={handleDownloadTemplate} className="btn btn-outline flex-1" title="Download CSV Template" style={{ margin: 0, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                      <Download size={18} /> <span className="hidden-sm">Template</span>
                    </button>
                    <input 
                      type="file" 
                      accept=".csv" 
                      id="csv-upload" 
                      style={{ display: 'none' }} 
                      onChange={handleCSVUpload} 
                    />
                    <label htmlFor="csv-upload" className={`btn btn-outline flex-1 ${isUploadingCSV ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} style={{ margin: 0, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                      <Upload size={18} /> <span className="hidden-sm">{isUploadingCSV ? 'Uploading...' : 'Import CSV'}</span>
                    </label>
                    <button onClick={openNewQuestion} className="btn btn-primary flex-1" style={{ whiteSpace: 'nowrap' }}>
                      <Plus size={18} /> <span className="hidden-sm">Add Question</span>
                    </button>
                  </div>
                </div>

                {authError && <div className="error-message mb-4">{authError}</div>}
                {authSuccess && <div className="success-message mb-4">{authSuccess}</div>}

                {currentQuestions.length === 0 ? (
                  <div className="empty-state">
                    <LayoutGrid size={48} className="text-muted" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                    <h3 className="subtitle">No questions yet</h3>
                    <p className="text-muted mb-6">Add your first question to this exam.</p>
                    <button onClick={openNewQuestion} className="btn btn-outline">Create Question</button>
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {currentQuestions.map((q, idx) => (
                      <div key={q.id} className="admin-list-item flex-col-sm">
                        <div className="flex gap-4 flex-1 w-full-sm">
                          <div className="item-number">{idx + 1}</div>
                          <div className="flex-1">
                            <div className="text-muted font-bold mb-2" style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>{q.topic}</div>
                            <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}><LatexText text={q.text} /></p>
                            <div className="grid grid-cols-2 gap-2" style={{ fontSize: '0.875rem' }}>
                              {q.options.map(opt => (
                                <div key={opt.id} style={{ padding: '0.5rem', border: '1px solid', borderColor: q.correctId === opt.id ? '#bbf7d0' : '#e2e8f0', backgroundColor: q.correctId === opt.id ? '#f0fdf4' : 'white', borderRadius: '0.5rem', color: q.correctId === opt.id ? '#166534' : '#475569' }}>
                                  <strong>{opt.id}.</strong> <LatexText text={opt.text} />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingQuestion(q); setAdminView('edit_question'); }} className="btn-icon"><Edit2 size={20} /></button>
                          <button onClick={() => deleteQuestion(q.id)} className="btn-icon btn-icon-danger"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {adminView === 'edit_question' && editingQuestion && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="nav">
                  <h2 className="subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Edit2 size={20} color="#2563eb" /> {editingQuestion.isNew ? "Create Question" : "Edit Question"}
                  </h2>
                  <button onClick={() => { setEditingQuestion(null); setAdminView('manage_questions'); }} className="btn-icon"><X size={24} /></button>
                </div>
                <form onSubmit={saveQuestion} style={{ padding: '2rem' }}>
                  
                  <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #bfdbfe', fontSize: '0.875rem', color: '#1e3a8a', display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                    <Calculator size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Visual Math Editor Enabled:</strong> Click into the text boxes below. A virtual keyboard will appear allowing you to visually build math equations without needing to write code!
                    </div>
                  </div>

                  <div className="admin-form-grid mb-6">
                    <div className="input-group col-span-2">
                      <label className="label">Topic / Category</label>
                      <input required type="text" value={editingQuestion.topic} onChange={e => setEditingQuestion({...editingQuestion, topic: e.target.value})} className="input no-icon" placeholder="e.g. Algebra" />
                    </div>
                    
                    <div className="input-group col-span-2">
                      <label className="label">Question Text</label>
                      <MathLiveInput 
                        value={editingQuestion.text} 
                        onChange={newText => setEditingQuestion({...editingQuestion, text: newText})}
                        placeholder="What is the question?" 
                      />
                    </div>
                    
                    {editingQuestion.options.map((opt, i) => (
                      <div className="input-group" key={opt.id}>
                        <label className="label">Option {opt.id}</label>
                        <div style={{ border: editingQuestion.correctId === opt.id ? '2px solid #22c55e' : 'none', borderRadius: '0.75rem', padding: editingQuestion.correctId === opt.id ? '2px' : '0' }}>
                           <MathLiveInput 
                             value={opt.text} 
                             onChange={newText => { const newOpts = [...editingQuestion.options]; newOpts[i].text = newText; setEditingQuestion({...editingQuestion, options: newOpts}); }}
                             placeholder={`Option ${opt.id}`}
                           />
                        </div>
                      </div>
                    ))}
                    
                    <div className="input-group col-span-2" style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <label className="label" style={{ margin: 0, color: '#1e3a8a' }}>Correct Answer:</label>
                      <select value={editingQuestion.correctId} onChange={e => setEditingQuestion({...editingQuestion, correctId: e.target.value})} className="input no-icon" style={{ width: 'auto', fontWeight: 'bold', color: '#1d4ed8', padding: '0.5rem 2rem 0.5rem 1rem' }}>
                        <option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                      </select>
                    </div>
                    
                    <div className="input-group col-span-2 mb-0">
                      <label className="label">Explanation (Shown after exam)</label>
                      <MathLiveInput 
                        value={editingQuestion.explanation} 
                        onChange={newText => setEditingQuestion({...editingQuestion, explanation: newText})}
                        placeholder="Explain why the answer is correct..." 
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={() => { setEditingQuestion(null); setAdminView('manage_questions'); }} className="btn btn-outline">Cancel</button>
                    <button type="submit" className="btn btn-primary"><Save size={18} /> Save Question</button>
                  </div>
                </form>
              </div>
            )}
          </main>
        </div>
      );
    }

    if (appState === 'home') {
      return (
        <div className="min-h-screen">
          <nav className="nav">
            <div className="nav-brand"><Calculator color="#2563eb" size={24} /> Olyst Student</div>
            <div className="flex items-center gap-4">
              <span className="badge hidden-sm"><User size={16} /> {activeSession?.name}</span>
              <button onClick={() => { setAuthError(''); setAuthSuccess(''); setHomeView('change_password'); }} className="btn" style={{ padding: '0.5rem 1rem', background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                <Key size={16} /> <span className="hidden-sm">Password</span>
              </button>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}><LogOut size={16} /> <span className="hidden-sm">Logout</span></button>
            </div>
          </nav>
          <div className="container">
            {homeView === 'change_password' ? (
              <div className="card container-sm" style={{ padding: 0, overflow: 'hidden', margin: '0 auto' }}>
                <div className="nav">
                  <h2 className="subtitle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Key size={20} color="#2563eb" /> Update Password
                  </h2>
                  <button onClick={() => setHomeView('dashboard')} className="btn-icon"><X size={24} /></button>
                </div>
                <form onSubmit={handleChangePassword} style={{ padding: '2rem' }}>
                  {authError && <div className="error-message mb-4">{authError}</div>}
                  {authSuccess && <div className="success-message mb-4">{authSuccess}</div>}
                  <div className="input-group">
                    <label className="label">New Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" />
                      <input type="password" required minLength="6" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="input" placeholder="Enter new password" />
                    </div>
                  </div>
                  <div className="input-group mb-8">
                    <label className="label">Confirm New Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" />
                      <input type="password" required minLength="6" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="input" placeholder="Confirm new password" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <button type="button" onClick={() => setHomeView('dashboard')} className="btn btn-outline">Cancel</button>
                    <button type="submit" className="btn btn-primary"><Save size={18} /> Update Password</button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="title flex items-center gap-3 mb-6"><BookOpen size={28} color="#2563eb" /> Available Assessments</h2>
                  {exams.length === 0 ? (
                    <div className="empty-state">No exams are currently available. Please check back later.</div>
                  ) : (
                    <div className="grid grid-cols-3">
                      {exams.map(exam => {
                        const qCount = allQuestions.filter(q => q.examId === exam.id).length;
                        return (
                          <div key={exam.id} className="exam-card">
                            <h3 className="subtitle" style={{ marginBottom: '0.5rem' }}>{exam.title}</h3>
                            <p className="text-muted line-clamp-3" style={{ flex: 1, marginBottom: '1.5rem', fontSize: '0.875rem' }}>{exam.description}</p>
                            <div className="exam-meta">
                              <div className="flex items-center gap-2"><LayoutGrid size={14} color="#3b82f6"/> {qCount} Questions</div>
                              <div className="flex items-center gap-2"><Clock size={14} color="#3b82f6"/> {exam.timeLimit} Min</div>
                            </div>
                            <button onClick={() => selectExamForTaking(exam)} className="btn btn-outline w-full" style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}>Select Exam <ChevronRight size={16}/></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <div className="card">
                  <h2 className="title flex items-center gap-3 mb-6"><History size={28} color="#2563eb" /> Your Exam History</h2>
                  {pastResults.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem' }}>
                      <Award size={32} className="text-muted" style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                      <p>You haven't taken any exams yet.</p>
                    </div>
                  ) : (
                    <div>
                      {pastResults.map(result => (
                        <div key={result.id} className="history-item">
                          <div className="flex items-center gap-4">
                            <div className="history-icon"><Calendar size={20} /></div>
                            <div>
                              <p className="font-bold">{result.examTitle || 'Practice Exam'}</p>
                              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Taken on {new Date(result.timestamp).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right card" style={{ padding: '0.75rem 1rem', minWidth: '100px' }}>
                            <p className={`font-bold text-2xl ${result.percentage >= 80 ? 'text-success' : result.percentage >= 50 ? 'text-warning' : 'text-danger'}`}>{result.percentage}%</p>
                            <p className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{result.score} / {result.total}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    if (appState === 'exam_intro' && selectedExam) {
      return (
        <div className="min-h-screen">
          <nav className="nav">
            <button onClick={() => { setSelectedExam(null); setAppState('home'); }} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}><ChevronLeft size={16} /> Back</button>
          </nav>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="card text-center relative" style={{ maxWidth: '42rem', width: '100%', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '8px', background: 'linear-gradient(to right, #60a5fa, #4f46e5)' }}></div>
              <h1 className="title mb-4" style={{ marginTop: '1rem' }}>{selectedExam.title}</h1>
              <p className="text-muted mb-8" style={{ fontSize: '1.125rem' }}>{selectedExam.description}</p>
              
              <div className="flex justify-center items-center gap-4 mb-8 flex-col-sm">
                <div className="badge" style={{ padding: '1rem 2rem', fontSize: '1rem' }}><LayoutGrid size={20} color="#3b82f6"/> {currentQuestions.length} Questions</div>
                <div className="badge" style={{ padding: '1rem 2rem', fontSize: '1rem' }}><Clock size={20} color="#3b82f6"/> {selectedExam.timeLimit} Minutes</div>
              </div>
              
              <button onClick={startExam} disabled={currentQuestions.length === 0} className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.125rem' }}>
                {currentQuestions.length === 0 ? 'Exam Not Ready' : 'Start Assessment Now'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (appState === 'exam' && currentQuestions[currentQIndex]) {
      const currentQuestion = currentQuestions[currentQIndex];
      return (
        <div className="min-h-screen">
          <header className="nav">
            <div className="nav-brand flex-1"><Calculator color="#2563eb" size={24}/> <span className="hidden-sm">{selectedExam.title}</span></div>
            <div className={`timer mx-4 ${timeLeft < 300 ? 'urgent' : ''}`}><Clock size={18}/> {formatTime(timeLeft)}</div>
            <button className="btn btn-secondary" onClick={handleAttemptSubmit}>Submit</button>
          </header>
          
          <main className="container flex-col" style={{ flex: 1 }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-muted font-bold" style={{ color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{currentQuestion.topic}</div>
                <h2 className="subtitle text-muted">Question {currentQIndex + 1} of {currentQuestions.length}</h2>
              </div>
            </div>
            
            <div className="question-box">
              <p style={{ fontSize: '1.25rem', fontWeight: 500 }}><LatexText text={currentQuestion.text} /></p>
            </div>
            
            <div className="mb-8">
              {currentQuestion.options.map(option => {
                const isSelected = answers[currentQuestion.id] === option.id;
                return (
                  <button key={option.id} onClick={() => handleSelectOption(option.id)} className={`option-btn ${isSelected ? 'selected' : ''}`}>
                    <div className="option-letter">{option.id}</div>
                    <span><LatexText text={option.text} /></span>
                  </button>
                );
              })}
            </div>
            
            <div className="progress-nav flex-col-sm gap-4">
              <button className="btn btn-outline w-full-sm" disabled={currentQIndex === 0} onClick={() => setCurrentQIndex(prev => prev - 1)}><ChevronLeft size={20}/> Previous</button>
              
              <div className="progress-grid hidden-sm">
                {currentQuestions.map((q, idx) => (
                  <button key={q.id} onClick={() => setCurrentQIndex(idx)} className={`progress-dot ${currentQIndex === idx ? 'current' : ''} ${answers[q.id] ? 'answered' : ''}`}>{idx + 1}</button>
                ))}
              </div>
              
              {currentQIndex === currentQuestions.length - 1 ? (
                <button className="btn btn-primary w-full-sm" onClick={handleAttemptSubmit}>Finish <Check size={20}/></button>
              ) : (
                <button className="btn btn-secondary w-full-sm" onClick={() => setCurrentQIndex(prev => prev + 1)}>Next <ChevronRight size={20}/></button>
              )}
            </div>
          </main>

          {showSubmitModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="flex items-center justify-center gap-4 mb-4 text-warning">
                  <div className="card-header-icon" style={{ margin: 0, color: '#f59e0b', background: '#fef3c7', borderColor: '#fde68a' }}><AlertTriangle size={32} /></div>
                </div>
                <h3 className="title">Unanswered Questions</h3>
                <p className="text-muted mb-8" style={{ fontSize: '1.125rem' }}>You have <strong style={{ color: '#0f172a' }}>{currentQuestions.length - Object.keys(answers).length}</strong> unanswered questions. Are you sure you want to submit?</p>
                <div className="flex gap-3 justify-center flex-col-sm">
                  <button onClick={() => setShowSubmitModal(false)} className="btn btn-outline w-full-sm">Return to Exam</button>
                  <button onClick={finishExam} className="btn btn-primary w-full-sm">Submit Anyway</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (appState === 'results') {
      const { score, percentage } = currentScore;
      return (
        <div className="min-h-screen">
          <div className="container">
            <div className="card text-center mb-8">
              <h1 className="title mb-2">Exam Completed</h1>
              <p className="text-muted mb-8">Your score for <strong>{selectedExam.title}</strong> has been saved.</p>
              
              <div className="result-circle">
                <div className="result-score" style={{ color: percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#f59e0b' : '#ef4444' }}>{score}</div>
                <div className="text-muted font-bold">out of {currentQuestions.length}</div>
              </div>
              
              <h2 className={`title mb-8 ${percentage >= 80 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-danger'}`}>{percentage}% Score</h2>
              <button onClick={() => { setSelectedExam(null); setAppState('home'); }} className="btn btn-secondary">Return to Dashboard</button>
            </div>

            <h3 className="title mb-6 flex items-center gap-3"><BookOpen size={24} color="#2563eb" /> Detailed Review</h3>
            <div>
              {currentQuestions.map((q, idx) => {
                const userAnswer = answers[q.id];
                const isCorrect = userAnswer === q.correctId;
                const isSkipped = userAnswer === undefined;
                
                return (
                  <div key={q.id} className="review-item">
                    <div className={`review-header ${isCorrect ? 'correct' : isSkipped ? '' : 'incorrect'}`}>
                      <div className={`review-icon ${isCorrect ? 'bg-success' : isSkipped ? 'bg-muted' : 'bg-danger'}`}>
                        {isCorrect ? <Check size={16} /> : isSkipped ? <span style={{ fontSize: '1rem' }}>-</span> : <X size={16} />}
                      </div>
                      Question {idx + 1}: {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                    </div>
                    <div className="review-body">
                      <p className="subtitle mb-6"><LatexText text={q.text} /></p>
                      <div className="grid grid-cols-2 mb-6">
                        {q.options.map(opt => {
                          const isThisUserChoice = userAnswer === opt.id;
                          const isThisCorrectChoice = q.correctId === opt.id;
                          return (
                            <div key={opt.id} className={`review-option ${isThisCorrectChoice ? 'is-correct' : (isThisUserChoice && !isCorrect ? 'is-wrong' : '')}`}>
                              <div className="font-bold shrink-0">{opt.id}.</div>
                              <div className="flex-1"><LatexText text={opt.text} /></div>
                              {isThisCorrectChoice && <Check size={18} className="shrink-0" />}
                              {isThisUserChoice && !isCorrect && <X size={18} className="shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="review-explanation">
                        <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Explanation</strong>
                        <LatexText text={q.explanation} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <style>{styles}</style>
      {renderContent()}
    </>
  );
}