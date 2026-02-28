import React, { useState, useEffect } from 'react';
import { 
  Clock, ChevronLeft, ChevronRight, Check, X, AlertTriangle, Calculator, 
  LayoutGrid, User, Lock, Mail, LogOut, ArrowRight, History, Calendar, 
  Award, Settings, Plus, Trash2, Edit2, Save, BookOpen, FileText
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const isPreviewEnv = typeof __firebase_config !== 'undefined' && __firebase_config;
const firebaseConfig = isPreviewEnv ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyAW3I1jRHHzkLHRVQ_BU6wsZfnpphqPNOs",
  authDomain: "exambuilder-2e28c.firebaseapp.com",
  projectId: "exambuilder-2e28c",
  storageBucket: "exambuilder-2e28c.firebasestorage.app",
  messagingSenderId: "433848274913",
  appId: "1:433848274913:web:af0a7deb1bc6525ea88ca0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : "examBuilder-production";

// --- FALLBACK MOCK DATA FOR SEEDING ---
const DEFAULT_EXAM = {
  title: "Grade 10 Practice Assessment",
  description: "This simulated examination covers core Grade 10 concepts including Algebra, Geometry, Functions, and Probability.",
  timeLimit: 30
};

const DEFAULT_QUESTIONS = [
  {
    topic: "Algebra II", text: "Solve for x in the quadratic equation: x² - 8x + 15 = 0",
    options: [{ id: "A", text: "x = 3, x = 5" }, { id: "B", text: "x = -3, x = -5" }, { id: "C", text: "x = 2, x = 6" }, { id: "D", text: "x = -2, x = -6" }],
    correctId: "A", explanation: "Factoring the quadratic equation gives (x - 3)(x - 5) = 0. Therefore, the solutions are x = 3 and x = 5."
  },
  {
    topic: "Functions", text: "Given the function f(x) = 3x² - 2x + 5, calculate the value of f(-2).",
    options: [{ id: "A", text: "13" }, { id: "B", text: "21" }, { id: "C", text: "9" }, { id: "D", text: "17" }],
    correctId: "B", explanation: "Substitute x = -2 into the function: f(-2) = 3(-2)² - 2(-2) + 5 = 3(4) + 4 + 5 = 12 + 4 + 5 = 21."
  },
  {
    topic: "Geometry", text: "In a right triangle, the length of the hypotenuse is 13 units and one leg is 5 units. What is the length of the other leg?",
    options: [{ id: "A", text: "8 units" }, { id: "B", text: "10 units" }, { id: "C", text: "12 units" }, { id: "D", text: "14 units" }],
    correctId: "C", explanation: "Using the Pythagorean theorem (a² + b² = c²): 5² + b² = 13². 25 + b² = 169. b² = 144, so b = 12."
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
  .container-sm { max-width: 32rem; }
  
  .card { background: white; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; padding: 2rem; }
  .card-header { background: #0f172a; color: white; padding: 2rem; text-align: center; border-radius: 1rem 1rem 0 0; margin: -2rem -2rem 2rem -2rem; }
  .card-header-icon { width: 4rem; height: 4rem; background: rgba(37,99,235,0.2); color: #60a5fa; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; border: 1px solid rgba(59,130,246,0.3); }
  
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
  .btn-icon { padding: 0.5rem; border-radius: 0.5rem; color: #94a3b8; background: transparent; }
  .btn-icon:hover { color: #2563eb; background: #eff6ff; }
  .btn-icon-danger:hover { color: #ef4444; background: #fef2f2; }
  
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
  .option-btn { width: 100%; text-align: left; padding: 1.25rem; border: 2px solid #e2e8f0; background: white; border-radius: 0.75rem; margin-bottom: 0.75rem; cursor: pointer; display: flex; align-items: center; font-size: 1.125rem; transition: 0.2s; }
  .option-btn:hover { border-color: #bfdbfe; background: #f8fafc; }
  .option-btn.selected { border-color: #2563eb; background: #eff6ff; }
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
  
  .error-message { background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; padding: 1rem; border-radius: 0.75rem; font-weight: 600; text-align: center; }

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
  const [appState, setAppState] = useState('loading'); // 'loading', 'login', 'home', 'exam_intro', 'exam', 'results', 'admin'
  
  // Auth & DB State
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [pastResults, setPastResults] = useState([]);
  const [localAuthActive, setLocalAuthActive] = useState(false);

  // Login Form
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginMode, setLoginMode] = useState('student'); // 'student' or 'teacher'
  const [teachersList, setTeachersList] = useState([]);

  // Exam Data State (Dynamic)
  const [exams, setExams] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);

  // Student Exam Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentScore, setCurrentScore] = useState({ score: 0, percentage: 0 });

  // Admin Builder State
  const [adminView, setAdminView] = useState('list_exams'); 
  const [editingExamDetails, setEditingExamDetails] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setAppState('login');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        setLocalAuthActive(true);
        if (appState === 'loading' || appState === 'login') {
          setAppState(data.role === 'teacher' ? 'admin' : 'home');
        }
      } else {
        setAppState('login');
      }
    }, (error) => {
      console.error("Error fetching profile:", error);
      setAppState('login');
    });

    const examsRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');
    const unsubExams = onSnapshot(examsRef, (snapshot) => {
      const loadedExams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      loadedExams.sort((a, b) => b.createdAt - a.createdAt); 
      setExams(loadedExams);
    }, (error) => console.error("Error fetching exams:", error));

    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
    const unsubQuestions = onSnapshot(questionsRef, (snapshot) => {
      const loadedQs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllQuestions(loadedQs);
    }, (error) => console.error("Error fetching questions:", error));

    const teachersRef = collection(db, 'artifacts', appId, 'public', 'data', 'teachers');
    const unsubTeachers = onSnapshot(teachersRef, (snapshot) => {
      const loadedTeachers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeachersList(loadedTeachers);
    }, (error) => console.error("Error fetching teachers:", error));

    return () => { unsubProfile(); unsubExams(); unsubQuestions(); unsubTeachers(); };
  }, [user, appState]);

  useEffect(() => {
    if (!user || userProfile?.role === 'teacher') return;

    const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
    const unsubResults = onSnapshot(resultsRef, (snapshot) => {
      const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => b.timestamp - a.timestamp);
      setPastResults(results);
    }, (error) => console.error("Error fetching results:", error));

    return () => unsubResults();
  }, [user, userProfile]);

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

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmittingAuth(true);
    setAuthError('');
    
    try {
      const userEmail = authForm.email.toLowerCase().trim();
      const isReturning = userProfile && userProfile.role === 'student' && !localAuthActive;

      if (isReturning) {
        if (userEmail === userProfile.email.toLowerCase()) {
          setLocalAuthActive(true);
          setAppState('home');
        } else {
          setAuthError("Email address does not match your registered account.");
        }
      } else {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        await setDoc(profileRef, {
          name: authForm.name,
          email: userEmail,
          role: 'student',
          createdAt: Date.now()
        });
      }
    } catch (error) {
      console.error("Error with student auth:", error);
      setAuthError("Failed to process request. Please update your Firebase Rules.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmittingAuth(true);
    setAuthError('');
    
    try {
      const userEmail = authForm.email.toLowerCase().trim();
      // Authenticate against manual credentials loaded from database
      const teacher = teachersList.find(t => t.email.toLowerCase() === userEmail && t.password === authForm.password);

      if (teacher) {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
        await setDoc(profileRef, {
          name: teacher.name || 'Teacher Admin',
          email: userEmail,
          role: 'teacher',
          createdAt: Date.now()
        });
        setLocalAuthActive(true);
        setAppState('admin');
      } else {
        setAuthError("Invalid teacher credentials. Please verify your email and password.");
      }
    } catch (error) {
      console.error("Error with teacher auth:", error);
      setAuthError("Failed to authenticate. Please check your Firebase Rules.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    setLocalAuthActive(false);
    setAuthForm({ name: '', email: '', password: '' });
    setSelectedExam(null);
    setAuthError('');
    setLoginMode(userProfile?.role || 'student');
    setAppState('login');
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

    if (user && localAuthActive && userProfile?.role !== 'teacher') {
      try {
        const resultsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'results');
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
    if (!user) return;
    try {
      const examsRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');
      const examDocRef = await addDoc(examsRef, { ...DEFAULT_EXAM, createdAt: Date.now() });

      const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
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
    if (!user) return;
    
    const examsRef = collection(db, 'artifacts', appId, 'public', 'data', 'exams');
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
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'exams', editingExamDetails.id);
        await updateDoc(docRef, examData);
      }
      setAdminView('list_exams');
      setEditingExamDetails(null);
    } catch (err) {
      console.error("Error saving exam:", err);
    }
  };

  const deleteExam = async (examId) => {
    if (!user || !window.confirm("Are you sure? This will delete the exam.")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exams', examId));
      const qsToDelete = allQuestions.filter(q => q.examId === examId);
      qsToDelete.forEach(async (q) => {
         await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', q.id));
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
    if (!user || !selectedExam) return;
    
    const questionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'questions');
    const qData = {
      examId: selectedExam.id, topic: editingQuestion.topic, text: editingQuestion.text,
      options: editingQuestion.options, correctId: editingQuestion.correctId,
      explanation: editingQuestion.explanation, order: editingQuestion.order || Date.now()
    };

    try {
      if (editingQuestion.isNew) {
        await addDoc(questionsRef, qData);
      } else {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'questions', editingQuestion.id);
        await updateDoc(docRef, qData);
      }
      setEditingQuestion(null);
      setAdminView('manage_questions');
    } catch (err) {
      console.error("Error saving question:", err);
    }
  };

  const deleteQuestion = async (id) => {
    if (!user || !window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', id));
    } catch (err) {
      console.error("Error deleting question:", err);
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

    if (appState === 'login') {
      const isReturningStudent = loginMode === 'student' && userProfile !== null && userProfile.role === 'student' && !localAuthActive;
      const isReturningTeacher = loginMode === 'teacher' && userProfile !== null && userProfile.role === 'teacher' && !localAuthActive;

      return (
        <div className="min-h-screen flex items-center justify-center" style={{ padding: '1.5rem' }}>
          <div className="card container-sm" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-header">
              <div className="card-header-icon"><Calculator size={32} /></div>
              <h1 className="title" style={{ color: 'white' }}>Test Exam Platform</h1>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Interactive Assessment Environment</p>
            </div>
            <div style={{ padding: '2rem' }}>
              
              <div className="role-toggle">
                <button type="button" onClick={() => { setLoginMode('student'); setAuthError(''); }} className={`role-btn ${loginMode === 'student' ? 'active' : ''}`}>Student</button>
                <button type="button" onClick={() => { setLoginMode('teacher'); setAuthError(''); }} className={`role-btn ${loginMode === 'teacher' ? 'active' : ''}`}>Teacher Admin</button>
              </div>

              {authError && (
                <div className="error-message mb-6">
                  {authError}
                </div>
              )}

              {loginMode === 'student' ? (
                <form onSubmit={handleStudentSubmit}>
                  <h2 className="subtitle text-center mb-6">
                    {isReturningStudent ? `Welcome back, ${userProfile.name}` : 'Create Student Account'}
                  </h2>
                  {!isReturningStudent && (
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
                      <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="input" placeholder="student@school.edu" />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmittingAuth} className="btn btn-primary w-full mt-4">
                    {isSubmittingAuth ? 'Processing...' : (isReturningStudent ? 'Sign In' : 'Complete Registration')} <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleTeacherSubmit}>
                  <h2 className="subtitle text-center mb-6">
                    {isReturningTeacher ? `Welcome back, ${userProfile.name}` : 'Teacher Sign In'}
                  </h2>
                  <div className="input-group">
                    <label className="label">Email Address</label>
                    <div className="input-wrapper">
                      <Mail size={18} className="input-icon" />
                      <input type="email" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="input" placeholder="teacher@school.edu" />
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
                    {isSubmittingAuth ? 'Authenticating...' : 'Secure Sign In'} <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (appState === 'admin') {
      return (
        <div className="min-h-screen">
          <nav className="nav dark">
            <div className="nav-brand"><Settings size={24} color="#60a5fa" /> <span className="hidden-sm">Test Exam Admin</span></div>
            <div className="flex items-center gap-4">
              <span className="badge hidden-sm">Teacher: {userProfile?.name}</span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}><LogOut size={16} /> <span className="hidden-sm">Logout</span></button>
            </div>
          </nav>
          <main className="container">
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
                <button onClick={() => { setSelectedExam(null); setAdminView('list_exams'); }} className="btn btn-outline mb-6"><ChevronLeft size={16} /> Back to Exams</button>
                <div className="flex justify-between items-center mb-6 flex-col-sm gap-4">
                  <div>
                    <h1 className="title">{selectedExam.title} - Questions</h1>
                    <p className="text-muted">Manage the questions for this specific assessment.</p>
                  </div>
                  <button onClick={openNewQuestion} className="btn btn-primary w-full-sm"><Plus size={18} /> Add Question</button>
                </div>
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
                            <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>{q.text}</p>
                            <div className="grid grid-cols-2 gap-2" style={{ fontSize: '0.875rem' }}>
                              {q.options.map(opt => (
                                <div key={opt.id} style={{ padding: '0.5rem', border: '1px solid', borderColor: q.correctId === opt.id ? '#bbf7d0' : '#e2e8f0', backgroundColor: q.correctId === opt.id ? '#f0fdf4' : 'white', borderRadius: '0.5rem', color: q.correctId === opt.id ? '#166534' : '#475569' }}>
                                  <strong>{opt.id}.</strong> {opt.text}
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
                  <div className="admin-form-grid mb-6">
                    <div className="input-group col-span-2">
                      <label className="label">Topic / Category</label>
                      <input required type="text" value={editingQuestion.topic} onChange={e => setEditingQuestion({...editingQuestion, topic: e.target.value})} className="input no-icon" placeholder="e.g. Algebra" />
                    </div>
                    <div className="input-group col-span-2">
                      <label className="label">Question Text</label>
                      <textarea required rows={3} value={editingQuestion.text} onChange={e => setEditingQuestion({...editingQuestion, text: e.target.value})} className="input no-icon" placeholder="What is the question?" />
                    </div>
                    {editingQuestion.options.map((opt, i) => (
                      <div className="input-group" key={opt.id}>
                        <label className="label">Option {opt.id}</label>
                        <input required type="text" value={opt.text} onChange={e => { const newOpts = [...editingQuestion.options]; newOpts[i].text = e.target.value; setEditingQuestion({...editingQuestion, options: newOpts}); }} className="input no-icon" style={{ borderColor: editingQuestion.correctId === opt.id ? '#22c55e' : '#cbd5e1', backgroundColor: editingQuestion.correctId === opt.id ? '#f0fdf4' : 'white' }} />
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
                      <textarea required rows={2} value={editingQuestion.explanation} onChange={e => setEditingQuestion({...editingQuestion, explanation: e.target.value})} className="input no-icon" placeholder="Explain why the answer is correct..." />
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
            <div className="nav-brand"><Calculator color="#2563eb" size={24} /> Test Exam Student</div>
            <div className="flex items-center gap-4">
              <span className="badge hidden-sm"><User size={16} /> {userProfile?.name}</span>
              <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}><LogOut size={16} /> <span className="hidden-sm">Logout</span></button>
            </div>
          </nav>
          <div className="container">
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
              <p style={{ fontSize: '1.25rem', fontWeight: 500 }}>{currentQuestion.text}</p>
            </div>
            
            <div className="mb-8">
              {currentQuestion.options.map(option => {
                const isSelected = answers[currentQuestion.id] === option.id;
                return (
                  <button key={option.id} onClick={() => handleSelectOption(option.id)} className={`option-btn ${isSelected ? 'selected' : ''}`}>
                    <div className="option-letter">{option.id}</div>
                    <span>{option.text}</span>
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
                      <p className="subtitle mb-6">{q.text}</p>
                      <div className="grid grid-cols-2 mb-6">
                        {q.options.map(opt => {
                          const isThisUserChoice = userAnswer === opt.id;
                          const isThisCorrectChoice = q.correctId === opt.id;
                          return (
                            <div key={opt.id} className={`review-option ${isThisCorrectChoice ? 'is-correct' : (isThisUserChoice && !isCorrect ? 'is-wrong' : '')}`}>
                              <div className="font-bold shrink-0">{opt.id}.</div>
                              <div className="flex-1">{opt.text}</div>
                              {isThisCorrectChoice && <Check size={18} className="shrink-0" />}
                              {isThisUserChoice && !isCorrect && <X size={18} className="shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                      <div className="review-explanation">
                        <strong style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Explanation</strong>
                        {q.explanation}
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