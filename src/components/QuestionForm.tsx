import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import API from '../services/api';

interface Question {
  _id?: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

interface QuestionFormProps {
  question?: Question | null;
  onClose: () => void;
  onSave: () => void;
}

const QuestionForm: React.FC<QuestionFormProps> = ({ question, onClose, onSave }) => {
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (question) {
      setQuestionText(question.questionText);
      setOptions([...question.options]);
      setCorrectAnswer(question.correctAnswer);
      setDifficulty(question.difficulty);
      setTopic(question.topic);
    }
  }, [question]);

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!questionText.trim()) return setError('Question text is required');
    if (options.some((opt) => !opt.trim())) return setError('All 4 options must be filled');
    if (!topic.trim()) return setError('Topic is required');

    setLoading(true);
    try {
      const payload = {
        questionText,
        options,
        correctAnswer,
        difficulty,
        topic,
      };

      if (question?._id) {
        // Edit Question
        await API.put(`/questions/${question._id}`, payload);
      } else {
        // Create Question
        await API.post('/questions', payload);
      }

      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-xl rounded-xl shadow-2xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {question ? 'Edit Question' : 'Create New Question'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Question Prompt
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. What is the output of console.log(typeof NaN)?"
              className="w-full px-4 py-2.5 glass-input text-sm resize-none h-20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. JavaScript"
                className="w-full px-4 py-2.5 glass-input text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full px-4 py-2.5 glass-input text-sm bg-[#121620]"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Answer Options
            </label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                <span className="w-6 text-xs font-bold text-indigo-400 text-center">
                  {String.fromCharCode(65 + idx)}
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-4 py-2.5 glass-input text-sm"
                  required
                />
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={correctAnswer === idx}
                  onChange={() => setCorrectAnswer(idx)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-gray-700"
                  title="Mark as correct answer"
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 transition-all"
            >
              {loading ? 'Saving...' : question ? 'Update Question' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuestionForm;
