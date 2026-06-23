import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Trash2, MessageSquare, Lightbulb, ChevronLeft, Bot, WifiOff, Eye, XCircle } from 'lucide-react'
import {
  createConversation, getConversations, getConversation, deleteConversation,
  sendMessage, getAiHealth, getInsights, markInsightRead, dismissInsight, getUnreadInsightCount,
} from '../../services/api'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

function ChatPanel({ isOpen, onClose, onUnreadCountChange }) {
  const [tab, setTab] = useState('chat') // 'chat' | 'insights'
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [aiStatus, setAiStatus] = useState('checking') // checking, online, offline
  const [aiProvider, setAiProvider] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(false)
  const [showConversationList, setShowConversationList] = useState(true)
  const messagesEndRef = useRef(null)
  const panelRef = useRef(null)

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // Load data when panel opens
  useEffect(() => {
    if (isOpen) {
      checkHealth()
      loadConversations()
      if (tab === 'insights') loadInsights()
    }
  }, [isOpen, tab])

  // Check AI provider health (with retry)
  const checkHealth = async () => {
    setAiStatus('checking')
    try {
      const res = await getAiHealth()
      if (res.data.provider) setAiProvider(res.data.provider)
      if (res.data.model) setAiModel(res.data.model)
      if (res.data.status === 'online') {
        setAiStatus('online')
        return
      }
    } catch { /* first attempt failed */ }
    // Retry once after a short delay
    await new Promise(r => setTimeout(r, 2000))
    try {
      const res = await getAiHealth()
      if (res.data.provider) setAiProvider(res.data.provider)
      if (res.data.model) setAiModel(res.data.model)
      setAiStatus(res.data.status || 'offline')
    } catch {
      setAiStatus('offline')
    }
  }

  // Load conversation list
  const loadConversations = async () => {
    try {
      const res = await getConversations()
      setConversations(res.data.conversations || [])
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }

  // Load a specific conversation
  const loadConversation = async (id) => {
    setLoading(true)
    try {
      const res = await getConversation(id)
      setActiveConversation(res.data)
      setMessages(res.data.messages || [])
      setShowConversationList(false)
    } catch (err) {
      console.error('Failed to load conversation:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create new conversation
  const handleNewChat = async () => {
    try {
      const res = await createConversation()
      const conv = res.data
      setActiveConversation(conv)
      setMessages([])
      setShowConversationList(false)
      // Refresh list
      loadConversations()
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  // Delete conversation
  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation()
    try {
      await deleteConversation(id)
      if (activeConversation?.id === id) {
        setActiveConversation(null)
        setMessages([])
        setShowConversationList(true)
      }
      loadConversations()
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  // Send message with SSE streaming
  const handleSend = async (content) => {
    if (!activeConversation || isStreaming) return

    // Add user message immediately
    const userMsg = { id: Date.now(), role: 'user', content, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const response = await sendMessage(activeConversation.id, content)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events from buffer
        const lines = buffer.split('\n')
        // Keep last potentially incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.done) break
              if (data.token) {
                fullResponse += data.token
                setStreamingContent(fullResponse)
              }
            } catch {
              // Ignore JSON parse errors on partial chunks
            }
          }
        }
      }

      // Add complete assistant message
      if (fullResponse) {
        setMessages(prev => [
          ...prev,
          { id: Date.now() + 1, role: 'assistant', content: fullResponse, created_at: new Date().toISOString() }
        ])
      }
    } catch (err) {
      console.error('Stream error:', err)
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: 'Failed to get a response. Check your API key in Settings.', created_at: new Date().toISOString() }
      ])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
      loadConversations() // Refresh to get updated title
    }
  }

  // Back to conversation list
  const handleBack = () => {
    setShowConversationList(true)
    setActiveConversation(null)
    setMessages([])
  }

  // Load insights
  const loadInsights = async () => {
    try {
      const res = await getInsights({ limit: 50 })
      setInsights(res.data.insights || [])
    } catch (err) {
      console.error('Failed to load insights:', err)
    }
  }

  // Mark insight read
  const handleMarkRead = async (id) => {
    try {
      await markInsightRead(id)
      setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i))
      // Update unread count
      try {
        const res = await getUnreadInsightCount()
        onUnreadCountChange?.(res.data.unread_count || 0)
      } catch {}
    } catch (err) {
      console.error('Failed to mark insight read:', err)
    }
  }

  // Dismiss insight
  const handleDismissInsight = async (id) => {
    try {
      await dismissInsight(id)
      setInsights(prev => prev.filter(i => i.id !== id))
      try {
        const res = await getUnreadInsightCount()
        onUnreadCountChange?.(res.data.unread_count || 0)
      } catch {}
    } catch (err) {
      console.error('Failed to dismiss insight:', err)
    }
  }

  if (!isOpen) return null

  const priorityColors = {
    high: 'var(--color-error-600)',
    medium: 'var(--color-warning-600)',
    low: 'var(--color-info-600)',
  }

  const priorityLabels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  const domainLabels = {
    garden: 'Garden',
    fitness: 'Fitness',
    budget: 'Budget',
    production: 'Production',
    animals: 'Animals',
    weather: 'Weather',
    tasks: 'Tasks',
  }

  return (
    <>
      {/* Backdrop (mobile: full, desktop: overlay) */}
      <div
        className="fixed inset-0 z-40 md:bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-0 md:inset-auto md:right-4 md:bottom-20 md:top-auto md:w-[400px] md:h-[600px] md:max-h-[80vh] z-[55] flex flex-col md:rounded-xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            {!showConversationList && tab === 'chat' && (
              <button onClick={handleBack} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <Bot className="w-5 h-5" style={{ color: 'var(--color-green-600)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Isaac AI</span>
            {aiProvider && (
              <span
                style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '4px' }}
                title={aiModel || ''}
              >
                {aiProvider === 'claude' ? 'Claude' : aiProvider === 'openai' ? 'ChatGPT' : aiProvider === 'ollama' ? 'Ollama' : aiProvider}
              </span>
            )}
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: aiStatus === 'online' ? 'var(--color-success-600)' : aiStatus === 'offline' ? 'var(--color-error-600)' : 'var(--color-warning-600)' }}
              title={aiStatus}
            />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
          <button
            onClick={() => setTab('chat')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === 'chat' ? 'var(--color-green-600)' : 'var(--color-text-muted)',
              borderBottom: tab === 'chat' ? '2px solid var(--color-green-600)' : '2px solid transparent',
            }}
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => setTab('insights')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors"
            style={{
              color: tab === 'insights' ? 'var(--color-green-600)' : 'var(--color-text-muted)',
              borderBottom: tab === 'insights' ? '2px solid var(--color-green-600)' : '2px solid transparent',
            }}
          >
            <Lightbulb className="w-4 h-4" /> Insights
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'chat' ? (
            aiStatus === 'offline' ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
                <WifiOff className="w-10 h-10" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                  AI is offline. Configure your AI provider in Settings to chat with Isaac.
                </p>
                <button
                  onClick={checkHealth}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg-surface-soft)', color: 'var(--color-text-secondary)' }}
                >
                  Retry Connection
                </button>
              </div>
            ) : showConversationList ? (
              // Conversation list
              <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--color-green-600)',
                      color: 'white',
                    }}
                  >
                    <Plus className="w-4 h-4" /> New Chat
                  </button>
                </div>
                {conversations.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    No conversations yet. Start a new chat.
                  </p>
                ) : (
                  <div className="space-y-0.5 px-2 pb-3">
                    {conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => loadConversation(conv.id)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors hover:opacity-80"
                        style={{ backgroundColor: 'var(--color-bg-surface-soft)' }}
                      >
                        <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {conv.title || 'New Chat'}
                          </p>
                          {conv.topic && (
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{conv.topic}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                          style={{ color: 'var(--color-error-600)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Active conversation
              <>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {messages.length === 0 && !isStreaming && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                      <Bot className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Ask Isaac about your homestead
                      </p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}
                  {isStreaming && streamingContent && (
                    <ChatMessage message={{ role: 'assistant', content: streamingContent }} />
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <ChatInput
                  onSend={handleSend}
                  isStreaming={isStreaming}
                  disabled={aiStatus !== 'online'}
                />
              </>
            )
          ) : (
            // Insights tab
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {insights.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                  <Lightbulb className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                    No insights yet. Isaac will generate them on schedule.
                  </p>
                </div>
              ) : (
                insights.map(insight => (
                  <div
                    key={insight.id}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: insight.is_read ? 'var(--color-bg-surface-soft)' : 'var(--color-bg-surface)',
                      border: `1px solid ${insight.is_read ? 'var(--color-border-subtle)' : 'var(--color-border-default)'}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                          style={{
                            backgroundColor: priorityColors[insight.priority] || priorityColors.medium,
                            color: 'white'
                          }}
                        >
                          {priorityLabels[insight.priority] || 'Medium'}
                        </span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg-surface-muted)', color: 'var(--color-text-primary)' }}>
                          {domainLabels[insight.domain] || insight.domain}
                        </span>
                        {insight.created_at && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {new Date(insight.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!insight.is_read && (
                          <button
                            onClick={() => handleMarkRead(insight.id)}
                            className="p-0.5 rounded hover:opacity-70"
                            style={{ color: 'var(--color-text-muted)' }}
                            title="Mark as read"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismissInsight(insight.id)}
                          className="p-0.5 rounded hover:opacity-70"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Dismiss"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                      {insight.title}
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                      {insight.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default ChatPanel
