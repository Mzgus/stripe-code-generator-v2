
import React, { useState, useEffect, useRef } from 'react';
import { saveAs } from 'file-saver';

const WEBSOCKET_URL = 'ws://localhost:5001';

// Hardcoded list of users
const USER_LIST = ["Ilan", "Xavier", "Jean-Yves", "Jeremy"];

function App() {
  // Form state
  const [coupon, setCoupon] = useState('');
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [minimumAmountCurrency, setMinimumAmountCurrency] = useState('eur');
  const [user, setUser] = useState(USER_LIST[0]); // Default to the first user

  // App state
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ generated: 0, total: 0 });
  const [error, setError] = useState(null);
  const [partialFiles, setPartialFiles] = useState([]);

  const ws = useRef(null);

  useEffect(() => {
    // This effect runs only once on component mount to establish the connection
    if (ws.current) return; // Prevent re-connecting if already connected

    ws.current = new WebSocket(WEBSOCKET_URL);
    const currentWs = ws.current; // Capture instance for cleanup

    currentWs.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
    };

    currentWs.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setError('Could not connect to the server. Is it running? See console for details.');
      setIsConnected(false);
      setIsGenerating(false);
    };

    currentWs.onmessage = (message) => {
      const data = JSON.parse(message.data);
      switch (data.type) {
        case 'PROGRESS_UPDATE':
          setProgress(data.payload);
          break;
        case 'PARTIAL_FILE_GENERATED':
          handleFileGenerated(data.payload, true);
          break;
        case 'GENERATION_COMPLETE':
          handleFileGenerated(data.payload, false);
          setIsGenerating(false);
          break;
        case 'GENERATION_CANCELLED':
          setIsGenerating(false);
          break;
        case 'ERROR':
          setError(data.payload.message);
          setIsGenerating(false);
          break;
        default:
          break;
      }
    };

    // Cleanup on component unmount
    return () => {
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.close();
      }
    };
  }, []); // IMPORTANT: This effect MUST run only once.

  // This effect is responsible for the onclose logic that depends on `isGenerating`
  useEffect(() => {
    if (!ws.current) return;

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      // Only show error if it was generating and unexpectedly disconnected
      if (isGenerating) {
        setError('Connection to server lost. Please refresh and try again.');
        setIsGenerating(false);
      }
    };
  }, [isGenerating]); // Now correctly depends on isGenerating

  const handleStartGenerate = (e) => {
    e.preventDefault();
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to the server. Please wait or refresh.');
      return;
    }
    setError(null);
    setPartialFiles([]); // Clear partial files from previous run
    setProgress({ generated: 0, total: count });
    setIsGenerating(true);
    ws.current.send(JSON.stringify({ 
      type: 'START_GENERATION', 
      payload: { 
        coupon, 
        count, 
        prefix, 
        minimumAmount, 
        minimumAmountCurrency,
        user // Include the selected user
      } 
    }));
  };

  const handleCancelGenerate = () => {
    if (isGenerating && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'CANCEL_GENERATION' }));
    }
  };

  const handleFileGenerated = ({ fileContents, fileName }, isPartial) => {
    if (!fileContents) {
      if (!isPartial) setIsGenerating(false);
      return;
    }

    const byteCharacters = atob(fileContents);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(blob, fileName);

    if (isPartial) {
      setPartialFiles(prev => [...prev, fileName]);
    } else {
      setIsGenerating(false);
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.generated / progress.total) * 100 : 0;

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <img src='https://safebear.ai/favicon.png' className='w-25 mx-auto d-block' alt="logo" />
              <h3 className="card-title text-center mb-4">Stripe Promo Code Generator (V2)</h3>
              <div className="text-center mb-3">
                <span className={`badge bg-${isConnected ? 'success' : 'danger'}`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {!isGenerating && partialFiles.length === 0 ? (
                <form onSubmit={handleStartGenerate}>
                  <div className="mb-3">
                    <label htmlFor="user" className="form-label">Utilisateur</label>
                    <select className="form-select" id="user" value={user} onChange={(e) => setUser(e.target.value)}>
                      {USER_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="coupon" className="form-label">Id du coupon</label>
                    <input type="text" className="form-control" id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="e.g., 25OFF" required />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="count" className="form-label">Nombres de Codes</label>
                    <input type="number" className="form-control" id="count" value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} min="1" required />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="prefix" className="form-label">Prefix du code (Optionnel)</label>
                    <input type="text" className="form-control" id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g., MYPROMO-" />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="minimumAmount" className="form-label">Montant Minimum (Optionnel)</label>
                    <input type="number" className="form-control" id="minimumAmount" value={minimumAmount} onChange={(e) => setMinimumAmount(e.target.value)} placeholder="e.g., 1000" min="0" />
                    <small className="form-text text-muted">Montant en centimes (e.g., 1000 for $10.00)</small>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="minimumAmountCurrency" className="form-label">Devise</label>
                    <select className="form-select" id="minimumAmountCurrency" value={minimumAmountCurrency} onChange={(e) => setMinimumAmountCurrency(e.target.value)}>
                      <option value="usd">USD</option>
                      <option value="eur">EUR</option>
                      <option value="gbp">GBP</option>
                    </select>
                  </div>
                  <div className="d-grid">
                    <button type="submit" className="btn btn-primary" disabled={!isConnected || isGenerating}>Générer les codes</button>
                  </div>
                </form>
              ) : (
                <div className="text-center">
                  <h4>Génération des codes...</h4>
                  <p>{progress.generated} / {progress.total}</p>
                  <div className="progress" style={{ height: '25px' }}>
                    <div 
                      className="progress-bar progress-bar-striped progress-bar-animated" 
                      role="progressbar" 
                      style={{ width: `${progressPercentage}%` }} 
                      aria-valuenow={progressPercentage}
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    >
                      {Math.round(progressPercentage)}%
                    </div>
                  </div>
                  <button className="btn btn-danger mt-3" onClick={handleCancelGenerate}>Stop Génération</button>
                  
                  {partialFiles.length > 0 && (
                    <div className="mt-4">
                      <h5>Fichiers partiels générés :</h5>
                      <ul className="list-group">
                        {partialFiles.map((fileName, index) => (
                          <li key={index} className="list-group-item">{fileName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {!isGenerating && (
                     <button className="btn btn-secondary mt-3" onClick={() => {setPartialFiles([]); setProgress({ generated: 0, total: 0 });}}>Nouvelle Génération</button>
                  )}
                </div>
              )}

              {error && <div className="alert alert-danger mt-3">{error}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
