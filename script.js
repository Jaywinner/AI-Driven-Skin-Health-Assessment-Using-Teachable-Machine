document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const inputEl = document.getElementById('imageInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const previewImg = document.getElementById('previewImage');
  const resultsEl = document.getElementById('results');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  const cameraVideo = document.getElementById('cameraVideo');
  const feedbackModal = document.getElementById('feedbackModal');
  const helpfulYesBtn = document.getElementById('helpfulYes');
  const helpfulNoBtn = document.getElementById('helpfulNo');
  const submitFeedbackBtn = document.getElementById('submitFeedback');
  const skipFeedbackBtn = document.getElementById('skipFeedback');
  const feedbackText = document.getElementById('feedbackText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  let cameraStream = null;

  const modelURL = 'model.json';
  const metadataURL = 'metadata.json';
  let model = null;
  let imageLoaded = false;
  let lastAnalysisData = null;
  let feedbackHelpful = null;
  let feedbackShownForCurrentImage = false;

  // Error message for missing image
  const noImageError = document.createElement('div');
  noImageError.id = 'noImageError';
  noImageError.style.color = '#e53e3e';
  noImageError.style.textAlign = 'center';
  noImageError.style.marginTop = '8px';
  noImageError.style.fontSize = '14px';
  noImageError.textContent = 'No image yet. Please upload or take a picture.';
  noImageError.style.display = 'none';
  document.querySelector('.uploader').parentElement.insertBefore(noImageError, document.querySelector('.uploader').nextSibling);

  // Disable analyze button until model is loaded
  if (analyzeBtn) analyzeBtn.disabled = true;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function showError(err) {
    console.error(err);
    resultsEl.innerHTML = `<div class="card error">Error: ${String(err)}</div>`;
  }

  async function loadModel() {
    try {
      setStatus('Loading model...');
      model = await tmImage.load(modelURL, metadataURL);
      setStatus('Model loaded. Choose an image to analyze.');
      if (analyzeBtn) analyzeBtn.disabled = false;
    } catch (err) {
      setStatus('Model failed to load. See results for details.');
      showError(err);
      if (analyzeBtn) analyzeBtn.disabled = true;
    }
  }

  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Camera functions
  async function startCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      setStatus('Requesting camera permission...');
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraVideo.srcObject = cameraStream;
      cameraVideo.style.display = 'block';
      captureBtn.style.display = 'inline-block';
      startCameraBtn.textContent = 'Stop Camera';
      setStatus('Camera active — position your device and press Capture.');
    } catch (err) {
      showError(err);
    }
  }

  function stopCamera() {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }
      cameraVideo.srcObject = null;
      cameraVideo.style.display = 'none';
      captureBtn.style.display = 'none';
      startCameraBtn.textContent = 'Use Camera';
      setStatus('Camera stopped.');
    } catch (err) {
      console.warn('Error stopping camera', err);
    }
  }

  async function captureFrameAndAnalyze() {
    try {
      if (!cameraVideo || cameraVideo.readyState < 2) {
        showError('Camera not ready');
        return;
      }

      const w = cameraVideo.videoWidth;
      const h = cameraVideo.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cameraVideo, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png');
      previewImg.src = dataUrl;

      // Stop camera after capture to save resources
      stopCamera();

      noImageError.style.display = 'none';
      imageLoaded = true;
      feedbackShownForCurrentImage = false;

      // Run prediction automatically (wait for model readiness)
      await runPrediction();
    } catch (err) {
      showError(err);
    }
  }

  async function runPrediction() {
    // Show spinner and disable button immediately
    loadingSpinner.style.display = 'flex';
    resultsEl.innerHTML = '';
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.style.opacity = '0.6';
      analyzeBtn.style.cursor = 'not-allowed';
    }
    
    if (!model) {
      loadingSpinner.style.display = 'none';
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.style.cursor = 'pointer';
      }
      showError('Model not loaded — please wait for the model to finish loading before analyzing.');
      return;
    }
    if (!imageLoaded) {
      loadingSpinner.style.display = 'none';
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.style.cursor = 'pointer';
      }
      noImageError.style.display = 'block';
      return;
    }

    noImageError.style.display = 'none';

    try {
      setStatus('Running prediction...');
      // Create an image element for predict if previewImg is available
      let predictions = await model.predict(previewImg, false);

      loadingSpinner.style.display = 'none';
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.style.cursor = 'pointer';
      }

      if (!predictions || !predictions.length) {
        showError('No predictions returned');
        return;
      }

      // Ensure predictions are sorted by probability (highest first)
      predictions.sort((a, b) => (b.probability || 0) - (a.probability || 0));

      // Build single-result analysis with tailored recommendation
      const top = predictions[0];
      const confidence = Math.round(top.probability * 100);

      const card = document.createElement('div');
      card.className = 'card results-card';

      const header = document.createElement('h2');
      header.textContent = 'Analysis';
      header.style.marginTop = '0';

      const typeLine = document.createElement('p');
      typeLine.innerHTML = `<strong>Skin Type:</strong> ${top.className} <em>(Confidence: ${confidence}%)</em>`;

      // Tailored recommendations per skin type
      const rec = document.createElement('p');
      rec.className = 'recommendation';
      const tname = top.className.toLowerCase();
      let recommendation = '';
      if (tname.includes('oily')) {
        recommendation = 'Use gentle foaming cleansers; avoid heavy creams. Look for oil-free, non-comedogenic moisturizers and use a lightweight sunscreen.';
      } else if (tname.includes('dry')) {
        recommendation = 'Use hydrating cleansers and rich moisturizers. Avoid long hot showers and harsh scrubs.';
      } else if (tname.includes('normal')) {
        recommendation = 'Use a gentle cleanser, light moisturizer, and daily sunscreen. Keep your routine simple.';
      } else if (tname.includes('combination')) {
        recommendation = 'Use balancing products; apply lightweight moisturizer to oily areas and richer cream to dry patches.';
      } else if (tname.includes('sensitive')) {
        recommendation = 'Use fragrance-free products and patch-test new items. Avoid harsh exfoliants and strong actives.';
      } else {
        recommendation = 'Cleanse gently, use a moisturizer, and protect with SPF daily. Consult a dermatologist for concerns.';
      }
      rec.innerHTML = `<strong>Recommendation:</strong> ${recommendation}`;

      card.appendChild(header);
      card.appendChild(typeLine);
      card.appendChild(rec);

      resultsEl.appendChild(card);

      // Store analysis data for feedback
      lastAnalysisData = {
        skin_type: top.className,
        confidence: confidence
      };

      // Show feedback modal after a delay (10 seconds) only if not shown for this image yet
      if (!feedbackShownForCurrentImage) {
        feedbackShownForCurrentImage = true;
        setTimeout(() => {
          feedbackModal.style.display = 'flex';
          feedbackText.value = '';
          feedbackHelpful = null;
          helpfulYesBtn.style.background = '';
          helpfulYesBtn.style.color = '';
          helpfulNoBtn.style.background = '';
          helpfulNoBtn.style.color = '';
        }, 10000);
      }

      setStatus('Prediction complete.');
    } catch (err) {
      loadingSpinner.style.display = 'none';
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.style.opacity = '1';
        analyzeBtn.style.cursor = 'pointer';
      }
      setStatus('Prediction failed. See results for details.');
      showError(err);
    }
  }

  // Event listeners
  inputEl.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    // Validate image type
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }
    showPreview(file);
    resultsEl.innerHTML = '';
    noImageError.style.display = 'none';
    imageLoaded = true;
    feedbackShownForCurrentImage = false;
    setStatus('Image ready. Click "Analyze now" to run prediction.');
  });

  analyzeBtn.addEventListener('click', async () => {
    await runPrediction();
  });

  // Camera event listeners
  startCameraBtn.addEventListener('click', async () => {
    if (cameraStream) {
      stopCamera();
    } else {
      await startCamera();
    }
  });

  captureBtn.addEventListener('click', async () => {
    await captureFrameAndAnalyze();
  });

  // Feedback modal event listeners
  helpfulYesBtn.addEventListener('click', () => {
    feedbackHelpful = 'Yes';
    helpfulYesBtn.style.background = '#2b6cb0';
    helpfulYesBtn.style.color = '#fff';
    helpfulNoBtn.style.background = '';
    helpfulNoBtn.style.color = '';
  });

  helpfulNoBtn.addEventListener('click', () => {
    feedbackHelpful = 'No';
    helpfulNoBtn.style.background = '#e53e3e';
    helpfulNoBtn.style.color = '#fff';
    helpfulYesBtn.style.background = '';
    helpfulYesBtn.style.color = '';
  });

  async function submitFeedbackData() {
    try {
      const payload = {
        skin_type: lastAnalysisData.skin_type,
        confidence: lastAnalysisData.confidence,
        helpful: feedbackHelpful || '',
        feedback: feedbackText.value || ''
      };

      const response = await fetch('/api/save-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('Feedback saved successfully');
        feedbackModal.style.display = 'none';
      } else {
        console.error('Failed to save feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  }

  submitFeedbackBtn.addEventListener('click', async () => {
    await submitFeedbackData();
  });

  skipFeedbackBtn.addEventListener('click', () => {
    feedbackModal.style.display = 'none';
  });

  // Kick off model load
  loadModel();

  // Stop camera if navigating away
  window.addEventListener('beforeunload', () => {
    stopCamera();
  });
});
