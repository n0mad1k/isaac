import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'

function ChatInput({ onSend, isStreaming, disabled }) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [message])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || isStreaming || disabled) return
    onSend(trimmed)
    setMessage('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? 'Isaac is thinking...' : 'Ask Isaac anything...'}
        disabled={isStreaming || disabled}
        rows={1}
        className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: 'var(--color-input-bg)',
          border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-primary)',
          maxHeight: '120px',
        }}
        data-no-capitalize="true"
      />
      <button
        type="submit"
        disabled={!message.trim() || isStreaming || disabled}
        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity"
        style={{
          backgroundColor: message.trim() && !isStreaming ? 'var(--color-green-600)' : 'var(--color-bg-surface-muted)',
          color: message.trim() && !isStreaming ? 'white' : 'var(--color-text-muted)',
          opacity: !message.trim() || isStreaming ? 0.5 : 1,
        }}
      >
        {isStreaming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </button>
    </form>
  )
}

export default ChatInput
