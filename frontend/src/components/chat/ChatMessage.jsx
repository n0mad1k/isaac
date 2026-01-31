import React from 'react'
import { User, Bot } from 'lucide-react'

function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          backgroundColor: isUser ? 'var(--color-green-600)' : 'var(--color-bg-surface-muted)',
          color: isUser ? 'white' : 'var(--color-text-secondary)',
        }}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        style={{
          backgroundColor: isUser ? 'var(--color-green-600)' : 'var(--color-bg-surface-soft)',
          color: isUser ? 'white' : 'var(--color-text-primary)',
        }}
      >
        {/* Render message content with basic line breaks */}
        {message.content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < message.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default ChatMessage
