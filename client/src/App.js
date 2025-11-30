import React, { useState, useEffect } from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, ExternalLink, Send, X, Loader2, Sun, Moon, Sparkles, CheckCircle2, User, Mail, Lock, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- API CONFIG ---
// --- API CONFIG ---
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

API.interceptors.request.use((req) => {
  if (localStorage.getItem('token')) req.headers['x-auth-token'] = localStorage.getItem('token');
  return req;
});

// --- ANIMATION CONFIG ---
const SLIDER_TRANSITION = { type: "spring", stiffness: 200, damping: 25 };

// --- LOGIN / REGISTER COMPONENT ---
const LoginRegister = ({ setAuth }) => {
  const [isLoginMode, setIsLoginMode] = useState(true); // true = Show Login (Overlay on Right)
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(""); 
  const [statusType, setStatusType] = useState("neutral"); // neutral, success, error
  
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const navigate = useNavigate();

  // Reset inputs when switching modes
  useEffect(() => {
    setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    setStatusMsg("");
  }, [isLoginMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(isLoginMode ? "Authenticating..." : "Creating Account...");
    setStatusType("neutral");

    // Validation for Register
    if (!isLoginMode && formData.password !== formData.confirmPassword) {
      setStatusMsg("Passwords do not match!");
      setStatusType("error");
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLoginMode ? '/login' : '/register';
      const payload = isLoginMode 
        ? { identifier: formData.username, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };
      
      const res = await API.post(endpoint, payload);
      
      // Success!
      setStatusMsg(isLoginMode ? "Login Successful!" : "Registration Complete!");
      setStatusType("success");
      
      // Slight delay so user sees the success message
      setTimeout(() => {
        localStorage.setItem('token', res.data.token);
        setAuth(true);
        navigate('/dashboard');
        toast.success(`Welcome ${res.data.user.username}!`);
      }, 1000);

    } catch (err) {
      console.error(err);
      setStatusMsg(err.response?.data?.msg || "Connection Failed");
      setStatusType("error");
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute inset-0">
         <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] animate-blob"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
      </div>

      {/* --- MAIN CARD --- */}
      <div className="relative z-10 w-[1000px] max-w-[90%] h-[650px] bg-white dark:bg-[#1e293b] rounded-[30px] shadow-2xl overflow-hidden flex border border-white/10">
        
        {/* --- LEFT SIDE: LOGIN FORM --- */}
        {/* Visible when Overlay is on Right */}
        <div className={`w-1/2 h-full absolute left-0 top-0 flex flex-col justify-center items-center p-12 transition-all duration-700 ${isLoginMode ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
           <div className="w-full max-w-xs">
             <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-2 text-center">Sign In</h1>
             <p className="text-gray-500 text-center text-sm mb-8">Welcome back to Reader AI</p>
             
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-indigo-500 transition-colors">
                  <User size={18} className="text-gray-400"/>
                  <input name="username" placeholder="Username or Email" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.username} />
                </div>
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-indigo-500 transition-colors">
                  <Lock size={18} className="text-gray-400"/>
                  <input type="password" name="password" placeholder="Password" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.password} />
                </div>
                
                <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all mt-4">
                   {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Log In'}
                </button>
                
                {/* STATUS MESSAGE */}
                <div className={`text-center text-sm font-medium mt-4 h-6 ${statusType === 'error' ? 'text-red-500' : statusType === 'success' ? 'text-green-500' : 'text-indigo-400'}`}>
                  {statusMsg}
                </div>
             </form>
           </div>
        </div>

        {/* --- RIGHT SIDE: REGISTER FORM --- */}
        {/* Visible when Overlay is on Left */}
        <div className={`w-1/2 h-full absolute right-0 top-0 flex flex-col justify-center items-center p-12 transition-all duration-700 ${!isLoginMode ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
           <div className="w-full max-w-xs">
             <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-2 text-center">Create Account</h1>
             <p className="text-gray-500 text-center text-sm mb-6">Start summarizing instantly</p>
             
             <form onSubmit={handleSubmit} className="space-y-3">
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-purple-500 transition-colors">
                  <User size={18} className="text-gray-400"/>
                  <input name="username" placeholder="Username" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.username} />
                </div>
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-purple-500 transition-colors">
                  <Mail size={18} className="text-gray-400"/>
                  <input name="email" type="email" placeholder="Email Address" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.email} />
                </div>
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-purple-500 transition-colors">
                  <Lock size={18} className="text-gray-400"/>
                  <input type="password" name="password" placeholder="Password" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.password} />
                </div>
                <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-purple-500 transition-colors">
                  <Lock size={18} className="text-gray-400"/>
                  <input type="password" name="confirmPassword" placeholder="Confirm Password" required className="bg-transparent w-full outline-none text-gray-900 dark:text-white" onChange={handleChange} value={formData.confirmPassword} />
                </div>
                
                <button disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all mt-4">
                   {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Sign Up'}
                </button>

                {/* STATUS MESSAGE */}
                <div className={`text-center text-sm font-medium mt-4 h-6 ${statusType === 'error' ? 'text-red-500' : statusType === 'success' ? 'text-green-500' : 'text-purple-400'}`}>
                  {statusMsg}
                </div>
             </form>
           </div>
        </div>

        {/* --- THE SLIDING OVERLAY --- */}
        <motion.div 
          className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-br from-indigo-600 to-purple-700 z-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden"
          initial={false}
          animate={{ x: isLoginMode ? "100%" : "0%" }} // 100% = Right (Cover Register), 0% = Left (Cover Login)
          transition={SLIDER_TRANSITION}
        >
          {/* Decorative Circles */}
          <div className="absolute top-[-20%] left-[-20%] w-60 h-60 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-60 h-60 bg-black/10 rounded-full blur-2xl"></div>

          {/* Content: "New Here?" (Shown when Overlay is on Right) */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center text-white p-12 text-center transition-all duration-500 ${isLoginMode ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none'}`}>
             <h2 className="text-4xl font-bold mb-4">New here?</h2>
             <p className="text-white/80 mb-8 leading-relaxed">Sign up and discover a new way<br/>to consume content.</p>
             <button onClick={() => setIsLoginMode(false)} className="px-8 py-3 border-2 border-white rounded-full font-bold hover:bg-white hover:text-indigo-600 transition-colors">
               Sign Up
             </button>
          </div>

          {/* Content: "Welcome Back" (Shown when Overlay is on Left) */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center text-white p-12 text-center transition-all duration-500 ${!isLoginMode ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none'}`}>
             <h2 className="text-4xl font-bold mb-4">One of us?</h2>
             <p className="text-white/80 mb-8 leading-relaxed">If you already have an account,<br/>just sign in. We missed you!</p>
             <button onClick={() => setIsLoginMode(true)} className="px-8 py-3 border-2 border-white rounded-full font-bold hover:bg-white hover:text-purple-600 transition-colors">
               Log In
             </button>
          </div>

        </motion.div>

      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENT ---
const ArticleList = () => {
  const [url, setUrl] = useState('');
  const [articles, setArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(localStorage.theme !== 'light');

  const fetchArticles = async () => {
    try {
      const res = await API.get('/articles', { params: { _t: new Date().getTime() } });
      setArticles(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchArticles();
    const interval = setInterval(fetchArticles, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; } 
    else { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
  }, [isDark]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!url) return;
    setLoading(true);
    try {
      await API.post('/articles', { url });
      setUrl('');
      toast.success("AI Agent deployed!", { icon: "🚀" });
      fetchArticles();
    } catch (err) { toast.error("Submission failed"); } 
    finally { setLoading(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try { await API.delete(`/articles/${id}`); fetchArticles(); toast.info("Deleted"); } 
    catch (err) { toast.error("Failed"); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); window.location.reload(); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-500 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/70 dark:bg-black/50 backdrop-blur-lg border-b border-gray-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
  R
</div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              {isDark ? <Sun size={20}/> : <Moon size={20}/>}
             </button>
             <button onClick={handleLogout} className="px-4 py-2 text-sm font-bold border border-gray-200 dark:border-white/10 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all">Log Out</button>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 max-w-7xl mx-auto px-6">
        
        {/* Hero Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
            Turn content into <br/>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">knowledge.</span>
          </h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10">
            Paste any link—YouTube, PDF, or Web Article—and get a perfect summary powered by Llama 3.3.
          </p>
          
          <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative flex items-center bg-white dark:bg-[#0f172a] rounded-full p-2 shadow-2xl border border-gray-100 dark:border-white/10">
              <input type="url" placeholder="Paste a URL here..." value={url} onChange={(e) => setUrl(e.target.value)} 
                className="w-full p-4 pl-6 bg-transparent border-none outline-none text-lg text-gray-900 dark:text-white placeholder-gray-400"
              />
              <button disabled={loading} className="bg-black dark:bg-white text-white dark:text-black w-12 h-12 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                 {loading ? <Loader2 className="animate-spin" size={20}/> : <ArrowRight size={24} />}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {articles.map((article) => (
              <motion.div
                 layout
                 key={article._id}
                 initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                 onClick={() => article.status === 'completed' && setSelectedArticle(article)}
                 className={`relative p-6 rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden group
                   ${article.status === 'completed' ? 'bg-white dark:bg-[#1e293b] border-gray-200 dark:border-white/10 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-2xl hover:-translate-y-1' : 'bg-gray-100 dark:bg-white/5 opacity-70'}
                 `}
               >
                <div className="flex justify-between items-start mb-6">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${article.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                     {article.status === 'completed' ? <CheckCircle2 size={16}/> : <Loader2 size={16} className="animate-spin"/>}
                   </div>
                   <button onClick={(e) => handleDelete(article._id, e)} className="text-gray-400 hover:text-red-500 transition-colors">
                     <Trash2 size={16}/>
                   </button>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white line-clamp-2 leading-tight">{article.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {article.topics.map((t, i) => (
                    <span key={i} className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-md border border-gray-200 dark:border-white/5 uppercase tracking-wider">
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setSelectedArticle(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] w-full max-w-3xl max-h-[85vh] rounded-[30px] shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-white/10">
              <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-start bg-gray-50/50 dark:bg-white/[0.02]">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedArticle.title}</h2><a href={selectedArticle.url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-sm font-medium">View Source <ExternalLink size={14}/></a></div>
                <button onClick={() => setSelectedArticle(null)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:rotate-90 transition-all"><X size={20} className="text-gray-600 dark:text-white"/></button>
              </div>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0f172a]">
                <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-lg leading-loose">{selectedArticle.summary}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer position="bottom-right" theme={localStorage.theme === 'dark' ? 'dark' : 'light'} />
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => { if (localStorage.getItem('token')) setIsAuthenticated(true); }, []);
  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginRegister setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={isAuthenticated ? <ArticleList /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
};

export default App;