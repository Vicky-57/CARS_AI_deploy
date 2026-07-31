import React, { useState } from 'react';

export default function VoiceTranscriber() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const API_BASE = 'http://localhost:9000';

  const handleTranscribe = async () => {
    if (!file) return alert('Please select an audio file first.');
    setLoading(true);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/test/transcribe_voice`, { method: 'POST', body });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert('Transcription failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">🎙️ Local Whisper Voice Transcriber & CRM Action Extractor</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="dropzone-container" onClick={() => document.getElementById('audio-input').click()}>
          <div style={{ fontSize: '2.5rem' }}>🎙️</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {file ? file.name : 'Click to select voice note audio (.mp3, .wav, .m4a)'}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Local Whisper Base Model</span>
        </div>
        <input type="file" id="audio-input" style={{ display: 'none' }} accept=".mp3,.wav,.m4a" onChange={(e) => setFile(e.target.files[0])} />

        <button className="btn-primary" onClick={handleTranscribe} disabled={loading}>
          {loading ? '🎙️ Running Local Whisper & Claude Processing...' : 'Run Whisper Transcribe & Action Extraction'}
        </button>

        {result && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <strong>Transcript:</strong>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{result.transcript}</div>
            </div>
            <div>
              <strong>Claude Analysis:</strong>
              <pre style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', overflowX: 'auto', fontSize: '0.85rem' }}>
                {JSON.stringify(result.analysis, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
