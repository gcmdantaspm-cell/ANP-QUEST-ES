import React, { useState } from 'react';
import { Question } from '../types/question';
import { downloadOfflineHtmlFile } from '../utils/htmlExporter';
import { Download, Check, Sparkles, X, FileText } from 'lucide-react';

interface OfflineExporterProps {
  questions: Question[];
  currentFilterLabel?: string;
}

export const OfflineExporter: React.FC<OfflineExporterProps> = ({
  questions,
  currentFilterLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [fileName, setFileName] = useState('simulado_offline_concurso');

  const handleDownload = () => {
    if (questions.length === 0) return;

    const safeName = (fileName.trim() || 'simulado_offline_concurso').replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );
    const finalName = `${safeName}.html`;
    const title = currentFilterLabel || 'Caderno Interativo de Questões Offline';

    downloadOfflineHtmlFile(questions, finalName, title);

    setDownloaded(true);
    setTimeout(() => {
      setDownloaded(false);
      setIsOpen(false);
    }, 1800);
  };

  return (
    <>
      <button
        id="btn-open-offline-modal"
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={questions.length === 0}
        className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        title="Gerar arquivo HTML estático para estudar sem conexão à internet"
      >
        <Download className="w-4 h-4" />
        <span>Baixar Questões Offline</span>
        {questions.length > 0 && (
          <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-700 text-white rounded text-[11px]">
            {questions.length}
          </span>
        )}
      </button>

      {/* Modal de configuração e confirmação do download */}
      {isOpen && (
        <div
          id="offline-export-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 sm:p-6 text-slate-800">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Exportar Caderno Offline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gera um arquivo .html 100% autônomo com JS nativo
                  </p>
                </div>
              </div>
              <button
                id="btn-close-offline-modal"
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-5 text-xs sm:text-sm">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Funciona sem nenhuma internet
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  O arquivo baixado contém todos os estilos CSS e lógica
                  JavaScript embarcada. Você poderá clicar nas alternativas,
                  conferir o gabarito comentado, ler os macetes e acompanhar sua
                  pontuação mesmo em modo avião!
                </p>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600">Questões a exportar:</span>
                <span className="font-bold text-slate-900">
                  {questions.length} questão(ões)
                </span>
              </div>

              {currentFilterLabel && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-xs">
                  <span className="text-slate-600">Filtro aplicado:</span>
                  <span className="font-semibold text-blue-700 truncate max-w-[200px]">
                    {currentFilterLabel}
                  </span>
                </div>
              )}

              <div>
                <label
                  htmlFor="input-offline-filename"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do Arquivo (.html)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="input-offline-filename"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="meu_simulado_offline"
                    className="flex-1 text-xs sm:text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <span className="text-xs text-slate-400 font-mono">.html</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                id="btn-cancel-offline-download"
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-offline-download"
                type="button"
                onClick={handleDownload}
                disabled={downloaded}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {downloaded ? (
                  <>
                    <Check className="w-4 h-4" />
                    Arquivo Baixado!
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Baixar Arquivo HTML
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
