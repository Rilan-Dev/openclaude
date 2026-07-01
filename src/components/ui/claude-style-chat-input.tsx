import * as React from 'react'
import {
  Archive,
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react'

import type { SuggestionItem } from '../PromptInput/PromptInputFooterSuggestions.js'
import { PromptInputFooterSuggestions } from '../PromptInput/PromptInputFooterSuggestions.js'

export type ClaudeStyleAttachedFile = {
  id: string
  file: File
  type: string
  preview: string | null
  uploadStatus: 'pending' | 'uploading' | 'complete'
}

type Props = {
  value: string
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  isPasting?: boolean
  selectedModel: string
  thinkingEnabled?: boolean
  suggestions?: SuggestionItem[]
  selectedSuggestion?: number
  commandArgumentHint?: string
  onChange: (value: string, cursorOffset: number) => void
  onCursorChange: (cursorOffset: number) => void
  onSubmit: () => void
  onNewline: () => void
  onUndo: () => void
  onStash: () => void
  canUndo: boolean
  onExit?: () => void
  onHistoryUp?: () => void
  onHistoryDown?: () => void
  onPasteText: (text: string) => void
  onPasteImage: (file: File) => Promise<void> | void
  onApplySuggestion: (item: SuggestionItem) => void
  onMoveSuggestion: (direction: 'up' | 'down') => void
  onClearSuggestions: () => void
  onOpenModelPicker: () => void
  onOpenThinkingToggle: () => void
}

const quickActions = [
  { label: 'Write', icon: Pencil },
  { label: 'Learn', icon: GraduationCap },
  { label: 'Code', icon: FileText },
  { label: 'Life stuff', icon: Home },
]

export function ClaudeStyleChatInput({
  value,
  placeholder = 'How can I help you today?',
  disabled = false,
  isLoading = false,
  isPasting = false,
  selectedModel,
  thinkingEnabled,
  suggestions = [],
  selectedSuggestion = -1,
  commandArgumentHint,
  onChange,
  onCursorChange,
  onSubmit,
  onNewline,
  onUndo,
  onStash,
  canUndo,
  onExit,
  onHistoryUp,
  onHistoryDown,
  onPasteText,
  onPasteImage,
  onApplySuggestion,
  onMoveSuggestion,
  onClearSuggestions,
  onOpenModelPicker,
  onOpenThinkingToggle,
}: Props): React.ReactNode {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = React.useState<ClaudeStyleAttachedFile[]>([])
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 384)}px`
  }, [value])

  const hasContent = value.trim().length > 0 || files.length > 0

  const handleFiles = React.useCallback(
    (fileList: FileList | File[]) => {
      const nextFiles = Array.from(fileList)
        .filter(file => isImageFile(file) || isTextLikeFile(file))
        .map(file => ({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          type: isImageFile(file)
            ? file.type || 'image/unknown'
            : file.type || 'text/plain',
          preview: isImageFile(file) ? URL.createObjectURL(file) : null,
          uploadStatus: 'uploading' as const,
        }))

      if (nextFiles.length === 0) return

      setFiles(prev => [...prev, ...nextFiles])

      nextFiles.forEach(item => {
        const consumeFile = item.type.startsWith('image/')
          ? Promise.resolve(onPasteImage(item.file))
          : item.file.text().then(text => {
            onPasteText(`File: ${item.file.name}\n\n${text}`)
          })

        void consumeFile.finally(() => {
          setFiles(prev =>
            prev.map(file =>
              file.id === item.id ? { ...file, uploadStatus: 'complete' } : file,
            ),
          )
        })
      })
    },
    [onPasteImage, onPasteText],
  )

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget
      const currentCursor = textarea.selectionStart ?? textarea.value.length
      const hasSuggestions = suggestions.length > 0

      if (hasSuggestions && event.key === 'ArrowDown') {
        event.preventDefault()
        onMoveSuggestion('down')
        return
      }

      if (hasSuggestions && event.key === 'ArrowUp') {
        event.preventDefault()
        onMoveSuggestion('up')
        return
      }

      if (event.key === 'ArrowUp' && isCursorOnFirstLine(textarea.value, currentCursor)) {
        event.preventDefault()
        onHistoryUp?.()
        return
      }

      if (event.key === 'ArrowDown' && isCursorOnLastLine(textarea.value, currentCursor)) {
        event.preventDefault()
        onHistoryDown?.()
        return
      }

      if (hasSuggestions && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey))) {
        event.preventDefault()
        const item = suggestions[Math.max(0, selectedSuggestion)]
        if (item) onApplySuggestion(item)
        return
      }

      if (event.key === 'Escape' && hasSuggestions) {
        event.preventDefault()
        onClearSuggestions()
        return
      }

      if (event.key === 'Escape' && textarea.value.length === 0) {
        event.preventDefault()
        onExit?.()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        onSubmit()
        return
      }

      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault()
        onNewline()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && canUndo) {
        event.preventDefault()
        onUndo()
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        onStash()
      }
    },
    [
      canUndo,
      onApplySuggestion,
      onClearSuggestions,
      onExit,
      onHistoryDown,
      onHistoryUp,
      onMoveSuggestion,
      onNewline,
      onStash,
      onSubmit,
      onUndo,
      selectedSuggestion,
      suggestions,
    ],
  )

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files ?? [])
      if (files.length > 0) {
        event.preventDefault()
        handleFiles(files)
        return
      }

      const text = event.clipboardData.getData('text/plain')
      if (text.length > 300) {
        event.preventDefault()
        onPasteText(text)
      }
    },
    [handleFiles, onPasteText],
  )

  return (
    <div
      className="oc-claude-chat"
      data-loading={isLoading ? 'true' : undefined}
      data-pasting={isPasting ? 'true' : undefined}
      onDragOver={event => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={event => {
        event.preventDefault()
        setIsDragging(false)
      }}
      onDrop={event => {
        event.preventDefault()
        setIsDragging(false)
        if (event.dataTransfer.files.length > 0) handleFiles(event.dataTransfer.files)
      }}
    >
      {/* <div className="oc-claude-hero" aria-hidden="true" style={{paddingTop: 20}}>
        <ClaudeMark />
        <h1>
          Good morning, <span>Saify</span>
        </h1>
      </div> */}

      <div className="oc-claude-inputShell">
        {files.length > 0 ? (
          <div className="oc-claude-attachments">
            {files.map(file => (
              <FilePreviewCard
                key={file.id}
                file={file}
                onRemove={id => setFiles(prev => prev.filter(item => item.id !== id))}
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          aria-label="Prompt input"
          aria-expanded={suggestions.length > 0}
          aria-describedby={commandArgumentHint ? 'openclaude-prompt-command-hint' : undefined}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          enterKeyHint="send"
          onChange={event => {
            const target = event.currentTarget
            onChange(target.value, target.selectionStart ?? target.value.length)
          }}
          onSelect={event => {
            const target = event.currentTarget
            onCursorChange(target.selectionStart ?? target.value.length)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        <div className="oc-claude-toolbar">
          <div className="oc-claude-toolsLeft">
            <button
              type="button"
              className="oc-claude-iconButton"
              aria-label="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={22} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="oc-claude-iconButton"
              data-active={thinkingEnabled ? 'true' : undefined}
              aria-label="Extended thinking"
              onClick={onOpenThinkingToggle}
            >
              <Clock3 size={20} strokeWidth={1.6} />
            </button>
          </div>

          <div className="oc-claude-toolsRight">
            <button
              type="button"
              className="oc-claude-modelButton"
              onClick={onOpenModelPicker}
            >
              <span>{selectedModel}</span>
              <ChevronDown size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="oc-claude-sendButton"
              disabled={!hasContent || isLoading}
              aria-label="Send message"
              onClick={onSubmit}
            >
              {isLoading ? <Loader2 size={18} className="oc-spin" /> : <ArrowUp size={19} />}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={event => {
            if (event.currentTarget.files) handleFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />

        {isDragging ? (
          <div className="oc-claude-dropOverlay">
            <Archive size={34} />
            <span>Drop files to upload</span>
          </div>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="oc-claude-suggestions">
          <PromptInputFooterSuggestions
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
          />
        </div>
      ) : null}

      {commandArgumentHint ? (
        <div id="openclaude-prompt-command-hint" className="oc-claude-commandHint">
          Tab applies {commandArgumentHint}
        </div>
      ) : null}

      <p className="oc-claude-disclaimer">
        AI can make mistakes. Please check important information.
      </p>

      {/* <div className="oc-claude-quickActions" aria-hidden="true">
        {quickActions.map(action => (
          <button key={action.label} type="button" tabIndex={-1}>
            <action.icon size={17} strokeWidth={1.7} />
            <span>{action.label}</span>
          </button>
        ))}
      </div> */}
    </div>
  )
}

function FilePreviewCard({
  file,
  onRemove,
}: {
  file: ClaudeStyleAttachedFile
  onRemove: (id: string) => void
}) {
  const isImage = file.type.startsWith('image/') && file.preview

  return (
    <div className="oc-claude-fileCard">
      {isImage ? (
        <img src={file.preview ?? ''} alt={file.file.name} />
      ) : (
        <div className="oc-claude-fileDoc">
          <FileText size={18} />
          <strong>{file.file.name}</strong>
          <span>{formatFileSize(file.file.size)}</span>
        </div>
      )}
      <button type="button" aria-label="Remove file" onClick={() => onRemove(file.id)}>
        <X size={13} />
      </button>
      {file.uploadStatus === 'complete' ? (
        <span className="oc-claude-fileStatus">
          <Check size={12} />
        </span>
      ) : (
        <span className="oc-claude-fileStatus">
          <Loader2 size={12} className="oc-spin" />
        </span>
      )}
    </div>
  )
}

function ClaudeMark() {
  return (
    <svg viewBox="0 0 200 200" role="presentation" className="oc-claude-mark">
      <defs>
        <ellipse id="openclaude-petal-pair" cx="100" cy="100" rx="82" ry="20" />
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <use href="#openclaude-petal-pair" transform="rotate(0 100 100)" />
        <use href="#openclaude-petal-pair" transform="rotate(45 100 100)" />
        <use href="#openclaude-petal-pair" transform="rotate(90 100 100)" />
        <use href="#openclaude-petal-pair" transform="rotate(135 100 100)" />
      </g>
    </svg>
  )
}

function isCursorOnFirstLine(value: string, cursorOffset: number): boolean {
  if (cursorOffset <= 0) return true
  return value.lastIndexOf('\n', cursorOffset - 1) === -1
}

function isCursorOnLastLine(value: string, cursorOffset: number): boolean {
  return value.indexOf('\n', cursorOffset) === -1
}

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name)
  )
}

function isTextLikeFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /\.(txt|md|mdx|json|jsonc|csv|ts|tsx|js|jsx|css|scss|html|xml|yaml|yml|toml|ini|env|log|sql|py|rs|go|java|c|cc|cpp|h|hpp|cs|php|rb|sh|ps1)$/i.test(file.name)
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** index).toFixed(2))} ${sizes[index]}`
}

export default ClaudeStyleChatInput
