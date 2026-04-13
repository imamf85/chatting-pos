import { useState, useRef, useEffect } from 'react';
import { parseOrder, applyMissingVarian } from '../../lib/parser';
import { VARIAN_OPTIONS, VARIAN_LABELS } from '../../lib/menu';
import type { ParsedItem, Varian } from '../../types';

interface OrderChatProps {
  onOrderParsed: (items: ParsedItem[], namaCustomer: string) => void;
}

type ChatState = 'idle' | 'waitingClarification';

interface Message {
  id: string;
  type: 'user' | 'system';
  text: string;
}

export default function OrderChat({ onOrderParsed }: OrderChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      text: 'Halo! Ketik pesanan seperti di WhatsApp ya 👋\n\nContoh:\n• "2 sig jumbo pedas"\n• "PESENAN A.N BUDI: ori 3 sedang & 2 pedas"',
    },
  ]);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [pendingItems, setPendingItems] = useState<ParsedItem[]>([]);
  const [pendingNama, setPendingNama] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const addMessage = (type: 'user' | 'system', text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), type, text },
    ]);
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;

    addMessage('user', text);
    setInput('');

    if (chatState === 'waitingClarification') {
      handleClarificationResponse(text);
    } else {
      handleNewOrder(text);
    }

    inputRef.current?.focus();
  };

  const handleNewOrder = (text: string) => {
    const result = parseOrder(text);

    if (result.items.length === 0) {
      addMessage(
        'system',
        'Hmm, tidak menemukan item pesanan 🤔\n\nCoba tulis ulang ya, contoh:\n"sig 2 pedas" atau "ori jumbo 3"'
      );
      return;
    }

    if (result.hasMissingVarian) {
      const missingCount = result.items.filter((i) => !i.varian).length;
      setPendingItems(result.items);
      setPendingNama(result.namaCustomer);
      setChatState('waitingClarification');
      addMessage(
        'system',
        `Ada ${missingCount} item yang variannya belum jelas 🧐\n\nMau pakai varian apa?\n• Original\n• Signature\n• Cheesy`
      );
    } else {
      onOrderParsed(result.items, result.namaCustomer);
    }
  };

  const handleClarificationResponse = (text: string) => {
    const normalized = text.toLowerCase().trim();

    let selectedVarian: Varian | null = null;

    if (normalized.includes('ori') || normalized.includes('original')) {
      selectedVarian = 'original';
    } else if (normalized.includes('sig') || normalized.includes('signature')) {
      selectedVarian = 'signature';
    } else if (normalized.includes('cheese') || normalized.includes('cheesy')) {
      selectedVarian = 'cheesy';
    }

    if (!selectedVarian) {
      addMessage(
        'system',
        'Pilih salah satu varian ya:\n• Original\n• Signature\n• Cheesy'
      );
      return;
    }

    const updatedItems = applyMissingVarian(pendingItems, selectedVarian);
    setChatState('idle');
    setPendingItems([]);
    onOrderParsed(updatedItems, pendingNama);
    setPendingNama('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Quick varian buttons when waiting for clarification
  const handleQuickVarian = (varian: Varian) => {
    addMessage('user', VARIAN_LABELS[varian]);
    const updatedItems = applyMissingVarian(pendingItems, varian);
    setChatState('idle');
    setPendingItems([]);
    onOrderParsed(updatedItems, pendingNama);
    setPendingNama('');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-orange-50 to-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 whitespace-pre-wrap text-[15px] leading-relaxed ${
                msg.type === 'user'
                  ? 'bg-orange-500 text-white rounded-2xl rounded-br-md shadow-sm'
                  : 'bg-white text-gray-800 rounded-2xl rounded-bl-md shadow-md border border-gray-100'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Varian Buttons (when waiting for clarification) */}
      {chatState === 'waitingClarification' && (
        <div className="px-4 pb-2">
          <div className="flex gap-2">
            {VARIAN_OPTIONS.map((varian) => (
              <button
                key={varian}
                onClick={() => handleQuickVarian(varian)}
                className="flex-1 py-3 bg-white border-2 border-orange-200 text-orange-600 font-semibold
                           rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all
                           active:scale-95 shadow-sm"
              >
                {VARIAN_LABELS[varian]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area - Fixed at bottom */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              chatState === 'waitingClarification'
                ? 'Atau ketik varian...'
                : 'Ketik pesanan di sini...'
            }
            rows={1}
            className="flex-1 px-4 py-3 bg-gray-100 border-0 rounded-2xl resize-none
                       focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white
                       text-[16px] placeholder-gray-400 transition-all"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-12 h-12 flex items-center justify-center bg-orange-500 text-white
                       rounded-full shadow-lg hover:bg-orange-600 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
