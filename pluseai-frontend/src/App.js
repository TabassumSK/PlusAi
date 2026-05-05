// ============================================================
// PulseAI — Complete React Frontend
// npx create-react-app pulseai-frontend
// npm install axios recharts
// Replace src/App.js with this file
// ============================================================

import { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Legend,
} from "recharts";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [tab, setTab] = useState("analyze");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [compareQ1, setCompareQ1] = useState("");
  const [compareQ2, setCompareQ2] = useState("");
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [singleText, setSingle] = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [trending, setTrending] = useState([]);

  // Auth state
  const [authPage, setAuthPage] = useState("login"); // "login" | "register" | "forgot"
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [forgotForm, setForgotForm] = useState({ username: "", password: "", confirm: "" });
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [contactMsg, setContactMsg] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (token) fetchUser();
    fetchTrending();
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API}/me`, { headers: authHeaders });
      setUser(res.data);
      fetchHistory();
    } catch {
      logout();
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/history`, { headers: authHeaders });
      setHistory(res.data);
    } catch { }
  };

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/trending`);
      setTrending(res.data);
    } catch { }
  };

  const analyze = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const res = await axios.post(`${API}/analyze`, { query, limit: 40 }, { headers: authHeaders });
      setData(res.data);
      if (token) fetchHistory();
      fetchTrending();
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  };

  const compareTopics = async () => {
    if (!compareQ1.trim() || !compareQ2.trim()) return;
    setCompareLoading(true);
    setCompareData(null);
    try {
      const res = await axios.post(`${API}/compare`, { query1: compareQ1, query2: compareQ2 });
      setCompareData(res.data);
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || e.message));
    }
    setCompareLoading(false);
  };

  const predictSingle = async () => {
    if (!singleText.trim()) return;
    const res = await axios.post(`${API}/predict`, { text: singleText });
    setSingleResult(res.data);
  };

  // ── Auth helpers ─────────────────────────────────────────
  const getStrength = (p) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "#E24B4A", "#EF9F27", "#22c55e", "#16a34a"];

  const switchAuthPage = (page) => {
    setAuthPage(page);
    setAuthError("");
    setAuthSuccess("");
  };

  const login = async () => {
    setAuthError("");
    setAuthSuccess("");
    if (!loginForm.username || !loginForm.password) {
      setAuthError("Please fill in all fields.");
      return;
    }
    try {
      const form = new URLSearchParams();
      form.append("username", loginForm.username);
      form.append("password", loginForm.password);
      const res = await axios.post(`${API}/login`, form);
      localStorage.setItem("token", res.data.access_token);
      setToken(res.data.access_token);
      setTab("analyze");
    } catch {
      setAuthError("Invalid username or password.");
    }
  };

  const register = async () => {
    setAuthError("");
    setAuthSuccess("");
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirm) {
      setAuthError("Please fill in all fields.");
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    try {
      await axios.post(`${API}/register`, {
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
      });
      setAuthSuccess("Account created! You can now login.");
      setTimeout(() => switchAuthPage("login"), 1500);
    } catch (e) {
      setAuthError(e.response?.data?.detail || "Registration failed.");
    }
  };

  const resetPassword = async () => {
    setAuthError("");
    setAuthSuccess("");
    if (!forgotForm.username || !forgotForm.password || !forgotForm.confirm) {
      setAuthError("Please fill in all fields.");
      return;
    }
    if (forgotForm.password !== forgotForm.confirm) {
      setAuthError("Passwords do not match.");
      return;
    }
    try {
      await axios.post(`${API}/reset-password`, {
        username: forgotForm.username,
        new_password: forgotForm.password,
      });
      setAuthSuccess("Password updated! Redirecting to login...");
      setTimeout(() => switchAuthPage("login"), 1500);
    } catch (e) {
      setAuthError(e.response?.data?.detail || "Reset failed. Check your username.");
    }
  };

  const submitContact = async () => {
    setContactMsg("");
    setContactError("");
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setContactError("Please fill in name, email and message.");
      return;
    }
    setContactLoading(true);
    try {
      await axios.post(`${API}/contact`, contactForm);
      setContactMsg("Message sent! We'll get back to you soon.");
      setContactForm({ name: "", email: "", subject: "", message: "" });
    } catch (e) {
      setContactError(e.response?.data?.detail || "Failed to send message.");
    }
    setContactLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setHistory([]);
  };

  const exportPDF = () => {
    window.open(`${API}/export/${encodeURIComponent(query)}`, "_blank");
  };

  // Chart data
  const pieData = data
    ? [
      { name: "Positive", value: data.summary.positive },
      { name: "Negative", value: data.summary.negative },
      { name: "Neutral", value: data.summary.neutral },
    ]
    : [];

  const aspectData = data
    ? Object.entries(data.aspects).map(([k, v]) => ({
      aspect: k,
      Positive: v.pos_pct,
      Negative: v.neg_pct,
    }))
    : [];

  const keywordData = data
    ? data.pos_keywords.slice(0, 8).map((k, i) => ({
      word: k.word,
      Positive: k.count,
      Negative: data.neg_keywords[i]?.count || 0,
    }))
    : [];

  const scoreColor = (pct) =>
    pct >= 60 ? "#1D9E75" : pct >= 40 ? "#EF9F27" : "#E24B4A";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <span className="brand-dot" />
            <h1 className="brand-name">PulseAI</h1>
            <span className="brand-tag">Tech Sentiment Intelligence</span>
          </div>
          <nav className="nav">
            {["analyze", "compare", "predict", "history", "contact"].map((t) => (
              <button
                key={t}
                className={`nav-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          <div className="auth-area">
            {user ? (
              <div className="user-info">
                <span className="username">@{user.username}</span>
                <button className="btn-ghost" onClick={logout}>Logout</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => { setTab("auth"); switchAuthPage("login"); }}>
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container main">

        {/* ── Analyze Tab ── */}
        {tab === "analyze" && (
          <>
            <div className="hero">
              <h2 className="hero-title">
                AI-Powered Sentiment Insights{" "}
                <span className="highlight">Across Domains</span>
              </h2>
              <p className="hero-sub">
                Real-time sentiment from NewsAPI + HackerNews, analyzed by BERT
              </p>
              <div className="search-wrap">
                <input
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyze()}
                  placeholder='Try "iPhone 16", "ChatGPT", "Samsung Galaxy"...'
                />
                <button className="btn-primary large" onClick={analyze} disabled={loading}>
                  {loading ? <span className="spinner" /> : "Analyze →"}
                </button>
              </div>
              {trending.length > 0 && (
                <div className="trending">
                  <span className="trending-label">Trending:</span>
                  {trending.slice(0, 5).map((t) => (
                    <button key={t.query} className="trend-chip" onClick={() => setQuery(t.query)}>
                      {t.query}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loading && (
              <div className="loading-card">
                <div className="loading-spinner" />
                <p>Fetching live data and running BERT analysis...</p>
                <p className="loading-sub"> Pulling from NewsAPI · HackerNews · YouTube · Twitter · Reddit · Instagram</p>
              </div>
            )}

            {data && (
              <>
                <div className="score-banner">
                  <div className="score-left">
                    <p className="score-query">"{data.query}"</p>
                    <p className="score-sub">
                        {data.total} posts analyzed from {data.sources.newsapi} news · {data.sources.hackernews} HN · {data.sources.youtube} YT · {data.sources.twitter} Twitter · {data.sources.reddit} Reddit · {data.sources.instagram} Instagram
                    </p>
                  </div>
                  <div className="score-right">
                    <div className="score-circle" style={{ borderColor: scoreColor(data.summary.pos_pct) }}>
                      <span className="score-num" style={{ color: scoreColor(data.summary.pos_pct) }}>
                        {data.summary.pos_pct}
                      </span>
                      <span className="score-label">Pulse Score</span>
                    </div>
                  </div>
                  <button className="btn-outline" onClick={exportPDF}>Export PDF ↓</button>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <p className="stat-label">Total analyzed</p>
                    <p className="stat-val">{data.total}</p>
                  </div>
                  <div className="stat-card green">
                    <p className="stat-label">Positive</p>
                    <p className="stat-val">{data.summary.pos_pct}%</p>
                  </div>
                  <div className="stat-card" style={{ borderLeft: "3px solid #EF9F27" }}>
                    <p className="stat-label">Neutral</p>
                    <p className="stat-val">{data.summary.neutral_pct}%</p>
                  </div>
                  <div className="stat-card red">
                    <p className="stat-label">Negative</p>
                    <p className="stat-val">{data.summary.neg_pct}%</p>
                  </div>
                </div>

                <div className="charts-grid">
                  <div className="chart-card">
                    <h3 className="chart-title">Sentiment split</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          <Cell fill="#1D9E75" />
                          <Cell fill="#E24B4A" />
                          <Cell fill="#EF9F27" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-card">
                    <h3 className="chart-title">Aspect-based analysis</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={aspectData}>
                        <XAxis dataKey="aspect" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Positive" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Negative" fill="#E24B4A" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-card">
                    <h3 className="chart-title">Top keywords comparison</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={keywordData} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="word" tick={{ fontSize: 11 }} width={70} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Positive" fill="#1D9E75" />
                        <Bar dataKey="Negative" fill="#E24B4A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-card">
                    <h3 className="chart-title">Aspect radar</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={aspectData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="aspect" tick={{ fontSize: 11 }} />
                        <Radar name="Positive%" dataKey="Positive" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.3} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="feed-card">
                  <h3 className="chart-title">Live post feed</h3>
                  <div className="feed-list">
                    {data.posts.slice(0, 15).map((post, i) => (
                      <div key={i} className="feed-item">
                        <div className="feed-left">
                          <span className={`badge ${post.label.toLowerCase()}`}>{post.label}</span>
                          <span className="source-badge">{post.source}</span>
                        </div>
                        <div className="feed-content">
                          <p className="feed-title">{post.title}</p>
                          <p className="feed-meta">
                            Confidence: {(post.confidence * 100).toFixed(1)}% ·
                            <a href={post.url} target="_blank" rel="noreferrer"> View →</a>
                          </p>
                        </div>
                        <div className="conf-bar-wrap">
                          <div className="conf-bar" style={{ width: `${post.confidence * 100}%`, background: post.label === "Positive" ? "#1D9E75" : "#E24B4A" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Compare Tab ── */}
        {tab === "compare" && (
          <div className="compare-wrap">
            <h2 className="section-title">Compare two products</h2>
            <p className="section-sub">See which product has better public sentiment</p>
            <div className="compare-inputs">
              <input className="search-input" value={compareQ1} onChange={(e) => setCompareQ1(e.target.value)} placeholder='Product 1 e.g. "iPhone 16"' />
              <span className="vs-badge">VS</span>
              <input className="search-input" value={compareQ2} onChange={(e) => setCompareQ2(e.target.value)} placeholder='Product 2 e.g. "Samsung S24"' />
              <button className="btn-primary" onClick={compareTopics} disabled={compareLoading}>
                {compareLoading ? <span className="spinner" /> : "Compare →"}
              </button>
            </div>
            {compareData && (
              <div className="compare-results">
                {[compareData.product1, compareData.product2].map((d, i) => (
                  <div key={i} className={`compare-card ${d.summary.pos_pct > 50 ? "winner" : ""}`}>
                    {d.summary.pos_pct > (i === 0 ? compareData.product2 : compareData.product1).summary.pos_pct && (
                      <div className="winner-badge">Winner</div>
                    )}
                    <h3 className="compare-title">"{d.query}"</h3>
                    <div className="compare-score" style={{ color: scoreColor(d.summary.pos_pct) }}>{d.summary.pos_pct}%</div>
                    <p className="compare-label">Positive sentiment</p>
                    <div className="compare-bar">
                      <div className="compare-bar-fill" style={{ width: `${d.summary.pos_pct}%`, background: scoreColor(d.summary.pos_pct) }} />
                    </div>
                    <p className="compare-total">{d.total} posts analyzed</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Predict Tab ── */}
        {tab === "predict" && (
          <div className="predict-wrap">
            <h2 className="section-title">Single text predictor</h2>
            <p className="section-sub">Type any text and get instant BERT sentiment prediction</p>
            <textarea className="text-area" rows={5} value={singleText} onChange={(e) => setSingle(e.target.value)} placeholder="Paste any review, tweet, comment, or news headline..." />
            <button className="btn-primary" onClick={predictSingle}>Predict →</button>
            {singleResult && (
              <div className={`result-box ${singleResult.label.toLowerCase()}`}>
                <div className="result-header">
                  <span className="result-label">{singleResult.label}</span>
                  <span className="result-conf">{(singleResult.confidence * 100).toFixed(1)}% confidence</span>
                </div>
                <div className="prob-row">
                  <div className="prob-item">
                    <span>Positive</span>
                    <div className="prob-bar-outer">
                      <div className="prob-bar-inner pos" style={{ width: `${singleResult.prob_pos * 100}%` }} />
                    </div>
                    <span>{(singleResult.prob_pos * 100).toFixed(1)}%</span>
                  </div>
                  <div className="prob-item">
                    <span>Negative</span>
                    <div className="prob-bar-outer">
                      <div className="prob-bar-inner neg" style={{ width: `${singleResult.prob_neg * 100}%` }} />
                    </div>
                    <span>{(singleResult.prob_neg * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {tab === "history" && (
          <div className="history-wrap">
            <h2 className="section-title">Search history</h2>
            {!user ? (
              <div className="auth-prompt">
                <p>Login to save and view your search history</p>
                <button className="btn-primary" onClick={() => { setTab("auth"); switchAuthPage("login"); }}>Login →</button>
              </div>
            ) : history.length === 0 ? (
              <p className="empty-state">No searches yet — go analyze something!</p>
            ) : (
              <div className="history-list">
                {history.map((h, i) => (
                  <div key={i} className="history-item" onClick={() => { setQuery(h.query); setTab("analyze"); }}>
                    <div className="history-left">
                      <p className="history-query">{h.query}</p>
                      <p className="history-time">{new Date(h.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="history-right">
                      <span className="history-pos">{h.pos_pct}% positive</span>
                      <span className="history-total">{h.total} posts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Contact Tab ── */}
        {tab === "contact" && (
          <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem 0" }}>
            <h2 className="section-title">Contact Us</h2>
            <p className="section-sub">Have a question or feedback? We'd love to hear from you.</p>
            <div className="auth-card" style={{ maxWidth: "100%", marginTop: "1.5rem" }}>
              {contactMsg && (
                <p className="auth-error success">{contactMsg}</p>
              )}
              {contactError && (
                <p className="auth-error">{contactError}</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" }}>Name</label>
                  <input
                    className="form-input"
                    placeholder="Your name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" }}>Email</label>
                  <input
                    className="form-input"
                    placeholder="your@email.com"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" }}>Subject</label>
                <input
                  className="form-input"
                  placeholder="What is this about?"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: ".04em" }}>Message</label>
                <textarea
                  className="text-area"
                  rows={5}
                  placeholder="Write your message here..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <button
                className="btn-primary full"
                onClick={submitContact}
                disabled={contactLoading}>
                {contactLoading ? <span className="spinner" /> : "Send Message →"}
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  📧 <span style={{ color: "var(--text-primary)" }}>pulseai@support.com</span>
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  → We typically respond within <span style={{ color: "var(--text-primary)" }}>24 hours</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Auth Tab ── */}
        {tab === "auth" && (
          <div className="auth-wrap">
            <div className="auth-card">

              {/* Messages */}
              {authError && <p className="auth-error">{authError}</p>}
              {authSuccess && <p className="auth-error success">{authSuccess}</p>}

              {/* LOGIN PAGE */}
              {authPage === "login" && (
                <>
                  <div style={{ marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Welcome back</h2>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Sign in to your account</p>
                  </div>
                  <input
                    className="form-input"
                    placeholder="Username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input
                      className="form-input"
                      placeholder="Password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && login()}
                    />
                    <button
                      onClick={() => switchAuthPage("forgot")}
                      style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", cursor: "pointer", textAlign: "right", padding: "0", fontFamily: "inherit" }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button className="btn-primary full" onClick={login}>Sign in →</button>
                  <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                    Don't have an account?{" "}
                    <button onClick={() => switchAuthPage("register")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "13px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
                      Register
                    </button>
                  </p>
                </>
              )}

              {/* REGISTER PAGE */}
              {authPage === "register" && (
                <>
                  <div style={{ marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Create account</h2>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Start analysing sentiment today</p>
                  </div>
                  <input
                    className="form-input"
                    placeholder="Username"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  />
                  <input
                    className="form-input"
                    placeholder="Email"
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input
                      className="form-input"
                      placeholder="Password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    />
                  </div>
                  <input
                    className="form-input"
                    placeholder="Confirm password"
                    type="password"
                    value={registerForm.confirm}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                  />
                  <button className="btn-primary full" onClick={register}>Register →</button>
                  <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                    Already have an account?{" "}
                    <button onClick={() => switchAuthPage("login")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "13px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
                      Login
                    </button>
                  </p>
                </>
              )}

              {/* FORGOT PASSWORD PAGE */}
              {authPage === "forgot" && (
                <>
                  <button
                    onClick={() => switchAuthPage("login")}
                    style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "13px", cursor: "pointer", fontFamily: "inherit", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    ← Back to login
                  </button>
                  <div style={{ marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--text-primary)" }}>Reset password</h2>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Enter your username and choose a new password</p>
                  </div>
                  <input
                    className="form-input"
                    placeholder="Username"
                    value={forgotForm.username}
                    onChange={(e) => setForgotForm({ ...forgotForm, username: e.target.value })}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input
                      className="form-input"
                      placeholder="New password"
                      type="password"
                      value={forgotForm.password}
                      onChange={(e) => setForgotForm({ ...forgotForm, password: e.target.value })}
                    />
                  </div>
                  <input
                    className="form-input"
                    placeholder="Confirm new password"
                    type="password"
                    value={forgotForm.confirm}
                    onChange={(e) => setForgotForm({ ...forgotForm, confirm: e.target.value })}
                  />
                  <button className="btn-primary full" onClick={resetPassword}>Update password →</button>
                  <p style={{ textAlign: "center", fontSize: "13px", color: "var(--text-secondary)", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                    Remembered it?{" "}
                    <button onClick={() => switchAuthPage("login")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "13px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
                      Login
                    </button>
                  </p>
                </>
              )}

            </div>
          </div>
        )}

      </main>

      <footer className="footer">
        <div className="container">
          <p>PulseAI · Built with BERT + FastAPI + React</p>
        </div>
      </footer>
    </div>
  );
}