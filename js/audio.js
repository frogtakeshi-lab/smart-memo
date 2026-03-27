/* ========================================
   AUDIO.JS - Voice recording & playback
   ======================================== */

const AudioManager = (() => {
  let mediaRecorder = null;
  let audioChunks = [];
  let analyser = null;
  let audioContext = null;
  let isRecording = false;

  /**
   * Start recording
   */
  async function startRecording(onWaveformData) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start(100);
      isRecording = true;

      // Waveform visualization
      if (onWaveformData) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const draw = () => {
          if (!isRecording) return;
          analyser.getByteTimeDomainData(dataArray);
          onWaveformData(dataArray, bufferLength);
          requestAnimationFrame(draw);
        };
        draw();
      }

      return true;
    } catch (err) {
      console.error('Recording failed:', err);
      return false;
    }
  }

  /**
   * Stop recording and return blob
   */
  function stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        isRecording = false;

        // Clean up
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        if (audioContext) audioContext.close();
        mediaRecorder = null;
        audioChunks = [];
        analyser = null;
        audioContext = null;

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Save audio blob to IndexedDB
   */
  async function saveAudio(blob, duration) {
    const id = SmartMemoDB.generateId();
    const record = {
      id,
      blob,
      duration: duration || 0,
      createdAt: new Date().toISOString()
    };
    await SmartMemoDB.put(SmartMemoDB.STORES.AUDIO, record);
    return id;
  }

  /**
   * Get audio from IndexedDB
   */
  async function getAudio(id) {
    return SmartMemoDB.get(SmartMemoDB.STORES.AUDIO, id);
  }

  /**
   * Get audio URL  
   */
  async function getAudioUrl(id) {
    const record = await getAudio(id);
    if (!record || !record.blob) return null;
    return URL.createObjectURL(record.blob);
  }

  /**
   * Delete audio
   */
  async function deleteAudio(id) {
    await SmartMemoDB.remove(SmartMemoDB.STORES.AUDIO, id);
  }

  /**
   * Check if currently recording
   */
  function getIsRecording() {
    return isRecording;
  }

  /**
   * Format seconds to mm:ss
   */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return {
    startRecording,
    stopRecording,
    saveAudio,
    getAudio,
    getAudioUrl,
    deleteAudio,
    getIsRecording,
    formatTime
  };
})();
