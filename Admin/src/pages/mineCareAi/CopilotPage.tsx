import { useState } from 'react'
import { Bot, Send, UserRound } from 'lucide-react'
import { Button } from 'primereact/button'
import { InputTextarea } from 'primereact/inputtextarea'
import { useAskMineCareCopilotMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareCopilotResponse } from '@/types/mineCareAi'
import { ActionTable, formatConfidence, MineCarePage, ScrollRegion, StatusBadge, SurfacePanel } from './shared'

const questions = [
  'Which machines need service this week?',
  'Which equipment is at highest breakdown risk?',
  'Which warranties are expiring soon?',
  'Which spare parts should be reordered?',
  'What actions should be prioritized today?',
]

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; response: MineCareCopilotResponse }

export function MineCareCopilotPage() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [askCopilot, { isLoading }] = useAskMineCareCopilotMutation()
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message): message is Extract<ChatMessage, { role: 'assistant' }> => message.role === 'assistant')

  const askQuestion = async (nextQuestion = question) => {
    const trimmedQuestion = nextQuestion.trim()
    if (!trimmedQuestion) return

    setQuestion('')
    setMessages((current) => [...current, { role: 'user', text: trimmedQuestion }])
    const response = await askCopilot({ question: trimmedQuestion }).unwrap()
    setMessages((current) => [...current, { role: 'assistant', text: response.answer, response }])
  }

  return (
    <MineCarePage title="AI Copilot" description="Ask natural-language questions across maintenance, warranty, inventory, and budget data.">
      <SurfacePanel title="Question" description="Ask the MineCare assistant about service risk, warranties, spare parts, budget exposure, or a specific asset.">
        <div className="flex flex-wrap gap-2">
          {questions.map((item) => (
            <Button
              key={item}
              label={item}
              severity="secondary"
              outlined
              onClick={() => void askQuestion(item)}
            />
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start">
          <InputTextarea
            value={question}
            rows={3}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void askQuestion()
            }}
            placeholder="Ask about service due this week, warranty exposure, asset risk, or reorder priorities..."
            className="w-full"
          />
          <Button label="Ask" icon={<Send className="h-4 w-4" />} loading={isLoading} onClick={() => void askQuestion()} />
        </div>
      </SurfacePanel>

      <SurfacePanel title="Copilot Conversation">
        <ScrollRegion>
          <div className="space-y-4">
          {messages.length ? messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Bot className="h-4 w-4" /></div> : null}
              <div className={`max-w-3xl rounded-lg border border-[var(--color-border)] p-4 ${message.role === 'user' ? 'bg-[var(--color-primary-soft)]' : 'bg-[var(--color-surface-muted)]'}`}>
                <p className="text-sm font-medium text-[var(--color-text-strong)]">{message.text}</p>
                {message.role === 'assistant' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge value={message.response.source === 'agentic-server' ? 'AI Recommended' : 'Fallback Insight'} />
                    <StatusBadge value={`Confidence ${formatConfidence(message.response.confidence)}`} />
                    {message.response.referencedAssets.map((asset) => <StatusBadge key={asset} value={asset} />)}
                  </div>
                ) : null}
              </div>
              {message.role === 'user' ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"><UserRound className="h-4 w-4" /></div> : null}
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-sm text-[var(--color-text-muted)]">
              Ask a question or choose a suggested question to start.
            </div>
          )}
          </div>
        </ScrollRegion>
      </SurfacePanel>

      {lastAssistantMessage ? (
        <SurfacePanel title="Recommended Actions">
          <ActionTable actions={lastAssistantMessage.response.recommendedActions} />
        </SurfacePanel>
      ) : null}
    </MineCarePage>
  )
}
