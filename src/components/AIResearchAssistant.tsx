import React, { useState } from 'react';
import { Bill } from '../types/legislative';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw,
  ExternalLink,
  Flame
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  engine?: string;
  groundedBills?: Array<{
    billNumber: string;
    author: string;
    caption: string;
    stance: string;
    priorityScore: number;
  }>;
  timestamp: string;
}

interface AIResearchAssistantProps {
  onSelectBillNumber: (billNumber: string) => void;
  session: string;
}

const DEFAULT_QUESTIONS = [
  'How many bills has Harrison filed, which was first, and what does it do?',
  'What does HB 101 by John Bucy and SB 31 by Judith Zaffirini do regarding Medicaid expansion?',
  'What does Brian Harrison propose in HB 708 regarding emergency executive disaster powers?',
  'What does Donna Howard propose in HB 126 regarding healthcare restrictions?',
  'Summarize landmark education bill HB 2 from the 89th session signed by the Governor.',
];

export const AIResearchAssistant: React.FC<AIResearchAssistantProps> = ({
  onSelectBillNumber,
  session,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Welcome to the Texas Capitol Legislative Intelligence Assistant. I am grounded in the complete 90R and 89R statutory datasets, official House Research Organization bill analyses, Legislative Budget Board fiscal notes, and your custom policy priorities.\n\nYou can ask me specific questions about lawmakers, bill filings, timelines, and comport/conflict evaluations.`,
      engine: 'Capitol Structured Knowledge Engine',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend, session }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'No analysis generated.',
        engine: data.engine || 'Gemini 3.8 Flash',
        groundedBills: data.groundedBills || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error connecting to analysis engine: ${err.message}. Please check your connection.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: 'Session reset. Ready for new legislative inquiries.',
        engine: 'Texas Capitol Intelligence Engine',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Texas Capitol AI Legislative Analyst</span>
            </h2>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Grounding Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hybrid policy reasoning engine querying structured SQLite facts and vector excerpts for the Texas Legislature.
          </p>
        </div>

        <button
          onClick={handleResetChat}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Suggested Questions */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Flame className="w-3 h-3 text-amber-400" />
          <span>Verified Query Benchmarks (Including Harrison Filing Query):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="text-left text-xs px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 text-slate-300 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 min-h-[420px] max-h-[580px] overflow-y-auto space-y-5">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs md:text-sm leading-relaxed space-y-2 ${
                  isUser
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-100 rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </div>

                {/* Grounded Bill References */}
                {msg.groundedBills && msg.groundedBills.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-slate-800 space-y-2">
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Referenced Texas Bills ({msg.groundedBills.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.groundedBills.map((b, i) => (
                        <div
                          key={i}
                          onClick={() => onSelectBillNumber(b.billNumber)}
                          className="cursor-pointer p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono font-bold text-amber-300 text-xs">
                              {b.billNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-1.5">by {b.author}</span>
                          </div>
                          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            b.stance === 'OPPOSE' ? 'text-rose-400 bg-rose-950/40' : 'text-emerald-400 bg-emerald-950/40'
                          }`}>
                            {b.stance}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message Footer */}
                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-500">
                  <span>{msg.engine || 'Assistant'}</span>
                  <span>{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-400">
              Cross-referencing Texas Capitol statutory texts, committee transcripts, and policy priorities...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-2.5 focus-within:border-amber-500/60 shadow-md"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a bill, author timeline, comport/conflict reasons, or committee hearing..."
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 pl-3 focus:outline-none placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
};
