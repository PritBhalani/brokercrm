import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import Papa from 'papaparse';
import { useNotifications } from '../context/NotificationContext.tsx';
import api from '../services/api.ts';

interface CSVUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface RowError {
  row: number;
  name: string;
  error: string;
}

const normalizeStatus = (s: string) => {
  if (!s) return 'New';
  const x = String(s).toLowerCase().trim();
  const map: Record<string, string> = {
    new: 'New',
    interested: 'Interested',
    callback: 'Callback',
    converted: 'Converted',
    readytoworktomorrow: 'ReadyToWorkTomorrow',
    'ready tomorrow': 'ReadyToWorkTomorrow',
    ringing: 'Ringing',
    switchoff: 'SwitchOff',
    'switch off': 'SwitchOff',
    numbernotvalid: 'NumberNotValid',
    'number not valid': 'NumberNotValid',
  };
  return map[x] || 'New';
};

const normPhone = (p: string) => String(p || '').trim().replace(/\s/g, '');

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ onClose, onSuccess }) => {
  const { addNotification } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorLog, setErrorLog] = useState<RowError[]>([]);
  const [status, setStatus] = useState<'idle' | 'preview' | 'uploading' | 'success' | 'error' | 'partial_success'>('idle');
  const [previewRows, setPreviewRows] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateInfo = useMemo(() => {
    if (!previewRows?.length) return { duplicatePhones: [] as string[], rowFlags: new Map<number, boolean>() };
    const counts = new Map<string, number>();
    for (const row of previewRows) {
      const p = normPhone(row.phone);
      if (!p) continue;
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    const duplicatePhones = [...counts.entries()].filter(([, c]) => c > 1).map(([p]) => p);
    const dupSet = new Set(duplicatePhones);
    const rowFlags = new Map<number, boolean>();
    previewRows.forEach((row, i) => {
      const p = normPhone(row.phone);
      rowFlags.set(i, p ? dupSet.has(p) : false);
    });
    return { duplicatePhones, rowFlags };
  }, [previewRows]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a valid CSV file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setErrorLog([]);
      setPreviewRows(null);
      setStatus('idle');
    }
  };

  const validateRow = (row: any, index: number): string | null => {
    if (!row.name || row.name.trim() === '') return `Row ${index + 1}: Name is required.`;
    if (!row.phone || row.phone.trim() === '') return `Row ${index + 1}: Phone is required.`;
    if (row.email && row.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) return `Row ${index + 1}: Invalid email format.`;
    }
    return null;
  };

  const processCSV = async (data: any[]) => {
    setStatus('uploading');
    let successCount = 0;
    const errors: RowError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const validationError = validateRow(row, i);

      if (validationError) {
        errors.push({ row: i + 1, name: row.name || 'Unknown', error: validationError });
        setProgress(Math.round(((i + 1) / data.length) * 100));
        continue;
      }

      try {
        await api.post('/leads', {
          name: row.name.trim(),
          phone: normPhone(row.phone),
          email: (row.email || '').trim(),
          status: normalizeStatus(row.status),
          investmentInterest: (row.investmentInterest || '').trim(),
        });
        successCount++;
      } catch (err: any) {
        errors.push({
          row: i + 1,
          name: row.name,
          error: err.response?.data?.message || err.message || 'Failed to save to database',
        });
      }
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    setErrorLog(errors);

    if (successCount === data.length) {
      setStatus('success');
    } else if (successCount > 0) {
      setStatus('partial_success');
    } else {
      setStatus('error');
      setError('Failed to import any leads. Check the error log below.');
    }

    addNotification({
      title: successCount === data.length ? 'Upload complete' : 'Upload finished with issues',
      message: `Imported ${successCount} leads. ${errors.length} errors.`,
      type: errors.length === 0 ? 'success' : successCount > 0 ? 'warning' : 'error',
    });

    if (successCount > 0) onSuccess();
  };

  /** Parse file and show preview (no API writes). */
  const handleReview = async () => {
    if (!file) return;

    setUploading(true);
    setStatus('idle');
    setError(null);
    setErrorLog([]);
    setPreviewRows(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];

        if (data.length === 0) {
          setError('The CSV file is empty.');
          setStatus('error');
          setUploading(false);
          return;
        }

        const headers = Object.keys(data[0]);
        const missingHeaders = ['name', 'phone'].filter((h) => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setStatus('error');
          setUploading(false);
          return;
        }

        setPreviewRows(data);
        setStatus('preview');
        setUploading(false);
      },
      error: () => {
        setError('Failed to parse the CSV file.');
        setStatus('error');
        setUploading(false);
      },
    });
  };

  const handleConfirmImport = async () => {
    if (!previewRows?.length) return;
    setUploading(true);
    await processCSV(previewRows);
    setUploading(false);
  };

  const previewSlice = previewRows?.slice(0, 20) ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-app-surface w-full max-w-4xl rounded-3xl shadow-md shadow-black/20 p-8 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-app-text-active">Import leads</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-app-surface-hover rounded-full transition-colors">
            <X size={24} className="text-app-text-muted" />
          </button>
        </div>

        <div className="space-y-6">
          {status !== 'preview' && status !== 'uploading' && !['success', 'partial_success'].includes(status) && (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                file ? 'border-blue-500 bg-blue-950/20' : 'border-app-border hover:border-blue-400 hover:bg-app-root'
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              {file ? (
                <div className="space-y-2">
                  <FileText className="mx-auto text-blue-400" size={48} />
                  <p className="font-bold text-app-text-active">{file.name}</p>
                  <p className="text-xs text-app-text-muted">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto text-app-text-muted" size={48} />
                  <p className="font-bold text-app-text-active">Click to select CSV</p>
                  <p className="text-xs text-app-text-muted">Only .csv files are supported</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 text-rose-200 rounded-xl flex items-start gap-3 text-sm border border-rose-500/30">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>{error}</p>
            </div>
          )}

          {status === 'preview' && previewRows && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <p className="text-app-text-active">
                  <strong>{previewRows.length}</strong> rows parsed
                </p>
                {duplicateInfo.duplicatePhones.length > 0 ? (
                  <p className="text-amber-300 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>
                      <strong>{duplicateInfo.duplicatePhones.length}</strong> phone number(s) repeated in this file — rows
                      highlighted. Server may still reject duplicates (unique phone).
                    </span>
                  </p>
                ) : (
                  <p className="text-emerald-400/90 text-sm">No duplicate phones within this file.</p>
                )}
              </div>

              <div className="overflow-x-auto border border-app-border rounded-xl max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-app-root sticky top-0 text-app-text-muted uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Status →</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSlice.map((row, i) => {
                      const flagged = duplicateInfo.rowFlags.get(i);
                      return (
                        <tr
                          key={i}
                          className={flagged ? 'bg-amber-950/40 border-l-2 border-amber-500' : 'border-b border-app-border/60'}
                        >
                          <td className="px-3 py-2 text-app-text-muted">{i + 1}</td>
                          <td className="px-3 py-2 text-app-text-active font-medium">{row.name}</td>
                          <td className="px-3 py-2 font-mono">{normPhone(row.phone)}</td>
                          <td className="px-3 py-2 text-app-text">{normalizeStatus(row.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 20 && (
                <p className="text-[10px] text-app-text-muted">Showing first 20 of {previewRows.length} rows.</p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewRows(null);
                    setStatus('idle');
                  }}
                  className="px-4 py-2 rounded-xl bg-app-surface-hover text-app-text font-semibold text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  Confirm import ({previewRows.length} rows)
                </button>
              </div>
            </div>
          )}

          {uploading && status === 'uploading' && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-app-text-muted uppercase">
                <span>Importing…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-app-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {(status === 'success' || status === 'partial_success') && !uploading && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${
                status === 'success' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
              }`}
            >
              {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {status === 'success' ? 'All leads imported successfully.' : 'Import finished with some errors.'}
            </div>
          )}

          {errorLog.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-app-text-muted uppercase tracking-widest">Error log ({errorLog.length})</p>
              <div className="max-h-40 overflow-y-auto border border-app-border rounded-xl divide-y divide-app-border">
                {errorLog.map((err, idx) => (
                  <div key={idx} className="p-3 text-xs flex justify-between gap-4">
                    <span className="font-bold text-app-text-active whitespace-nowrap">Row {err.row}</span>
                    <span className="text-app-text-muted truncate">{err.name}</span>
                    <span className="text-rose-400 text-right">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status !== 'preview' && (
            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading && status === 'uploading'}
                className="flex-1 py-4 bg-app-surface-hover text-app-text font-bold rounded-2xl hover:bg-app-border transition-all disabled:opacity-50"
              >
                {status === 'success' || status === 'partial_success' ? 'Close' : 'Cancel'}
              </button>
              {status !== 'success' && status !== 'partial_success' && !previewRows && (
                <button
                  type="button"
                  onClick={() => void handleReview()}
                  disabled={!file || uploading}
                  className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-sm shadow-black/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Parsing…
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Review import
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="p-4 bg-app-root rounded-xl">
            <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest mb-2">CSV format</p>
            <p className="text-xs text-app-text-muted leading-relaxed">
              Required columns: <span className="font-bold text-app-text">name, phone</span>
              <br />
              Optional: <span className="font-bold text-app-text">email, status, investmentInterest</span>
              <br />
              Status values map to: New, Interested, Callback, Ringing, Switch off, Number not valid, Converted (paid client),
              ReadyToWorkTomorrow — unknown values default to New.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
