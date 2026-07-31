import { useState, useRef } from 'react';
import { Mic, Upload, X } from 'lucide-react';
import { api } from '../api/api';

export default function VoiceNotes() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
  };

  const transcribe = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.transcribeVoice(fd);
      setResult(res);
    } catch (e) {
      alert('Transcription failed: ' + e.message);
    } finally { setLoading(false); }
  };

  const urgencyColor = (u) => {
    if (u === 'high') return 'var(--danger)';
    if (u === 'medium') return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Voice Notes</h1>
          <p>Upload an audio recording — transcribed locally via Whisper and analyzed by Claude.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Upload card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upload Audio</span>
          </div>
          <div className="card-body">
            <div
              className={`drop-zone${drag ? ' drag-over' : ''}`}
              onClick={() => inputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            >
              <div className="drop-zone-icon"><Mic size={32} color="var(--text-muted)" /></div>
              <div className="drop-zone-text">
                <strong>Click or drag</strong> to upload audio<br />
                <span style={{ fontSize: '0.7rem' }}>Supports MP3, WAV, M4A, OGG, FLAC, WEBM</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>

            {file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <Mic size={16} color="var(--brand-500)" />
                <span style={{ fontSize: '0.8rem', flex: 1 }}>{file.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(0)} KB</span>
                <button className="btn-icon" onClick={() => { setFile(null); setResult(null); }}><X size={14} /></button>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={transcribe} disabled={!file || loading}>
                {loading ? (
                  <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,.3)', borderTopColor: 'white' }} /> Transcribing…</>
                ) : (
                  <><Upload size={14} /> Transcribe &amp; Analyze</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result card */}
        {result && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Analysis Result</span>
              {result.analysis?.urgency && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: urgencyColor(result.analysis.urgency) }}>
                  ● {result.analysis.urgency.toUpperCase()} PRIORITY
                </span>
              )}
            </div>
            <div className="card-body">
              {/* Transcript */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ marginBottom: 6 }}>📝 Transcript</div>
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', fontSize: '0.8rem', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto' }}>
                  {result.transcript || 'No transcript available.'}
                </div>
              </div>

              {result.analysis && (
                <>
                  {/* Summary */}
                  <div style={{ marginBottom: 12 }}>
                    <div className="form-label">💡 AI Summary</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{result.analysis.summary}</div>
                  </div>

                  {/* Task Title */}
                  {result.analysis.task_title && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--brand-50)', borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-700)' }}>
                      📌 {result.analysis.task_title}
                    </div>
                  )}

                  {/* Action Items */}
                  {result.analysis.action_items?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="form-label">✅ Action Items</div>
                      <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.analysis.action_items.map((item, i) => (
                          <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Reply */}
                  {result.analysis.suggested_reply && result.analysis.suggested_reply !== 'N/A' && (
                    <div>
                      <div className="form-label">💬 Suggested Reply</div>
                      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{result.analysis.suggested_reply}"
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
