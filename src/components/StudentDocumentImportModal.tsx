import React, { useState } from 'react';
import API from '../services/api';
import { Upload, FileText, CheckCircle2, AlertCircle, Download, Copy, Check, X, Users } from 'lucide-react';

interface CreatedStudent {
  _id: string;
  name: string;
  email: string;
  generatedPassword: string;
}

interface SkippedStudent {
  name?: string;
  email: string;
  reason: string;
}

interface ImportResult {
  message: string;
  totalProcessed: number;
  createdCount: number;
  skippedCount: number;
  createdStudents: CreatedStudent[];
  skippedStudents: SkippedStudent[];
}

interface StudentDocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StudentDocumentImportModal: React.FC<StudentDocumentImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Name,Email,Password\n' +
      'John Doe,john.doe@example.com,\n' +
      'Alice Smith,alice.smith@example.com,CustomPass123!\n' +
      'Robert Johnson,robert.j@example.com,\n';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_students.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a document file (.csv, .json, or .txt) to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await API.post('/auth/bulk-import-students', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to import student document. Check format and try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = (password: string, index: number) => {
    navigator.clipboard.writeText(password);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllCredentials = () => {
    if (!result || !result.createdStudents) return;

    const credentialsText = result.createdStudents
      .map((s) => `Name: ${s.name} | Email: ${s.email} | Password: ${s.generatedPassword}`)
      .join('\n');

    navigator.clipboard.writeText(credentialsText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const resetState = () => {
    setFile(null);
    setError(null);
    setResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Bulk Student Document Upload</h2>
              <p className="text-xs text-slate-400">Import student details from CSV, JSON, or TXT document</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <div className="space-y-6">
              {/* File Upload Box */}
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 bg-slate-800/30 rounded-2xl p-8 text-center transition group">
                <input
                  type="file"
                  id="studentDocInput"
                  accept=".csv, .json, .txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="studentDocInput" className="cursor-pointer block">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition border border-blue-500/20">
                    <Upload className="w-7 h-7" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-sm font-semibold text-blue-400">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Click to select or drag student document file here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Supports .CSV, .JSON, or .TXT formats</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Format Guidelines & Template Download */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Need a sample format template?</p>
                    <p className="text-[11px] text-slate-400">Download a pre-formatted CSV template file with headers</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sample Template</span>
                </button>
              </div>
            </div>
          ) : (
            /* Results Summary */
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
                  <p className="text-2xl font-bold text-white">{result.totalProcessed}</p>
                  <p className="text-xs text-slate-400 mt-1">Total Processed</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.createdCount}</p>
                  <p className="text-xs text-emerald-300/80 mt-1">Created Accounts</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-2xl font-bold text-amber-400">{result.skippedCount}</p>
                  <p className="text-xs text-amber-300/80 mt-1">Skipped (Duplicates)</p>
                </div>
              </div>

              {/* Created Accounts Credentials Table */}
              {result.createdStudents && result.createdStudents.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Created Student Credentials ({result.createdStudents.length})
                    </h3>
                    <button
                      type="button"
                      onClick={copyAllCredentials}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
                    >
                      {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAll ? 'Copied All!' : 'Copy All Credentials'}</span>
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Email</th>
                          <th className="px-4 py-2.5">Generated Password</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {result.createdStudents.map((s, idx) => (
                          <tr key={s._id || idx} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2.5 font-medium text-white">{s.name}</td>
                            <td className="px-4 py-2.5 text-slate-400">{s.email}</td>
                            <td className="px-4 py-2.5 font-mono text-emerald-400">{s.generatedPassword}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => copyPassword(s.generatedPassword, idx)}
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                                title="Copy Password"
                              >
                                {copiedIndex === idx ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Skipped Students list */}
              {result.skippedStudents && result.skippedStudents.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-amber-400">Skipped Records ({result.skippedStudents.length})</h3>
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40 text-xs space-y-1 max-h-32 overflow-y-auto">
                    {result.skippedStudents.map((sk, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-400">
                        <span>{sk.email}</span>
                        <span className="text-amber-400/80 text-[11px]">{sk.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          {!result ? (
            <>
              <button
                type="button"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || loading}
                onClick={handleUpload}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition shadow-lg shadow-blue-600/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Document...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Import Student Document</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetState();
                onClose();
              }}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Done & Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDocumentImportModal;
