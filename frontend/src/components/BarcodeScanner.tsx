import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from '@ericblade/quagga2';
import { X, Camera, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [flash, setFlash] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleDetected = useCallback(
    (result: any) => {
      const code = result?.codeResult?.code;
      if (!code || code === lastResult) return;

      // Debounce repeated reads
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setLastResult(code);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
        onScan(code);
        // Stop after successful scan
        Quagga.stop();
        setScanning(false);
      }, 300);
    },
    [lastResult, onScan]
  );

  const startScanner = useCallback(() => {
    if (!scannerRef.current) return;
    setError('');
    setLastResult('');

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          constraints: { width: 480, height: 320, facingMode: 'environment' },
          target: scannerRef.current,
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            'code_128_reader',
            'ean_reader',
            'ean_8_reader',
            'code_39_reader',
            'upc_reader',
            'upc_e_reader',
            'code_93_reader',
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          setError('Camera access denied or not available. Please allow camera permissions.');
          return;
        }
        Quagga.start();
        setScanning(true);
      }
    );

    Quagga.onDetected(handleDetected);
  }, [handleDetected]);

  useEffect(() => {
    const timer = setTimeout(startScanner, 200);
    return () => {
      clearTimeout(timer);
      try { Quagga.stop(); Quagga.offDetected(handleDetected); } catch {}
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startScanner, handleDetected]);

  const handleManualEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('barcode') as HTMLInputElement).value.trim();
    if (input) {
      onScan(input);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Camera className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Barcode Scanner</h2>
              <p className="text-xs text-slate-500">Point camera at barcode or QR code</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner View */}
        <div className="relative bg-black" style={{ minHeight: '280px' }}>
          <div
            ref={scannerRef}
            className="w-full"
            style={{ minHeight: '280px' }}
          />

          {/* Scanning overlay */}
          <div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${flash ? 'bg-emerald-500/30' : ''}`}>
            {scanning && !error && (
              <>
                {/* Corner brackets */}
                <div className="absolute inset-8 border-2 border-transparent">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-sm" />
                </div>
                {/* Scanning line animation */}
                <div className="absolute left-10 right-10 h-0.5 bg-indigo-500/70 animate-[scan_2s_linear_infinite] shadow-lg shadow-indigo-500/50"
                  style={{ top: '30%', animation: 'scanLine 2s linear infinite' }} />
              </>
            )}
          </div>

          {/* Status overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
            {error ? (
              <div className="flex items-center space-x-2 text-red-400 text-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : flash && lastResult ? (
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle className="h-4 w-4" />
                <span>Detected: {lastResult}</span>
              </div>
            ) : scanning ? (
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <Zap className="h-4 w-4 text-indigo-400 animate-pulse" />
                <span>Scanning... align barcode within the frame</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-slate-500 text-xs">
                <div className="h-3 w-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                <span>Initializing camera...</span>
              </div>
            )}
          </div>
        </div>

        {/* Manual Entry */}
        <div className="p-5 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-3 text-center">— or enter manually —</p>
          <form onSubmit={handleManualEntry} className="flex space-x-3">
            <input
              name="barcode"
              type="text"
              placeholder="Type barcode / SKU..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 20%; }
          50% { top: 75%; }
          100% { top: 20%; }
        }
      `}</style>
    </div>
  );
};
