import React, { useState } from 'react';
import { parseSimuladoRawQuestions, SAMPLE_SIMULADO_TEXT } from '../utils/simuladoParser';
import { Simulado, SimuladoQuestion } from '../types/simulado';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Scale,
  BookOpen,
  Clock,
  Layers,
  HelpCircle,
  Trash2,
} from 'lucide-react';

interface SimuladoImporterProps {
  onSaveSimulado: (simulado: Simulado) => void;
  onCancel: () => void;
}

export const SimuladoImporter: React.FC<SimuladoImporterProps> = ({
  onSaveSimulado,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState(60);
  const [rawText, setRawText] = useState('');
  const [parsedResult, setParsedResult] = useState<{
    questions: SimuladoQuestion[];
    errors: string[];
    totalPeso: number;
    materias: string[];
  } | null>(null);

  const handleParse = () => {
    if (!rawText.trim()) return;
    const res = parseSimuladoRawQuestions(rawText);
    setParsedResult(res);
  };

  const handleLoadSample = () => {
    setTitulo('Simulado 01 - Carreiras Policiais & Jurídicas');
    setDescricao('Simulado com questões ponderadas por matéria para teste de alto rendimento.');
    setDuracaoMinutos(90);
    setRawText(SAMPLE_SIMULADO_TEXT);
    const res = parseSimuladoRawQuestions(SAMPLE_SIMULADO_TEXT);
    setParsedResult(res);
  };

  const handleSave = () => {
    if (!titulo.trim()) {
      alert('Por favor, informe o título do simulado.');
      return;
    }
    if (!parsedResult || parsedResult.questions.length === 0) {
      alert('Nenhuma questão válida foi processada. Cole o texto e clique em "Processar Questões".');
      return;
    }

    const newSimulado: Simulado = {
      id: `simulado_${Date.now()}`,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      duracaoMinutos: Number(duracaoMinutos) || 0,
      questoes: parsedResult.questions,
      totalQuestoes: parsedResult.questions.length,
      pesoTotal: parsedResult.totalPeso,
      materias: parsedResult.materias,
      createdAt: new Date().toISOString(),
    };

    onSaveSimulado(newSimulado);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6 animate-in fade-in">
      {/* Cabeçalho do Importador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Importador Simplificado de Simulados
            </h2>
            <p className="text-xs text-slate-500">
              Cadastre questões informando <strong>apenas a Matéria e o Peso</strong> da questão.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Carregar Exemplo de Simulado Pronto
        </button>
      </div>

      {/* Regra de Ouro em Destaque */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-bold text-blue-950">
            Estrutura Livre e Direta (Sem burocracia de módulo, capítulo ou subtópico):
          </p>
          <p>
            Basta declarar no topo de cada questão a <strong>Matéria</strong> (ex: <em>Matéria: Direito Penal</em>) e o <strong>Peso</strong> (ex: <em>Peso: 2</em> ou <em>Peso: 1.5</em>).
            As questões podem ser separadas por <strong>---</strong> ou identificadas automaticamente.
          </p>
        </div>
      </div>

      {/* Dados do Simulado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Título do Simulado *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Simulado Geral 01 - Carreiras Policiais & GCM"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Tempo Limite (Minutos)
          </label>
          <input
            type="number"
            min={0}
            max={600}
            value={duracaoMinutos}
            onChange={(e) => setDuracaoMinutos(Number(e.target.value))}
            placeholder="Ex: 60 (0 para livre)"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            {duracaoMinutos > 0 ? `${duracaoMinutos} minutos de prova` : 'Sem limite de tempo'}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Descrição / Instruções aos Candidatos (Opcional)
        </label>
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Simulado composto por 4 disciplinas com pesos diferenciados e pontuação ponderada."
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
        />
      </div>

      {/* Caixa de Texto das Questões */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Texto das Questões (com Matéria e Peso) *
          </label>
          {rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText('');
                setParsedResult(null);
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Texto
            </button>
          )}
        </div>
        <textarea
          rows={12}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Cole aqui as questões do simulado. Exemplo prático:

Matéria: Direito Penal
Peso: 2
Acerca do crime de prevaricação, assinale a opção correta:
A) Exige intuito de satisfazer interesse ou sentimento pessoal.
B) Consuma-se apenas com dano patrimonial ao Estado.
C) É punido exclusivamente a título de culpa.
Gabarito: A
Comentário: A prevaricação (art. 319 do CP) exige o elemento subjetivo especial...

---
Matéria: Português
Peso: 1
Assinale a palavra corretamente grafada...`}
          className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
        />
      </div>

      {/* Botão de Processar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleParse}
          disabled={!rawText.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Processar & Visualizar Questões
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      {/* Prévia do Resultado Processado */}
      {parsedResult && (
        <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <span className="text-xs">
                  Questões identificadas: <strong>{parsedResult.questions.length}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <span className="text-xs">
                  Pontos Totais (Pesos): <strong>{parsedResult.totalPeso} pts</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Matérias:</span>
              {parsedResult.materias.map((mat) => (
                <span
                  key={mat}
                  className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30"
                >
                  {mat}
                </span>
              ))}
            </div>
          </div>

          {parsedResult.errors.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                Avisos de processamento:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {parsedResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Cards de Prévia das Questões */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {parsedResult.questions.map((q, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 bg-white border border-slate-300 px-2 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                      Matéria: {q.materia}
                    </span>
                    <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      Peso {q.peso}
                    </span>
                  </div>

                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Gabarito: {q.alternativa_correta}
                  </span>
                </div>

                <p className="text-slate-800 font-medium whitespace-pre-line line-clamp-3">
                  {q.enunciado}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                  {q.alternativas.map((alt) => (
                    <div
                      key={alt.letra}
                      className={`p-1.5 rounded border ${
                        alt.letra === q.alternativa_correta
                          ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <strong>{alt.letra})</strong> {alt.texto}
                    </div>
                  ))}
                </div>

                {q.gabarito_comentado && (
                  <p className="text-[11px] text-slate-500 italic line-clamp-2">
                    <strong>Comentário:</strong> {q.gabarito_comentado}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Botão Final de Salvar */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleSave}
              className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar e Disponibilizar Simulado ({parsedResult.questions.length} Questões)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
