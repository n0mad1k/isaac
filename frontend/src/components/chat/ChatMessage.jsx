import React, { useState } from 'react'
import { User, Bot, Calendar, Check, Loader2 } from 'lucide-react'
import { createTaskFromChat } from '../../services/api'

function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskCreated, setTaskCreated] = useState(false)
  const [taskError, setTaskError] = useState(null)

  // Parse task JSON from message content
  const parseTaskFromContent = (content) => {
    const taskMatch = content.match(/```task\s*([\s\S]*?)```/)
    if (taskMatch) {
      try {
        return JSON.parse(taskMatch[1].trim())
      } catch (e) {
        return null
      }
    }
    return null
  }

  // Remove task block from display content
  const getDisplayContent = (content) => {
    return content.replace(/```task\s*[\s\S]*?```/g, '').trim()
  }

  const handleCreateTask = async (taskData) => {
    setCreatingTask(true)
    setTaskError(null)
    try {
      await createTaskFromChat(taskData)
      setTaskCreated(true)
    } catch (error) {
      setTaskError(error.response?.data?.detail || 'Failed to create task')
    } finally {
      setCreatingTask(false)
    }
  }

  const taskData = !isUser ? parseTaskFromContent(message.content) : null
  const displayContent = taskData ? getDisplayContent(message.content) : message.content

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
      <div className="max-w-[80%]">
        <div
          className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={{
            backgroundColor: isUser ? 'var(--color-green-600)' : 'var(--color-bg-surface-soft)',
            color: isUser ? 'white' : 'var(--color-text-primary)',
          }}
        >
          {/* Render message content with basic line breaks */}
          {displayContent.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < displayContent.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>

        {/* Task creation card */}
        {taskData && (
          <div className="mt-2 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Suggested Task</span>
            </div>
            <div className="text-sm text-primary mb-2">
              <strong>{taskData.title}</strong>
              {taskData.due_date && (
                <span className="text-muted ml-2">
                  Due: {new Date(taskData.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                  {taskData.due_time && ` at ${taskData.due_time}`}
                </span>
              )}
            </div>
            {taskData.description && (
              <p className="text-xs text-muted mb-2">{taskData.description}</p>
            )}
            {taskCreated ? (
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <Check className="w-4 h-4" /> Task created!
              </div>
            ) : taskError ? (
              <div className="text-red-400 text-sm">{taskError}</div>
            ) : (
              <button
                onClick={() => handleCreateTask(taskData)}
                disabled={creatingTask}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm text-white flex items-center gap-1 disabled:opacity-50"
              >
                {creatingTask ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" /> Create Task
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatMessage
