document.addEventListener('DOMContentLoaded', () => {
  const userInput = document.getElementById('adminUser');
  const passInput = document.getElementById('adminPass');
  const loginBtn = document.getElementById('loginBtn');
  const loadBtn = document.getElementById('loadBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const adminDashboard = document.getElementById('adminDashboard');
  const adminLogin = document.getElementById('adminLogin');
  const summaryText = document.getElementById('summaryText');

  let typeChart = null;
  let confidenceChart = null;
  let helpfulChart = null;

  function getAuthHeader() {
    const stored = sessionStorage.getItem('adminAuth');
    if (stored) return stored;
    const user = userInput.value.trim();
    const pass = passInput.value;
    if (!user || !pass) return null;
    const header = 'Basic ' + btoa(user + ':' + pass);
    return header;
  }

  function saveAuthHeader(h) {
    if (h) sessionStorage.setItem('adminAuth', h);
  }

  async function fetchData() {
    const auth = getAuthHeader();
    if (!auth) { alert('Enter username and password'); return null; }
    try {
      const res = await fetch('/api/feedback-data', { headers: { 'Authorization': auth } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to fetch data');
      }
      saveAuthHeader(auth);
      return await res.json();
    } catch (err) {
      alert('Error loading data: ' + err.message);
      return null;
    }
  }

  function renderSummary(data) {
    summaryText.textContent = `Total entries: ${data.total} — Unique skin types: ${Object.keys(data.counts).length}`;
  }

  function renderTypeChart(counts) {
    const ctx = document.getElementById('typeChart').getContext('2d');
    const labels = Object.keys(counts);
    const values = labels.map((k) => counts[k]);
    if (typeChart) typeChart.destroy();
    typeChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Entries', data: values, backgroundColor: '#2b6cb0' }] },
      options: { responsive: true }
    });
  }

  function renderConfidenceChart(avgConfidence) {
    const ctx = document.getElementById('confidenceChart').getContext('2d');
    const labels = Object.keys(avgConfidence);
    const values = labels.map((k) => avgConfidence[k]);
    if (confidenceChart) confidenceChart.destroy();
    confidenceChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Avg Confidence (%)', data: values, borderColor: '#e67e22', backgroundColor: '#f7c59f', fill: false }] },
      options: { responsive: true }
    });
  }

  function renderHelpfulChart(helpfulCounts) {
    const ctx = document.getElementById('helpfulChart').getContext('2d');
    const labels = Object.keys(helpfulCounts);
    const values = labels.map((k) => helpfulCounts[k]);
    if (helpfulChart) helpfulChart.destroy();
    helpfulChart = new Chart(ctx, {
      type: 'pie',
      data: { labels, datasets: [{ data: values, backgroundColor: ['#2b6cb0', '#e53e3e', '#a0aec0'] }] },
      options: { responsive: true }
    });
  }

  async function loadAndRender() {
    const data = await fetchData();
    if (!data) return;
    renderSummary(data);
    renderTypeChart(data.counts);
    renderConfidenceChart(data.avg_confidence);
    renderHelpfulChart(data.helpful_counts);
  }

  loadBtn.addEventListener('click', loadAndRender);

  // Login flow: validate credentials then show dashboard
  loginBtn.addEventListener('click', async () => {
    const auth = getAuthHeader();
    if (!auth) { alert('Enter username and password'); return; }
    try {
      const res = await fetch('/api/feedback-data', { headers: { 'Authorization': auth } });
      if (!res.ok) throw new Error('Invalid credentials');
      // success: show dashboard
      saveAuthHeader(auth);
      adminLogin.style.display = 'none';
      adminDashboard.style.display = 'block';
      await loadAndRender();
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  });

  downloadBtn.addEventListener('click', async () => {
    const auth = getAuthHeader();
    if (!auth) { alert('Enter username and password first'); return; }
    try {
      const res = await fetch('/api/export-feedback', { headers: { 'Authorization': auth } });
      if (!res.ok) {
        throw new Error('Failed to download');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feedback_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  });

  // Try auto-loading token from session and auto-load once
  const savedAuth = sessionStorage.getItem('adminAuth');
  if (savedAuth) {
    // pre-fill user/pass not stored for privacy; rely on stored header
    loadAndRender();
  }
});
