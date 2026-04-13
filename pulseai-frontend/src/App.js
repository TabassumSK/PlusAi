// ============================================================
// PulseAI — Complete React Frontend
// npx create-react-app pulseai-frontend
// npm install axios recharts
// Replace src/App.js with this file
// ============================================================

import { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, Legend
} from "recharts";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [tab, setTab]               = useState("analyze");
  const [query, setQuery]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);
  const [compareQ1, setCompareQ1]   = useState("");
  const [compareQ2, setCompareQ2]   = useState("");
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [singleText, setSingle]     = useState("");
  const [singleResult, setSingleResult] = useState(null);
  const [token, setToken]           = useState(localStorage.getItem("token"));
  const [user, setUser]             = useState(null);
  const [history, setHistory]       = useState([]);
  const [trending, setTrending]     = useState([]);
  const [loginForm, setLoginForm]   = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "" });
  const [authTab, setAuthTab]       = useState("login");
  const [authError, setAuthError]   = useState("");

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
    } catch { logout(); }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/history`, { headers: authHeaders });
      setHistory(res.data);
    } catch {}
  };

  const fetchTrending = async () => {
    try {
      const res = await axios.get(`${API}/trending`);
      setTrending(res.data);
    } catch {}
  };

  const analyze = async () => {
    if (!query.trim()) return;
    setLoading(true); setData(null);
    try {
      const res = await axios.post(`${API}/analyze`,
        { query, limit: 40 }, { headers: authHeaders });
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
    setCompareLoading(true); setCompareData(null);
    try {
      const res = await axios.post(`${API}/compare`,
        { query1: compareQ1, query2: compareQ2 });
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

  const login = async () => {
    setAuthError("");
    try {
      const form = new URLSearchParams();
      form.append("username", loginForm.username);
      form.append("password", loginForm.password);
      const res = await axios.post(`${API}/login`, form);
      localStorage.setItem("token", res.data.access_token);
      setToken(res.data.access_token);
    } catch { setAuthError("Invalid username or password"); }
  };

  const register = async () => {
    setAuthError("");
    try {
      await axios.post(`${API}/register`, registerForm);
      setAuthTab("login");
      setAuthError("Account created! Please login.");
    } catch (e) {
      setAuthError(e.response?.data?.detail || "Registration failed");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null); setUser(null); setHistory([]);
  };

  const exportPDF = () => {
    window.open(`${API}/export/${encodeURIComponent(query)}`, "_blank");
  };

  // Chart data
  const pieData = data ? [
    { name: "Positive", value: data.summary.positive },
    { name: "Negative", value: data.summary.negative },
  ] : [];

  const aspectData = data ? Object.entries(data.aspects).map(([k, v]) => ({
    aspect: k, Positive: v.pos_pct, Negative: v.neg_pct
  })) : [];

  const keywordData = data
    ? data.pos_keywords.slice(0, 8).map((k, i) => ({
        word: k.word,
        Positive: k.count,
        Negative: data.neg_keywords[i]?.count || 0
      }))
    : [];

  const scoreColor = (pct) => pct >= 60 ? "#1D9E75" : pct >= 40 ? "#EF9F27" : "#E24B4A";

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
            {["analyze", "compare", "predict", "history"].map(t => (
              <button key={t} className={`nav-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}>
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
              <button className="btn-primary" onClick={() => setTab("auth")}>Login</button>
            )}
          </div>
        </div>
      </header>

      <main className="container main">

        {/* ── Analyze Tab ── */}
        {tab === "analyze" && (
          <>
            <div className="hero">
              <h2 className="hero-title">What does the world think about <span className="highlight">any tech product</span>?</h2>
              <p className="hero-sub">Real-time sentiment from NewsAPI + HackerNews, analyzed by BERT</p>
              <div className="search-wrap">
                <input className="search-input" value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder='Try "iPhone 16", "ChatGPT", "Samsung Galaxy"...' />
                <button className="btn-primary large" onClick={analyze} disabled={loading}>
                  {loading ? <span className="spinner" /> : "Analyze →"}
                </button>
              </div>
              {trending.length > 0 && (
                <div className="trending">
                  <span className="trending-label">Trending:</span>
                  {trending.slice(0, 5).map(t => (
                    <button key={t.query} className="trend-chip"
                      onClick={() => { setQuery(t.query); }}>
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
                <p className="loading-sub">Pulling from NewsAPI + HackerNews simultaneously</p>
              </div>
            )}

            {data && (
              <>
                {/* Score banner */}
                <div className="score-banner">
                  <div className="score-left">
                    <p className="score-query">"{data.query}"</p>
                    <p className="score-sub">{data.total} posts analyzed from {data.sources.newsapi} news + {data.sources.hackernews} HN posts</p>
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

                {/* Stat cards */}
                <div className="stats-grid">
                  <div className="stat-card"><p className="stat-label">Total analyzed</p><p className="stat-val">{data.total}</p></div>
                  <div className="stat-card green"><p className="stat-label">Positive</p><p className="stat-val">{data.summary.pos_pct}%</p></div>
                  <div className="stat-card red"><p className="stat-label">Negative</p><p className="stat-val">{data.summary.neg_pct}%</p></div>
                  <div className="stat-card"><p className="stat-label">Avg confidence</p><p className="stat-val">{(data.summary.avg_confidence * 100).toFixed(1)}%</p></div>
                </div>

                {/* Charts */}
                <div className="charts-grid">
                  <div className="chart-card">
                    <h3 className="chart-title">Sentiment split</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95}
                          dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          <Cell fill="#1D9E75" />
                          <Cell fill="#E24B4A" />
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
                        <Bar dataKey="Positive" fill="#1D9E75" radius={[4,4,0,0]} />
                        <Bar dataKey="Negative" fill="#E24B4A" radius={[4,4,0,0]} />
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

                {/* Live feed */}
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
                          <div className="conf-bar" style={{
                            width: `${post.confidence * 100}%`,
                            background: post.label === "Positive" ? "#1D9E75" : "#E24B4A"
                          }} />
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
              <input className="search-input" value={compareQ1}
                onChange={e => setCompareQ1(e.target.value)}
                placeholder='Product 1 e.g. "iPhone 16"' />
              <span className="vs-badge">VS</span>
              <input className="search-input" value={compareQ2}
                onChange={e => setCompareQ2(e.target.value)}
                placeholder='Product 2 e.g. "Samsung S24"' />
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
                    <div className="compare-score" style={{ color: scoreColor(d.summary.pos_pct) }}>
                      {d.summary.pos_pct}%
                    </div>
                    <p className="compare-label">Positive sentiment</p>
                    <div className="compare-bar">
                      <div className="compare-bar-fill" style={{
                        width: `${d.summary.pos_pct}%`,
                        background: scoreColor(d.summary.pos_pct)
                      }} />
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
            <textarea className="text-area" rows={5} value={singleText}
              onChange={e => setSingle(e.target.value)}
              placeholder="Paste any review, tweet, comment, or news headline..." />
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
                <button className="btn-primary" onClick={() => setTab("auth")}>Login →</button>
              </div>
            ) : history.length === 0 ? (
              <p className="empty-state">No searches yet — go analyze something!</p>
            ) : (
              <div className="history-list">
                {history.map((h, i) => (
                  <div key={i} className="history-item"
                    onClick={() => { setQuery(h.query); setTab("analyze"); }}>
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

        {/* ── Auth Tab ── */}
        {tab === "auth" && (
          <div className="auth-wrap">
            <div className="auth-card">
              <div className="auth-tabs">
                <button className={`auth-tab ${authTab === "login" ? "active" : ""}`}
                  onClick={() => { setAuthTab("login"); setAuthError(""); }}>Login</button>
                <button className={`auth-tab ${authTab === "register" ? "active" : ""}`}
                  onClick={() => { setAuthTab("register"); setAuthError(""); }}>Register</button>
              </div>
              {authError && <p className={`auth-error ${authError.includes("created") ? "success" : ""}`}>{authError}</p>}
              {authTab === "login" ? (
                <>
                  <input className="form-input" placeholder="Username"
                    value={loginForm.username}
                    onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} />
                  <input className="form-input" placeholder="Password" type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && login()} />
                  <button className="btn-primary full" onClick={login}>Login →</button>
                </>
              ) : (
                <>
                  <input className="form-input" placeholder="Username"
                    value={registerForm.username}
                    onChange={e => setRegisterForm({ ...registerForm, username: e.target.value })} />
                  <input className="form-input" placeholder="Email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} />
                  <input className="form-input" placeholder="Password" type="password"
                    value={registerForm.password}
                    onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} />
                  <button className="btn-primary full" onClick={register}>Create Account →</button>
                </>
              )}
            </div>
          </div>
        )}

      </main>

      <footer className="footer">
        <div className="container">
          <p>PulseAI · Final Year CSE Project · Built with BERT + FastAPI + React</p>
        </div>
      </footer>
    </div>
  );
}
